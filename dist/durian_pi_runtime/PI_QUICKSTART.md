# Durian Pi Runtime - Quickstart

## 1. Giai nen goi tren Raspberry Pi

```bash
unzip durian_pi_runtime.zip
cd durian_pi_runtime
```

## 2. Chay lan dau

```bash
chmod +x start.sh health_check.sh
./start.sh
```

Lan dau script se:

- tao `config.pi.json` neu chua co
- hoi IP may PC dang chay backend port `9000`
- tao `.venv`
- cai dependencies
- load `models/durian_fruit_locator.onnx`
- chay camera va gui crop ve PC

Neu Raspberry Pi bao loi `externally-managed-environment`, thu muc `.venv` cu co the da bi tao loi hoac thieu pip. Chay:

```bash
rm -rf .venv
sudo apt update
sudo apt install -y python3-venv python3-full python3-opencv
./start.sh --preview
```

Neu muon hien khung camera de can chinh goc tren man hinh Pi:

```bash
./start.sh --preview
```

Nhan `Esc` trong cua so preview de dung.

Mac dinh preview chi hien `camera_x source` de nhe Pi. Neu can debug anh crop da gui di, sua `config.pi.json`:

```json
"preview_sent": true
```

## 3. Kiem tra nhanh

Sau khi `./start.sh` da cai xong moi truong, co the test:

```bash
./health_check.sh
```

Neu camera khong phai index `0`:

```bash
CAMERA_INDEX=1 ./health_check.sh
```

## 4. Chay cac lan sau

```bash
./start.sh
```

## 5. Sua cau hinh

Mo:

```bash
nano config.pi.json
```

Cac muc hay can sua:

- `pc_server.base_url`: IP may PC, vi du `http://192.168.1.50:9000`
- `fruit_crop.confidence`: giam xuong `0.2` neu kho bat trai
- `preview`: dat `true` neu co man hinh GUI va muon xem bbox/crop
- `preview_sent`: mac dinh `false`; chi bat khi can xem cua so crop da gui ve PC
- `skip_unavailable_cameras`: dat `true` de camera nao chua cam thi tu bo qua
- `cameras[0].source`: camera index hoac RTSP URL

Mac dinh cau hinh co san 2 camera. Neu moi cam 1 camera, chuong trinh se chay camera co san va bo qua camera con lai.

## 6. Luong xu ly

```text
Camera Pi -> ONNX detect trai sau rieng -> crop bbox -> POST crop ve PC -> PC phan loai
```
