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
  Xanh: '#3b82f6',
  Sượng: '#f59e0b',
  Chín: '#10b981',
  'Sâu rầy': '#ef4444',
  Hư: '#dc2626',
  A: '#10b981',
  B: '#059669',
  C: '#d97706',
  D: '#ef4444',
  mature: '#10b981',
  immature: '#f59e0b',
  defective: '#ef4444',
  unknown: '#64748b',
};

export const CLASS_BADGE_COLORS: Record<
  string,
  'primary' | 'warning' | 'success' | 'error' | 'info' | 'light' | 'dark'
> = {
  Xanh: 'info',
  Sượng: 'warning',
  Chín: 'success',
  'Sâu rầy': 'error',
  Hư: 'error',
  A: 'success',
  B: 'success',
  C: 'warning',
  D: 'error',
  mature: 'success',
  immature: 'warning',
  defective: 'error',
  unknown: 'light',
};
