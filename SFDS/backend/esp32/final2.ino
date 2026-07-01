// ==========================================================
// ESP32 + 3 E3F qua PC817 + 3 Relay + 3 Xi lanh
// Arduino IDE - ESP32 Dev Module
// Relay HW-718 đặt jumper LOW-COM
// ==========================================================

// ------------------ CHÂN CẢM BIẾN ------------------
// PC817 kéo GPIO xuống LOW khi E3F phát hiện vật
#define SENSOR_1_PIN 18
#define SENSOR_2_PIN 19
#define SENSOR_3_PIN 21

// ------------------ CHÂN RELAY ------------------
#define RELAY_1_PIN 25
#define RELAY_2_PIN 26
#define RELAY_3_PIN 27

// ------------------ CẤU HÌNH LOGIC ------------------
// HW-718 ở chế độ LOW trigger:
// GPIO LOW  -> relay bật
// GPIO HIGH -> relay tắt
const bool RELAY_ACTIVE_LOW = true;

// PC817 thường kéo GPIO xuống LOW khi cảm biến phát hiện vật
const int SENSOR_ACTIVE_LEVEL = LOW;

// ------------------ THỜI GIAN ------------------
const unsigned long DEBOUNCE_MS = 50;

// Sau khi cảm biến nhận trái, chờ 2 giây mới kích xi lanh
const unsigned long DETECT_TO_PUSH_DELAY_MS = 2000;

// Xi lanh/van hoạt động trong 2 giây
const unsigned long PUSH_TIME_MS = 2000;

// ------------------ TRẠNG THÁI ------------------
enum ChannelState {
  WAIT_OBJECT,       // Chờ vật thể đến
  DEBOUNCE_OBJECT,   // Xác nhận tín hiệu ổn định
  WAIT_TO_PUSH,      // Đã nhận vật, chờ đến vị trí xi lanh
  CYLINDER_PUSHING,  // Đang kích xi lanh
  WAIT_OBJECT_LEAVE  // Chờ vật đi qua hẳn để không kích lặp
};

struct SortChannel {
  uint8_t sensorPin;
  uint8_t relayPin;
  ChannelState state;
  unsigned long stateStartTime;
  const char* name;
};

SortChannel channels[] = {
  {SENSOR_1_PIN, RELAY_1_PIN, WAIT_OBJECT, 0, "KENH 1"},
  {SENSOR_2_PIN, RELAY_2_PIN, WAIT_OBJECT, 0, "KENH 2"},
  {SENSOR_3_PIN, RELAY_3_PIN, WAIT_OBJECT, 0, "KENH 3"}
};

const int CHANNEL_COUNT = sizeof(channels) / sizeof(channels[0]);

// ==========================================================
// HÀM RELAY
// ==========================================================
void setRelay(uint8_t relayPin, bool turnOn) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(relayPin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(relayPin, turnOn ? HIGH : LOW);
  }
}

bool isObjectDetected(uint8_t sensorPin) {
  return digitalRead(sensorPin) == SENSOR_ACTIVE_LEVEL;
}

void turnOffAllRelays() {
  for (int i = 0; i < CHANNEL_COUNT; i++) {
    setRelay(channels[i].relayPin, false);
  }
}

// ==========================================================
// XỬ LÝ MỖI KÊNH CẢM BIẾN + XI LANH
// ==========================================================
void processChannel(SortChannel &channel, unsigned long now) {
  bool objectDetected = isObjectDetected(channel.sensorPin);

  switch (channel.state) {

    case WAIT_OBJECT:
      // Chờ vật thể xuất hiện
      if (objectDetected) {
        channel.state = DEBOUNCE_OBJECT;
        channel.stateStartTime = now;

        Serial.print("[");
        Serial.print(channel.name);
        Serial.println("] Phat hien vat - dang xac nhan...");
      }
      break;

    case DEBOUNCE_OBJECT:
      // Chống nhiễu tín hiệu cảm biến
      if (!objectDetected) {
        channel.state = WAIT_OBJECT;
      }
      else if (now - channel.stateStartTime >= DEBOUNCE_MS) {
        channel.state = WAIT_TO_PUSH;
        channel.stateStartTime = now;

        Serial.print("[");
        Serial.print(channel.name);
        Serial.println("] Da xac nhan vat - cho 2 giay truoc khi kich xi lanh.");
      }
      break;

    case WAIT_TO_PUSH:
      // Đợi trái đi từ vị trí cảm biến đến vị trí xi lanh
      if (now - channel.stateStartTime >= DETECT_TO_PUSH_DELAY_MS) {
        setRelay(channel.relayPin, true);

        channel.state = CYLINDER_PUSHING;
        channel.stateStartTime = now;

        Serial.print("[");
        Serial.print(channel.name);
        Serial.println("] BAT relay - xi lanh dang day.");
      }
      break;

    case CYLINDER_PUSHING:
      // Giữ xi lanh hoạt động trong thời gian quy định
      if (now - channel.stateStartTime >= PUSH_TIME_MS) {
        setRelay(channel.relayPin, false);

        channel.state = WAIT_OBJECT_LEAVE;
        channel.stateStartTime = now;

        Serial.print("[");
        Serial.print(channel.name);
        Serial.println("] TAT relay - cho vat roi khoi cam bien.");
      }
      break;

    case WAIT_OBJECT_LEAVE:
      // Chống việc một vật đứng tại cảm biến bị kích nhiều lần
      if (!objectDetected) {
        channel.state = WAIT_OBJECT;

        Serial.print("[");
        Serial.print(channel.name);
        Serial.println("] San sang nhan vat tiep theo.");
      }
      break;
  }
}

// ==========================================================
// SETUP
// ==========================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("===== ESP32 - 3 E3F - 3 Relay - 3 Xi lanh =====");

  for (int i = 0; i < CHANNEL_COUNT; i++) {
    pinMode(channels[i].sensorPin, INPUT_PULLUP);

    pinMode(channels[i].relayPin, OUTPUT);
    setRelay(channels[i].relayPin, false);

    channels[i].state = WAIT_OBJECT;
    channels[i].stateStartTime = millis();
  }

  Serial.println("He thong da san sang.");
}

// ==========================================================
// LOOP
// ==========================================================
void loop() {
  unsigned long now = millis();

  for (int i = 0; i < CHANNEL_COUNT; i++) {
    processChannel(channels[i], now);
  }
}