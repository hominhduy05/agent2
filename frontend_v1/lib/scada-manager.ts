// import {
//   ScadaCameraManager,
//   CameraChannel,
// } from './scada-camera';

// let manager: ScadaCameraManager | null = null;

// export function getScadaManager(
//   onUpdate?: (camera: CameraChannel) => void
// ) {
//   if (!manager) {
//     manager = new ScadaCameraManager(
//       5,
//       onUpdate
//     );
//   } else if (onUpdate) {
//     manager.setOnUpdate(onUpdate);
//   }

//   return manager;
// }

// // DEV ONLY
// if (
//   process.env.NODE_ENV === 'development' &&
//   typeof window !== 'undefined'
// ) {
//   (window as any).__SCADA_MANAGER__ = manager;
// }

import { computeStats, toAnalyticsEvent } from './scada-analytics';
import {
  ScadaCameraManager,
  CameraChannel,
} from './scada-camera';

let manager: ScadaCameraManager | null = null;

function exposeDev(managerInstance: ScadaCameraManager | null) {
  if (
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined'
  ) {
    (window as any).__SCADA_MANAGER__ = managerInstance;
  }
}

export function getScadaManager(
  onUpdate?: (camera: CameraChannel) => void
) {
  if (!manager) {
    manager = new ScadaCameraManager(5, onUpdate);

    exposeDev(manager);
  } else {
    if (onUpdate) {
      manager.setOnUpdate(onUpdate);
    }
  }

  return manager;
}

export function pushFrameResult(cam: any, result: any) {
  cam.result = result;

  const event = toAnalyticsEvent(cam.id, result);

  if (!cam.analytics) {
    cam.analytics = { events: [] };
  }

  cam.analytics.events.push(event);

  if (cam.analytics.events.length > 500) {
    cam.analytics.events.shift();
  }

  cam.analytics.stats = computeStats(cam.analytics.events);
}