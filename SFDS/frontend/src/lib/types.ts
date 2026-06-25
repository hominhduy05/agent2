// ---------------------------------------------------------------------------
// Detection types (existing)
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
}

export interface DetectionResponse {
  detections: BoundingBox[];
  image_width: number;
  image_height: number;
  device: string;
  model_format: string;
  detection_count: number;
  session_id?: number;
  export_summary?: Record<string, number>;
}

export const CLASS_COLORS: Record<string, string> = {
  defective: "#ef4444",
  immature:  "#f59e0b",
  mature:    "#22c55e",
};

export const CLASS_LABELS: Record<string, string> = {
  defective: "Hư hỏng",
  immature:  "Chưa chín",
  mature:   "Chín",
};

// ---------------------------------------------------------------------------
// Export grades & actual conditions (for Dataset labeling)
// ---------------------------------------------------------------------------

/** 4 loại xuất khẩu */
export const EXPORT_GRADES = ["A", "B", "C", "D"] as const;
export type ExportGrade = typeof EXPORT_GRADES[number];

export const EXPORT_COLORS: Record<ExportGrade, string> = {
  A: "#22c55e",  // Green  — Xanh
  B: "#16a34a",  // Dark green — Sượng
  C: "#eab308",  // Yellow — Chín ← MÀU VÀNG
  D: "#ef4444",  // Red — Sâu rầy / Hư ← MÀU ĐỎ
};

export const EXPORT_LABELS: Record<ExportGrade, string> = {
  A: "Loại A",
  B: "Loại B",
  C: "Loại C",
  D: "Loại D",
};

/** 5 tình trạng thực tế */
export const ACTUAL_CONDITIONS = ["Xanh", "Sượng", "Chín", "Sâu rầy", "Hư"] as const;
export type ActualCondition = typeof ACTUAL_CONDITIONS[number];

export const CONDITION_COLORS: Record<ActualCondition, string> = {
  Xanh:     "#22c55e",  // Green
  Sượng:    "#15803d",  // Dark green
  Chín:     "#eab308",  // Yellow
  "Sâu rầy": "#dc2626", // Red-orange
  Hư:       "#b91c1c",  // Dark red
};

/** Mapping tình trạng thực tế → loại xuất khẩu */
export const CONDITION_TO_GRADE: Record<ActualCondition, ExportGrade> = {
  Xanh:      "A",
  Sượng:     "B",
  Chín:      "C",
  "Sâu rầy": "D",
  Hư:        "D",
};

/** Legacy grade names kept for compatibility with existing dataset code */
export const LEGACY_GRADES = ["A", "B", "C"] as const;
export const LEGACY_GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#f59e0b",
  C: "#ef4444",
};

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "accountant" | "inspector";
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Employee types
// ---------------------------------------------------------------------------
export interface Employee {
  id: number;
  username: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "accountant" | "inspector";
  is_active: boolean;
  created_at: string;
}

export interface EmployeeCreate {
  username: string;
  password: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "accountant" | "inspector";
}

// ---------------------------------------------------------------------------
// Session / Inspection types
// ---------------------------------------------------------------------------
export interface InspectionSession {
  id: number;
  employee_id: number;
  timestamp: string;
  total_inspected: number;
  mature_count: number;
  immature_count: number;
  defective_count: number;
  avg_confidence: number;
  device: string;
  notes?: string;
  employee_name?: string;
}

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------
export interface KPITarget {
  id: number;
  metric_name: string;
  display_name: string;
  target_value: number;
  period: "daily" | "weekly" | "monthly";
  unit: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------
export interface DailyBreakdown {
  date: string;
  total: number;
  mature: number;
  immature: number;
  defective: number;
}

export interface SummaryReport {
  total_inspected: number;
  mature_count: number;
  immature_count: number;
  defective_count: number;
  quality_rate: number;
  avg_confidence: number;
  period: "daily" | "weekly" | "monthly";
  start_date: string;
  end_date: string;
  daily_breakdown: DailyBreakdown[];
}

export interface EmployeeReport extends Employee {
  period: string;
  start_date: string;
  end_date: string;
  total_inspected: number;
  mature_count: number;
  immature_count: number;
  defective_count: number;
  quality_rate: number;
  avg_confidence: number;
  session_count: number;
  kpi_target: number | null;
  kpi_progress: number | null;
}

// ---------------------------------------------------------------------------
// Dashboard aggregate types
// ---------------------------------------------------------------------------
export interface DashboardStats {
  totalToday: number;
  qualityRate: number;
  avgPerHour: number;
  kpiProgress: number;
  employeeCount: number;
}
