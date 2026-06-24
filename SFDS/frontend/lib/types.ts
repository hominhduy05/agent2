// ---------------------------------------------------------------------------
// Detection types
// ---------------------------------------------------------------------------
export interface BoundingBox {
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
}

export interface DetectionResponse {
  detections: BoundingBox[];
  image_width: number;
  image_height: number;
  device: string;
  model_format: string;
  detection_count: number;
}

export const CLASS_COLORS: Record<string, string> = {
  defective: "#ef4444",
  immature: "#f59e0b",
  mature: "#22c55e",
};

export const CLASS_LABELS: Record<string, string> = {
  defective: "Hu hong",
  immature: "Chua chin",
  mature: "Chin",
};

export const CLASS_GRADES: Record<string, string> = {
  defective: "C",
  immature: "B",
  mature: "A",
};

export const CLASS_DISPLAY_LABELS: Record<string, string> = {
  defective: "Hư hỏng",
  immature: "Chưa chín",
  mature: "Chín",
};

// ---------------------------------------------------------------------------
// Export grades & actual conditions (for Dataset labeling)
// ---------------------------------------------------------------------------

/** 4 loai xuat khau */
export const EXPORT_GRADES = ["A", "B", "C", "D"] as const;
export type ExportGrade = typeof EXPORT_GRADES[number];

export const EXPORT_COLORS: Record<ExportGrade, string> = {
  A: "#22c55e",
  B: "#16a34a",
  C: "#eab308",
  D: "#ef4444",
};

export const EXPORT_LABELS: Record<ExportGrade, string> = {
  A: "Loai A",
  B: "Loai B",
  C: "Loai C",
  D: "Loai D",
};

/** 5 tinh trang thuc te */
export const ACTUAL_CONDITIONS = ["Xanh", "Suong", "Chin", "Sau ray", "Hu"] as const;
export type ActualCondition = typeof ACTUAL_CONDITIONS[number];

export const CONDITION_COLORS: Record<ActualCondition, string> = {
  Xanh: "#22c55e",
  Suong: "#15803d",
  Chin: "#eab308",
  "Sau ray": "#dc2626",
  Hu: "#b91c1c",
};

/** Mapping tinh trang thuc te → loai xuat khau */
export const CONDITION_TO_GRADE: Record<ActualCondition, ExportGrade> = {
  Xanh: "A",
  Suong: "B",
  Chin: "C",
  "Sau ray": "D",
  Hu: "D",
};
