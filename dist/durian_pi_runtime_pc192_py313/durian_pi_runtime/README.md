# Raspberry Pi camera sender

Thu muc nay la ban chay rieng cho Raspberry Pi 4 Model B khi muon Pi chi chup anh tu 2 camera, dung YOLOv8 ONNX locator de detect bbox trai sau rieng, crop rieng trai do, sau do gui anh crop ve PC de PC detect sau benh/do chin/phan loai bang backend/model hien tai.

Kien truc:

```text
Camera 0/1 -> Raspberry Pi -> detect bbox/crop trai -> JPEG POST -> PC FastAPI /api/detect/batch/ -> YOLO detect/phan loai tren PC
```

Pi khong can cai FastAPI, frontend, PyTorch hay Ultralytics khi dung `fruit_crop.backend="onnx"`. Pi chi can `onnxruntime` va model locator `.onnx` de detect rieng trai sau rieng.

## 1. Chay backend detect tren PC

Tren PC, chay backend nhu hien tai:

```bash
cd SFDS/backend
uvicorn main:app --host 0.0.0.0 --port 9000
```

Kiem tra tu may khac trong cung mang:

```bash
curl http://IP_PC:9000/health/
```

Neu Windows Firewall hoi quyen, cho phep port `9000` trong private network.

## 2. Cai moi truong tren Pi

Neu dung goi runtime da dong goi, uu tien chay:

```bash
chmod +x start.sh health_check.sh
./start.sh --preview
```

Script se tu tao `.venv`, cai dependency bang Python trong `.venv`, va dung OpenCV he dieu hanh neu can.

Neu Pi bao `externally-managed-environment`, xoa `.venv` cu va cai goi venv cua he dieu hanh:

```bash
rm -rf .venv
sudo apt update
sudo apt install -y python3-venv python3-full python3-opencv
./start.sh --preview
```

Neu muon cai thu cong:

```bash
cd raspberry_pi
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

OpenCV nen cai bang apt tren Raspberry Pi OS:

```bash
sudo apt update
sudo apt install -y python3-opencv
```

Neu ban dang co model `.pt`, nen export sang ONNX tren PC truoc roi copy file `.onnx` sang Pi. Cai moi truong export tren PC:

```bash
pip install -r requirements-export.txt
```

Export bang script co validate ONNX Runtime:

```bash
python export_pt_to_onnx.py --weights best.pt --output models/durian_fruit_locator.onnx --imgsz 640 --opset 12
```

Neu file model dat ten `best.pt` trong thu muc `raspberry_pi`, hoac `durian_yolov8.pt` trong thu muc `model`, co the chay ngan gon:

```bash
python export_pt_to_onnx.py
```

Neu co anh mau, nen test luon bbox sau export:

```bash
python export_pt_to_onnx.py --weights best.pt --output models/durian_fruit_locator.onnx --sample test_durian.jpg --debug-output debug_onnx.jpg
```

Tao thu muc model locator va copy model da train vao Pi:

```bash
mkdir -p models
cp /duong/dan/model_cua_ban.onnx models/durian_fruit_locator.onnx
```

Ghi chu export:

- Script export fixed input shape mac dinh (`dynamic=false`) de nhe va de chay on Raspberry Pi.
- `nms=false` khi export; Pi se tu NMS bang OpenCV de lay bbox tot nhat.
- `opset=12` la muc an toan cho ONNX Runtime tren Pi.
- Neu train voi size khac, dung cung `--imgsz` voi luc train/inference mong muon, vi config Pi cung phai de cung `imgsz`.
- Script tao them `durian_fruit_locator.labels.json`; copy `class_labels` trong file nay vao `config.pi.json` neu model co nhieu class.

Loi export thuong gap:

- Thieu `onnxslim`/`onnxsim`: chay lai `pip install -r requirements-export.txt`. Script cung se tu retry voi `simplify=false` neu simplify bi loi.
- Python qua cu: nen dung Python 3.10 hoac 3.11 tren PC de export.
- Export OK nhung test anh khong co bbox: thu giam `--conf 0.2`, kiem tra `--imgsz` co khop luc train khong, va mo `debug_onnx.jpg` de xem box.
- Pi khong detect sau khi copy model: dam bao `config.pi.json` co cung `imgsz`, dung dung `model_path`, va `class_ids`/`class_names` khong filter nham class.

## 3. Cau hinh Pi gui ve PC

Tao file rieng:

```bash
cp config.example.json config.pi.json
```

Sua `base_url` thanh IP cua PC:

```json
"pc_server": {
  "base_url": "http://192.168.1.192:9000",
  "endpoint": "/api/detect/batch/",
  "timeout_seconds": 8.0,
  "confidence": 0.25
}
```

Mac dinh Pi se dung YOLOv8 ONNX locator va chi gui anh crop cua trai sau rieng ve PC:

```json
"fruit_crop": {
  "enabled": true,
  "backend": "onnx",
  "model_path": "models/durian_fruit_locator.onnx",
  "confidence": 0.35,
  "iou": 0.45,
  "imgsz": 640,
  "threads": 2,
  "class_ids": [],
  "class_names": [],
  "class_labels": ["durian"],
  "padding_ratio": 0.12,
  "min_area_ratio": 0.03,
  "max_area_ratio": 0.85,
  "min_saturation": 35,
  "min_value": 35,
  "fallback_to_full_frame": false,
  "roi": { "x1": 0.05, "y1": 0.05, "x2": 0.95, "y2": 0.95 }
}
```

- `enabled=true`: Pi tim bbox trai bang backend da chon, crop roi moi gui ve PC.
- `backend="onnx"`: Pi dung ONNX Runtime de chay YOLOv8 locator nhe hon `.pt`.
- `model_path`: duong dan model locator, tinh tu thu muc config neu la duong dan tuong doi.
- `confidence`, `iou`, `imgsz`: tham so inference cua YOLO locator.
- `threads`: so CPU thread cho ONNX Runtime; Pi4 thuong nen de `2`.
- `class_ids`, `class_names`: neu model co nhieu class, dien class cua trai sau rieng vao day. De rong neu moi class trong model deu la trai can crop.
- `class_labels`: ten class theo thu tu class id cua model ONNX, dung de log/debug va filter bang `class_names`.
- `padding_ratio`: them le quanh bbox de khong cat mat gai/vo trai.
- `min_area_ratio`: bo qua vat the qua nho; tang neu bi detect nham nhieu vat nho.
- `max_area_ratio`: bo qua contour qua lon; giam neu nen/conveyor bi lay thanh bbox.
- `roi`: vung camera duoc phep tim trai, tinh theo ty le anh 0..1. Thu hep ROI neu trai luon di qua giua khung hinh.
- `fallback_to_full_frame=false`: neu khong thay trai thi khong gui anh ve PC. Dat `true` neu muon van gui full frame khi crop that bai.

Neu van muon chay `.pt` truc tiep tren Pi, doi `"backend": "yolo"`, doi `model_path` sang `.pt`, va cai them `ultralytics`. Cach nay de thu nghiem nhung nang hon ONNX.

Neu chua muon dung model locator, co the doi `"backend": "opencv"` de dung cach loc anh nhe hon nhung kem chinh xac hon.

Camera USB thuong la:

```json
"cameras": [
  { "id": 0, "name": "camera_0", "source": 0, "enabled": true },
  { "id": 1, "name": "camera_1", "source": 1, "enabled": true }
]
```

Neu camera la RTSP/IP camera, thay `source` bang URL RTSP.

Mac dinh config khai bao 2 camera. Neu hien tai moi co 1 camera, giu nguyen cung duoc: chuong trinh se probe camera truoc khi chay, camera nao khong co frame se bi skip neu `"skip_unavailable_cameras": true`.

## 4. Chay tren Pi

```bash
python pi_runner.py --config config.pi.json
```

Neu muon hien khung camera tren Pi de can chinh goc:

```bash
./start.sh --preview
```

Cua so `camera_x source` hien anh goc va bbox crop. Mac dinh khong hien `camera_x sent` de Pi do lag. Neu can debug anh crop da gui ve PC, dat `"preview_sent": true` trong `config.pi.json`. Nhan `Esc` de dung.

Ket qua detect tu PC se duoc in ra dang JSON line:

```json
{"type":"pc_detection_result","camera_id":0,"sent_image":"crop","crop":{"status":"cropped","bbox":{"x1":120,"y1":80,"x2":450,"y2":410}},"detection_count":1,"detections":[...],"pc_roundtrip_ms":120.5}
```

Neu Pi khong tim thay trai va `fallback_to_full_frame=false`, chuong trinh se in:

```json
{"type":"crop_status","camera_id":0,"status":"skipped","reason":"fruit_not_found"}
```

## 5. Test ONNX voi camera may tinh

Sau khi export duoc `models/durian_fruit_locator.onnx`, co the test realtime tren webcam cua PC truoc khi dua sang Pi:

```bash
pip install -r requirements-camera-test.txt
python test_onnx_camera.py --model models/durian_fruit_locator.onnx --camera 0 --imgsz 640 --conf 0.35
```

Script se mo 2 cua so:

- `ONNX camera test`: anh camera co bbox, FPS va inference time.
- `best crop`: anh crop cua bbox tot nhat, giong anh se gui ve PC khi chay tren Pi.

Nhan `q` hoac `Esc` de dung. Neu camera laptop khong phai index `0`, thu:

```bash
python test_onnx_camera.py --camera 1
```

Neu co bbox nhung nhap nhay/khong bat trai, thu giam confidence:

```bash
python test_onnx_camera.py --conf 0.2
```

## Goi y toi uu

- Giu capture `640x480`, `fps=15`, `jpeg_quality=80-85` de can bang toc do mang va do chinh xac.
- `send_fps_per_camera=2-4` la muc hop ly cho Pi4 voi 2 camera neu PC detect bang YOLO.
- Neu mang yeu, giam `jpeg_quality` xuong `70-75` truoc khi giam do phan giai.
- Khi can can chinh camera/crop, bat `"preview": true`; cua so `camera_x source` se ve bbox crop tren anh goc.
- Neu bbox crop bi lech, thu hep `roi` theo vung trai thuong xuat hien truoc, sau do tinh `min_area_ratio`, `min_saturation`, `min_value`.
- Neu gap loi gui anh, bat `"save_failed_frames": true` de luu frame loi trong `failed_frames/`.

## Endpoint dang dung

Pi gui multipart form toi:

```text
POST http://IP_PC:9000/api/detect/batch/
form:
  slot_index=<camera_id>
  conf=<confidence>
  file=<jpeg crop cua trai>
```

Backend PC se tra ve detection theo tung `slot_index`, dong thoi van publish MQTT trong backend neu phan PC da cau hinh MQTT.
