export type AnalyticsEventType =
  | 'camera_started'
  | 'camera_stopped'
  | 'camera_error'
  | 'detection'
  | 'capture'
  | 'reconnect'
  | 'warning';

export interface AnalyticsEvent {
  id: string;

  cameraId: number;

  type: AnalyticsEventType;

  timestamp: number;

  message: string;

  metadata?: Record<string, unknown>;
}

export function createAnalyticsEvent(
  cameraId: number,
  type: AnalyticsEventType,
  message: string,
  metadata?: Record<string, unknown>
): AnalyticsEvent {
  return {
    id: crypto.randomUUID(),

    cameraId,

    type,

    message,

    metadata,

    timestamp: Date.now(),
  };
}

export function getEventColor(type: AnalyticsEventType) {
  switch (type) {
    case 'camera_started':
      return 'text-green-500';

    case 'camera_stopped':
      return 'text-gray-500';

    case 'camera_error':
      return 'text-red-500';

    case 'capture':
      return 'text-blue-500';

    case 'reconnect':
      return 'text-yellow-500';

    case 'warning':
      return 'text-orange-500';

    default:
      return 'text-slate-500';
  }
}