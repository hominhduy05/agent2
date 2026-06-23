import { ScadaCameraManager, CameraChannel } from './scada-camera';

let manager: ScadaCameraManager | null = null;

export function getScadaManager(onUpdate?: (camera: CameraChannel) => void) {
  if (!manager) {
    manager = new ScadaCameraManager(5, onUpdate || (() => {}));
  } else if (onUpdate) {
    // If a manager already exists, allow callers to attach/update their update callback
    // so pages that mount later (detail page) receive camera updates.
    manager.setOnUpdate?.(onUpdate);
  }

  return manager;
}
