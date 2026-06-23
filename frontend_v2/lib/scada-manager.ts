import {
  ScadaCameraManager,
  CameraChannel,
} from './scada-camera';

let manager: ScadaCameraManager | null = null;

export function getScadaManager(
  onUpdate?: (camera: CameraChannel) => void
) {
  if (!manager) {
    manager = new ScadaCameraManager(
      5,
      onUpdate
    );
  } else if (onUpdate) {
    manager.setOnUpdate(onUpdate);
  }

  return manager;
}

// DEV ONLY
if (
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined'
) {
  (window as any).__SCADA_MANAGER__ = manager;
}