export interface DetectionHistoryItem {
  id: string;
  timestamp: string;
  slotIndex: number;
  cameraName: string;
  imageWidth: number;
  imageHeight: number;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_name: string;
    track_id?: number | null;
  }>;
  device: string;
  model_format: string;
  avgConfidence: number;
}

export const CLASS_COLORS: Record<string, string> = {
  "Xanh": "#3b82f6",       // Blue (unripe)
  "Sượng": "#f59e0b",      // Amber (uneven)
  "Chín": "#10b981",       // Green (ripe)
  "Sâu rầy": "#ef4444",    // Red (pest)
  "Hư": "#dc2626",         // Dark red (damaged)
  "A": "#10b981",
  "B": "#059669",
  "C": "#d97706",
  "D": "#ef4444",
  "mature": "#10b981",
  "immature": "#f59e0b",
  "defective": "#ef4444",
  "unknown": "#64748b",
};

export const CLASS_BADGE_COLORS: Record<string, 'primary' | 'warning' | 'success' | 'error' | 'info' | 'light' | 'dark'> = {
  "Xanh": "info",
  "Sượng": "warning",
  "Chín": "success",
  "Sâu rầy": "error",
  "Hư": "error",
  "A": "success",
  "B": "success",
  "C": "warning",
  "D": "error",
  "mature": "success",
  "immature": "warning",
  "defective": "error",
  "unknown": "light",
};

export const MOCK_HISTORY_DATA: DetectionHistoryItem[] = [
  {
    id: "DET-20260629-001",
    timestamp: "2026-06-29T14:15:30+07:00",
    slotIndex: 0,
    cameraName: "Camera Buồng 1 (Lối vào A)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 91,
    detections: [
      { x1: 120, y1: 150, x2: 280, y2: 320, confidence: 0.94, class_name: "Chín", track_id: 101 },
      { x1: 340, y1: 180, x2: 490, y2: 350, confidence: 0.88, class_name: "Sượng", track_id: 102 }
    ]
  },
  {
    id: "DET-20260629-002",
    timestamp: "2026-06-29T13:40:22+07:00",
    slotIndex: 1,
    cameraName: "Camera Buồng 1 (Lối vào B)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 93,
    detections: [
      { x1: 200, y1: 100, x2: 450, y2: 380, confidence: 0.93, class_name: "Chín", track_id: 103 }
    ]
  },
  {
    id: "DET-20260629-003",
    timestamp: "2026-06-29T12:10:05+07:00",
    slotIndex: 2,
    cameraName: "Camera Buồng 2 (Kiểm định 1)",
    imageWidth: 640,
    imageHeight: 480,
    device: "CPU - Server Local",
    model_format: "YOLOv8s ONNX",
    avgConfidence: 96,
    detections: [
      { x1: 150, y1: 120, x2: 380, y2: 390, confidence: 0.96, class_name: "Xanh", track_id: 104 }
    ]
  },
  {
    id: "DET-20260629-004",
    timestamp: "2026-06-29T10:05:44+07:00",
    slotIndex: 0,
    cameraName: "Camera Buồng 1 (Lối vào A)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 81,
    detections: [
      { x1: 100, y1: 140, x2: 260, y2: 300, confidence: 0.88, class_name: "Sâu rầy", track_id: 105 },
      { x1: 300, y1: 160, x2: 520, y2: 400, confidence: 0.74, class_name: "Hư", track_id: 106 }
    ]
  },
  {
    id: "DET-20260628-001",
    timestamp: "2026-06-28T17:30:15+07:00",
    slotIndex: 3,
    cameraName: "Camera Buồng 2 (Kiểm định 2)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 82,
    detections: [
      { x1: 180, y1: 130, x2: 420, y2: 370, confidence: 0.82, class_name: "Sượng", track_id: 98 }
    ]
  },
  {
    id: "DET-20260628-002",
    timestamp: "2026-06-28T16:15:00+07:00",
    slotIndex: 1,
    cameraName: "Camera Buồng 1 (Lối vào B)",
    imageWidth: 640,
    imageHeight: 480,
    device: "CPU - Server Local",
    model_format: "YOLOv8s ONNX",
    avgConfidence: 93,
    detections: [
      { x1: 80, y1: 100, x2: 280, y2: 310, confidence: 0.95, class_name: "Chín", track_id: 99 },
      { x1: 320, y1: 120, x2: 560, y2: 390, confidence: 0.91, class_name: "Xanh", track_id: 100 }
    ]
  },
  {
    id: "DET-20260628-003",
    timestamp: "2026-06-28T11:20:45+07:00",
    slotIndex: 4,
    cameraName: "Camera Buồng 3 (Đóng gói)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 89,
    detections: [
      { x1: 140, y1: 160, x2: 400, y2: 410, confidence: 0.89, class_name: "Chín", track_id: 95 }
    ]
  }
];
