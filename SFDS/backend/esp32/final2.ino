// ==========================================================
// SFDS ESP32 Final2
// ESP32 + 3 E3F sensors via PC817 + 3 relay/cylinders
//
// Serial protocol for backend integration at 115200 baud:
//   PING
//   STATUS
//   MODE BE
//   MODE AUTO
//   ARM <channel> <delay_ms> <pulse_ms> <command_id>
//   PULSE <channel> <delay_ms> <pulse_ms> <command_id>
//   STOP
//
// ARM waits for the selected E3F sensor before delaying and pulsing.
// PULSE delays and pulses immediately, without waiting for the sensor.
// channel is 1..3. D/pass_through should not send a relay command.
// ==========================================================

#define SENSOR_1_PIN 18
#define SENSOR_2_PIN 19
#define SENSOR_3_PIN 21

#define RELAY_1_PIN 25
#define RELAY_2_PIN 26
#define RELAY_3_PIN 27

const bool RELAY_ACTIVE_LOW = true;
const int SENSOR_INPUT_MODE = INPUT_PULLUP;
const bool SENSOR_AUTO_CALIBRATE = true;
const int SENSOR_ACTIVE_LEVEL = LOW;

const unsigned long DEBOUNCE_MS = 50;
const unsigned long DEFAULT_DETECT_TO_PUSH_DELAY_MS = 2000;
const unsigned long DEFAULT_PUSH_TIME_MS = 2000;
const unsigned long ARM_TIMEOUT_MS = 10000;
const unsigned long SENSOR_LATCH_MS = 3000;

enum ChannelState {
  IDLE,
  AUTO_DEBOUNCE,
  WAIT_TO_PUSH,
  CYLINDER_PUSHING,
  WAIT_OBJECT_LEAVE,
  ARMED_WAIT_OBJECT,
  ARMED_DEBOUNCE
};

struct SortChannel {
  uint8_t sensorPin;
  uint8_t relayPin;
  ChannelState state;
  unsigned long stateStartTime;
  unsigned long delayMs;
  unsigned long pulseMs;
  unsigned long lastSensorHitTime;
  int idleLevel;
  bool sensorWasDetected;
  String commandId;
  const char* name;
};

SortChannel channels[] = {
  {SENSOR_1_PIN, RELAY_1_PIN, IDLE, 0, DEFAULT_DETECT_TO_PUSH_DELAY_MS, DEFAULT_PUSH_TIME_MS, 0, HIGH, false, "", "CH1"},
  {SENSOR_2_PIN, RELAY_2_PIN, IDLE, 0, DEFAULT_DETECT_TO_PUSH_DELAY_MS, DEFAULT_PUSH_TIME_MS, 0, HIGH, false, "", "CH2"},
  {SENSOR_3_PIN, RELAY_3_PIN, IDLE, 0, DEFAULT_DETECT_TO_PUSH_DELAY_MS, DEFAULT_PUSH_TIME_MS, 0, HIGH, false, "", "CH3"}
};

const int CHANNEL_COUNT = sizeof(channels) / sizeof(channels[0]);
bool autoMode = false;

void setRelay(uint8_t relayPin, bool turnOn) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(relayPin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(relayPin, turnOn ? HIGH : LOW);
  }
}

bool isObjectDetected(const SortChannel &channel) {
  int rawLevel = digitalRead(channel.sensorPin);
  if (SENSOR_AUTO_CALIBRATE) {
    return rawLevel != channel.idleLevel;
  }
  return rawLevel == SENSOR_ACTIVE_LEVEL;
}

bool hasRecentSensorHit(const SortChannel &channel, unsigned long now) {
  return channel.lastSensorHitTime > 0 && now - channel.lastSensorHitTime <= SENSOR_LATCH_MS;
}

void updateSensorLatch(SortChannel &channel, bool objectDetected, unsigned long now) {
  if (objectDetected && !channel.sensorWasDetected) {
    channel.lastSensorHitTime = now;
    channel.sensorWasDetected = true;
    Serial.print("SENSOR_EDGE channel=");
    Serial.print(channel.name);
    Serial.print(" latch_ms=");
    Serial.println(SENSOR_LATCH_MS);
  } else if (!objectDetected) {
    channel.sensorWasDetected = false;
  }
}

void turnOffAllRelays() {
  for (int i = 0; i < CHANNEL_COUNT; i++) {
    setRelay(channels[i].relayPin, false);
  }
}

void resetChannel(SortChannel &channel) {
  setRelay(channel.relayPin, false);
  channel.state = IDLE;
  channel.stateStartTime = millis();
  channel.delayMs = DEFAULT_DETECT_TO_PUSH_DELAY_MS;
  channel.pulseMs = DEFAULT_PUSH_TIME_MS;
  channel.commandId = "";
}

void beginPush(SortChannel &channel, unsigned long now) {
  setRelay(channel.relayPin, true);
  channel.state = CYLINDER_PUSHING;
  channel.stateStartTime = now;

  Serial.print("RELAY_ON channel=");
  Serial.print(channel.name);
  Serial.print(" command_id=");
  Serial.println(channel.commandId);
}

void finishPush(SortChannel &channel, unsigned long now) {
  setRelay(channel.relayPin, false);
  channel.state = WAIT_OBJECT_LEAVE;
  channel.stateStartTime = now;

  Serial.print("DONE channel=");
  Serial.print(channel.name);
  Serial.print(" command_id=");
  Serial.println(channel.commandId);
}

int channelIndexFromNumber(int channelNumber) {
  if (channelNumber < 1 || channelNumber > CHANNEL_COUNT) return -1;
  return channelNumber - 1;
}

void armChannel(int channelNumber, unsigned long delayMs, unsigned long pulseMs, const String &commandId) {
  int idx = channelIndexFromNumber(channelNumber);
  if (idx < 0) {
    Serial.print("ERR invalid_channel command_id=");
    Serial.println(commandId);
    return;
  }

  SortChannel &channel = channels[idx];
  if (channel.state != IDLE && channel.state != WAIT_OBJECT_LEAVE) {
    Serial.print("BUSY channel=");
    Serial.print(channel.name);
    Serial.print(" command_id=");
    Serial.println(commandId);
    return;
  }

  channel.delayMs = delayMs;
  channel.pulseMs = pulseMs;
  channel.commandId = commandId;
  unsigned long now = millis();
  if (hasRecentSensorHit(channel, now)) {
    channel.state = WAIT_TO_PUSH;
    channel.stateStartTime = channel.lastSensorHitTime;
  } else {
    channel.state = ARMED_WAIT_OBJECT;
    channel.stateStartTime = now;
  }

  Serial.print("ACK ARM channel=");
  Serial.print(channel.name);
  Serial.print(" delay_ms=");
  Serial.print(delayMs);
  Serial.print(" pulse_ms=");
  Serial.print(pulseMs);
  Serial.print(" latched=");
  Serial.print(channel.state == WAIT_TO_PUSH ? "1" : "0");
  Serial.print(" command_id=");
  Serial.println(commandId);
}

void pulseChannel(int channelNumber, unsigned long delayMs, unsigned long pulseMs, const String &commandId) {
  int idx = channelIndexFromNumber(channelNumber);
  if (idx < 0) {
    Serial.print("ERR invalid_channel command_id=");
    Serial.println(commandId);
    return;
  }

  SortChannel &channel = channels[idx];
  if (channel.state != IDLE && channel.state != WAIT_OBJECT_LEAVE) {
    Serial.print("BUSY channel=");
    Serial.print(channel.name);
    Serial.print(" command_id=");
    Serial.println(commandId);
    return;
  }

  channel.delayMs = delayMs;
  channel.pulseMs = pulseMs;
  channel.commandId = commandId;
  channel.state = WAIT_TO_PUSH;
  channel.stateStartTime = millis();

  Serial.print("ACK PULSE channel=");
  Serial.print(channel.name);
  Serial.print(" delay_ms=");
  Serial.print(delayMs);
  Serial.print(" pulse_ms=");
  Serial.print(pulseMs);
  Serial.print(" command_id=");
  Serial.println(commandId);
}

String readToken(String &line) {
  line.trim();
  int space = line.indexOf(' ');
  if (space < 0) {
    String token = line;
    line = "";
    return token;
  }
  String token = line.substring(0, space);
  line = line.substring(space + 1);
  return token;
}

void handleSerialLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  String cmd = readToken(line);
  cmd.toUpperCase();

  if (cmd == "PING") {
    Serial.println("PONG final2");
    return;
  }

  if (cmd == "STATUS") {
    Serial.print("STATUS mode=");
    Serial.print(autoMode ? "AUTO" : "BE");
    for (int i = 0; i < CHANNEL_COUNT; i++) {
      Serial.print(" ");
      Serial.print(channels[i].name);
      Serial.print("_state=");
      Serial.print((int)channels[i].state);
      Serial.print(" raw=");
      Serial.print(digitalRead(channels[i].sensorPin));
      Serial.print(" idle=");
      Serial.print(channels[i].idleLevel);
      Serial.print(" sensor=");
      Serial.print(isObjectDetected(channels[i]) ? "1" : "0");
      Serial.print(" latch_age_ms=");
      unsigned long age = channels[i].lastSensorHitTime > 0 ? millis() - channels[i].lastSensorHitTime : 999999;
      Serial.print(age);
    }
    Serial.println();
    return;
  }

  if (cmd == "MODE") {
    String mode = readToken(line);
    mode.toUpperCase();
    autoMode = mode == "AUTO";
    Serial.print("ACK MODE ");
    Serial.println(autoMode ? "AUTO" : "BE");
    return;
  }

  if (cmd == "STOP") {
    for (int i = 0; i < CHANNEL_COUNT; i++) resetChannel(channels[i]);
    Serial.println("ACK STOP");
    return;
  }

  if (cmd == "ARM" || cmd == "PULSE") {
    int channelNumber = readToken(line).toInt();
    unsigned long delayMs = (unsigned long)readToken(line).toInt();
    unsigned long pulseMs = (unsigned long)readToken(line).toInt();
    String commandId = readToken(line);
    if (commandId.length() == 0) commandId = "manual";

    if (cmd == "ARM") {
      armChannel(channelNumber, delayMs, pulseMs, commandId);
    } else {
      pulseChannel(channelNumber, delayMs, pulseMs, commandId);
    }
    return;
  }

  Serial.print("ERR unknown_command ");
  Serial.println(cmd);
}

void pollSerial() {
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    handleSerialLine(line);
  }
}

void processChannel(SortChannel &channel, unsigned long now) {
  bool objectDetected = isObjectDetected(channel);
  updateSensorLatch(channel, objectDetected, now);

  switch (channel.state) {
    case IDLE:
      if (autoMode && objectDetected) {
        channel.commandId = "auto";
        channel.delayMs = DEFAULT_DETECT_TO_PUSH_DELAY_MS;
        channel.pulseMs = DEFAULT_PUSH_TIME_MS;
        channel.state = AUTO_DEBOUNCE;
        channel.stateStartTime = now;
      }
      break;

    case AUTO_DEBOUNCE:
      if (!objectDetected) {
        resetChannel(channel);
      } else if (now - channel.stateStartTime >= DEBOUNCE_MS) {
        channel.state = WAIT_TO_PUSH;
        channel.stateStartTime = now;
      }
      break;

    case ARMED_WAIT_OBJECT:
      if (now - channel.stateStartTime >= ARM_TIMEOUT_MS) {
        Serial.print("TIMEOUT channel=");
        Serial.print(channel.name);
        Serial.print(" command_id=");
        Serial.println(channel.commandId);
        resetChannel(channel);
      } else if (objectDetected) {
        channel.state = ARMED_DEBOUNCE;
        channel.stateStartTime = now;
      } else if (hasRecentSensorHit(channel, now)) {
        Serial.print("SENSOR_LATCH_HIT channel=");
        Serial.print(channel.name);
        Serial.print(" command_id=");
        Serial.println(channel.commandId);
        channel.state = WAIT_TO_PUSH;
        channel.stateStartTime = channel.lastSensorHitTime;
      }
      break;

    case ARMED_DEBOUNCE:
      if (!objectDetected) {
        channel.state = ARMED_WAIT_OBJECT;
        channel.stateStartTime = now;
      } else if (now - channel.stateStartTime >= DEBOUNCE_MS) {
        Serial.print("SENSOR_HIT channel=");
        Serial.print(channel.name);
        Serial.print(" command_id=");
        Serial.println(channel.commandId);
        channel.state = WAIT_TO_PUSH;
        channel.stateStartTime = now;
      }
      break;

    case WAIT_TO_PUSH:
      if (now - channel.stateStartTime >= channel.delayMs) {
        beginPush(channel, now);
      }
      break;

    case CYLINDER_PUSHING:
      if (now - channel.stateStartTime >= channel.pulseMs) {
        finishPush(channel, now);
      }
      break;

    case WAIT_OBJECT_LEAVE:
      if (!objectDetected) {
        resetChannel(channel);
        Serial.print("READY channel=");
        Serial.println(channel.name);
      }
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(25);
  delay(500);

  for (int i = 0; i < CHANNEL_COUNT; i++) {
    pinMode(channels[i].sensorPin, SENSOR_INPUT_MODE);
    pinMode(channels[i].relayPin, OUTPUT);
    resetChannel(channels[i]);
  }

  turnOffAllRelays();
  delay(100);
  for (int i = 0; i < CHANNEL_COUNT; i++) {
    channels[i].idleLevel = digitalRead(channels[i].sensorPin);
    Serial.print("SENSOR_IDLE channel=");
    Serial.print(channels[i].name);
    Serial.print(" idle=");
    Serial.println(channels[i].idleLevel);
  }
  Serial.println("READY final2 mode=BE baud=115200");
}

void loop() {
  unsigned long now = millis();
  pollSerial();
  for (int i = 0; i < CHANNEL_COUNT; i++) {
    processChannel(channels[i], now);
  }
}
