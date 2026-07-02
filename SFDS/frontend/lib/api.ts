const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export async function detectImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/detect/`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Detection failed');
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
  if (!res.ok) throw new Error('Khong the lay cau hinh camera');
  return res.json();
}

export async function configScadaCameras(cameras: Record<string, string>) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cameras }),
  });
  if (!res.ok) throw new Error('Khong the luu cau hinh camera');
  return res.json();
}

export async function startScadaCamera(slot: number) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/${slot}/start/`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Loi bat camera');
  return res.json();
}

export async function stopScadaCamera(slot: number) {
  const res = await fetch(`${API_BASE}/api/scada/cameras/${slot}/stop/`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Khong the tat camera');
  return res.json();
}

export async function fetchScadaFrame(slot: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/scada/frame/${slot}/`);
  if (!res.ok) throw new Error('Loi doc frame');
  return res.blob();
}

export interface ScadaDemoMode {
  enabled: boolean;
  same_fruit_window_seconds: number;
  sequence: string[];
}

export async function getScadaDemoMode(): Promise<ScadaDemoMode> {
  const res = await fetch(`${API_BASE}/api/scada/demo-mode/`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Khong the lay che do demo');
  return res.json();
}

export async function setScadaDemoMode(
  enabled: boolean
): Promise<ScadaDemoMode> {
  const res = await fetch(`${API_BASE}/api/scada/demo-mode/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Khong the cap nhat che do demo');
  return res.json();
}

export interface ScadaScaleSnapshot {
  weight_kg: number;
  raw_value: number;
  unit: string;
  stable: boolean;
  fruit_id: string;
  source: string;
  timestamp: number;
  age_seconds: number;
  timestamp_ms: number;
}

export interface ScadaScaleStatus {
  online: boolean;
  latest: ScadaScaleSnapshot | null;
  max_age_seconds: number;
  same_fruit_window_seconds: number;
}

export async function getScadaScale(): Promise<ScadaScaleStatus> {
  const res = await fetch(`${API_BASE}/api/scada/scale/`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Khong the lay du lieu can');
  return res.json();
}

export interface ScadaDetectionResult {
  results: Array<{
    slot_index: number;
    detections: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      confidence: number;
      class_id: number;
      class_name: string;
      polygon?: number[][] | null;
      track_id?: number | null;
      display_id?: number | null;
      weight_kg?: number | null;
      weight_unit?: string | null;
      fruit_id?: string | null;
      scale_age_seconds?: number | null;
      scale_stable?: boolean | null;
      visual_grade?: string | null;
      weight_grade?: string | null;
      final_grade?: string | null;
      classification_source?: string | null;
    }>;
    image_width: number;
    image_height: number;
    model_format: string;
    detection_count: number;
    unique_mature: number;
    unique_immature: number;
    unique_defective: number;
    track_ids: number[];
    scale?: ScadaScaleSnapshot | null;
  }>;
  total_unique_objects: number;
  timestamp: string;
  scale?: ScadaScaleSnapshot | null;
}

export async function detectScadaCamera(
  slot: number,
  conf = 0.25
): Promise<ScadaDetectionResult> {
  const res = await fetch(
    `${API_BASE}/api/scada/detect/${slot}/?conf=${conf}`,
    {
      method: 'POST',
    }
  );
  if (!res.ok) throw new Error('Loi nhan dien');
  return res.json();
}

export interface WebcamDetectResult {
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_id: number;
    class_name: string;
    polygon?: number[][] | null;
    track_id?: number | null;
    display_id?: number | null;
    weight_kg?: number | null;
    weight_unit?: string | null;
    fruit_id?: string | null;
    scale_age_seconds?: number | null;
    scale_stable?: boolean | null;
    visual_grade?: string | null;
    weight_grade?: string | null;
    final_grade?: string | null;
    classification_source?: string | null;
  }>;
  image_width: number;
  image_height: number;
  model_format: string;
  detection_count: number;
  scale?: ScadaScaleSnapshot | null;
}

export async function detectWebcamFrame(
  imageBlob: Blob,
  conf = 0.25
): Promise<WebcamDetectResult> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'capture.jpg');
  const res = await fetch(`${API_BASE}/detect/?conf=${conf}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Loi nhan dien webcam');
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
  formData.append('face', payload.face);
  formData.append('grade', payload.grade);
  formData.append('condition', payload.condition);
  formData.append('file', payload.file);
  if (payload.boxes) formData.append('boxes', payload.boxes);
  if (payload.img_width !== undefined)
    formData.append('img_width', String(payload.img_width));
  if (payload.img_height !== undefined)
    formData.append('img_height', String(payload.img_height));
  const res = await fetch(`${API_BASE}/api/dataset/save-face/`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Loi luu dataset');
  return res.json();
}

export async function listDatasetItems(params: {
  category: string;
  cls?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams({ category: params.category });
  if (params.cls) qs.set('cls', params.cls);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const res = await fetch(`${API_BASE}/api/dataset/items/?${qs}`);
  if (!res.ok) throw new Error('Khong the lay items');
  return res.json();
}

export async function getDatasetStats() {
  const res = await fetch(`${API_BASE}/api/dataset/stats/`);
  if (!res.ok) throw new Error('Khong the lay stats');
  return res.json();
}

export async function deleteDatasetItem(
  category: string,
  label: string,
  filename: string
) {
  const res = await fetch(
    `${API_BASE}/api/dataset/items/${category}/${label}/${filename}/`,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok) throw new Error('Loi xoa item');
}

export async function exportDatasetZip(category: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/dataset/export/?category=${category}`
  );
  if (!res.ok) throw new Error('Loi export ZIP');
  return res.blob();
}

export async function getDatasetYaml(category: string) {
  const res = await fetch(
    `${API_BASE}/api/dataset/data-yaml/?category=${category}`
  );
  if (!res.ok) throw new Error('Loi lay yaml');
  return res.json();
}

// ---------------------------------------------------------------------------
// Audit / offline DB
// ---------------------------------------------------------------------------

export interface AuditDetectionEvent {
  id: number;
  event_id: string;
  timestamp: string | null;
  source: string;
  line_id?: string | null;
  camera_slot?: number | null;
  batch_id?: string | null;
  fruit_id?: string | null;
  track_id?: number | null;
  class_name?: string | null;
  visual_grade?: string | null;
  weight_grade?: string | null;
  final_grade?: string | null;
  confidence?: number | null;
  weight_kg?: number | null;
  detection_count: number;
  raw_detection_count: number;
  image_width?: number | null;
  image_height?: number | null;
  image_path?: string | null;
  quality: Record<string, unknown>;
  scale: Record<string, unknown>;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_name: string;
    track_id?: number | null;
  }>;
  sorting_commands: Array<Record<string, unknown>>;
}

export interface AuditListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditSummary {
  window_hours: number;
  total_detections: number;
  total_sorting_commands: number;
  avg_confidence: number;
  grade_counts: Record<string, number>;
  camera_counts: Record<string, number>;
}

export async function listAuditDetections(params: {
  limit?: number;
  offset?: number;
  camera_slot?: number;
  grade?: string;
  date?: string;
} = {}): Promise<AuditListResponse<AuditDetectionEvent>> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.camera_slot !== undefined)
    qs.set('camera_slot', String(params.camera_slot));
  if (params.grade) qs.set('grade', params.grade);
  if (params.date) qs.set('date', params.date);
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`${API_BASE}/api/audit/detections/${suffix}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Khong the lay lich su nhan dien');
  return res.json();
}

export async function getAuditSummary(hours = 24): Promise<AuditSummary> {
  const res = await fetch(`${API_BASE}/api/audit/summary/?hours=${hours}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Khong the lay tong hop audit');
  return res.json();
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
