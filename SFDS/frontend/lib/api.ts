const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export async function detectImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/detect/`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Detection failed");
  return res.json();
}

// ---------------------------------------------------------------------------
// SCADA — IP Camera (RTSP) support
// ---------------------------------------------------------------------------

export interface ScadaCameraSlot {
  slot: number;
  url: string;
  online: boolean;
}

export interface ScadaCameraConfig {
  cameras: Record<string, ScadaCameraSlot>;
}

export async function getScadaCameras(): Promise<ScadaCameraConfig> {
  const res = await fetch(`${API_BASE}/api/scada/cameras/`);
  if (!res.ok) throw new Error("Khong the lay cau hinh camera");
  return res.json();
}

export async function configScadaCameras(cameras: Record<string, string>) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cameras }),
  });
  if (!res.ok) throw new Error("Khong the luu cau hinh camera");
  return res.json();
}

export async function startScadaCamera(slot: number) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/${slot}/start/`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Loi bat camera");
  return res.json();
}

export async function stopScadaCamera(slot: number) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/${slot}/stop/`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Khong the tat camera");
  return res.json();
}

export async function fetchScadaFrame(slot: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/scada/frame/${slot}/`);
  if (!res.ok) throw new Error("Loi doc frame");
  return res.blob();
}

export interface ScadaDetectionResult {
  results: Array<{
    slot_index: number;
    detections: Array<{
      x1: number; y1: number; x2: number; y2: number;
      confidence: number; class_id: number; class_name: string;
    }>;
    image_width: number;
    image_height: number;
    model_format: string;
    detection_count: number;
    unique_mature: number;
    unique_immature: number;
    unique_defective: number;
    track_ids: number[];
  }>;
  total_unique_objects: number;
  timestamp: string;
}

export async function detectScadaCamera(slot: number, conf = 0.25): Promise<ScadaDetectionResult> {
  const res = await fetch(`${API_BASE}/api/scada/detect/${slot}/?conf=${conf}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Loi nhan dien");
  return res.json();
}

export interface WebcamDetectResult {
  detections: Array<{
    x1: number; y1: number; x2: number; y2: number;
    confidence: number; class_id: number; class_name: string;
  }>;
  image_width: number;
  image_height: number;
  model_format: string;
  detection_count: number;
}

export async function detectWebcamFrame(imageBlob: Blob, conf = 0.25): Promise<WebcamDetectResult> {
  const formData = new FormData();
  formData.append("file", imageBlob, "capture.jpg");
  const res = await fetch(`${API_BASE}/detect/?conf=${conf}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Loi nhan dien webcam");
  return res.json();
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export async function saveFaceDataset(payload: {
  face: string;
  grade: string;
  condition: string;
  file: File;
  boxes?: string;
  img_width?: number;
  img_height?: number;
}) {
  const formData = new FormData();
  formData.append("face", payload.face);
  formData.append("grade", payload.grade);
  formData.append("condition", payload.condition);
  formData.append("file", payload.file);
  if (payload.boxes) formData.append("boxes", payload.boxes);
  if (payload.img_width !== undefined) formData.append("img_width", String(payload.img_width));
  if (payload.img_height !== undefined) formData.append("img_height", String(payload.img_height));
  const res = await fetch(`${API_BASE}/api/dataset/save-face/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Loi luu dataset");
  return res.json();
}

export async function listDatasetItems(params: {
  category: string;
  cls?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams({ category: params.category });
  if (params.cls) qs.set("cls", params.cls);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`${API_BASE}/api/dataset/items/?${qs}`);
  if (!res.ok) throw new Error("Khong the lay items");
  return res.json();
}

export async function getDatasetStats() {
  const res = await fetch(`${API_BASE}/api/dataset/stats/`);
  if (!res.ok) throw new Error("Khong the lay stats");
  return res.json();
}

export async function deleteDatasetItem(category: string, label: string, filename: string) {
  const res = await fetch(`${API_BASE}/api/dataset/items/${category}/${label}/${filename}/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Loi xoa item");
}

export async function exportDatasetZip(category: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/dataset/export/?category=${category}`);
  if (!res.ok) throw new Error("Loi export ZIP");
  return res.blob();
}

export async function getDatasetYaml(category: string) {
  const res = await fetch(`${API_BASE}/api/dataset/data-yaml/?category=${category}`);
  if (!res.ok) throw new Error("Loi lay yaml");
  return res.json();
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}
