export type CameraStatus =
  | 'online'
  | 'offline'
  | 'warning'
  | 'error';

export interface CameraHealth {
  status: CameraStatus;

  fps: number;

  latency: number;

  lastFrameAt: number;

  droppedFrames: number;

  reconnectCount: number;

  uptime: number;

  cpuUsage?: number;

  memoryUsage?: number;

  networkQuality?: 'good' | 'medium' | 'poor';

  errorMessage?: string;
}

export const createDefaultHealth = (): CameraHealth => ({
  status: 'offline',

  fps: 0,

  latency: 0,

  lastFrameAt: 0,

  droppedFrames: 0,

  reconnectCount: 0,

  uptime: 0,

  networkQuality: 'good',
});

export function getHealthColor(status: CameraStatus) {
  switch (status) {
    case 'online':
      return '#22c55e';

    case 'warning':
      return '#f59e0b';

    case 'error':
      return '#ef4444';

    default:
      return '#6b7280';
  }
}

export function getHealthLabel(status: CameraStatus) {
  switch (status) {
    case 'online':
      return 'Đang hoạt động';

    case 'warning':
      return 'Cảnh báo';

    case 'error':
      return 'Lỗi';

    default:
      return 'Offline';
  }
}