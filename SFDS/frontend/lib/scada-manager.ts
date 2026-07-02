import { ScadaCameraManager, CameraChannel } from './scada-camera';
import { getGrade } from './fruit-grade';
import { fruitStore } from './scada-fruit-store';
import { computeStats, toAnalyticsEvent } from './scada-analytics';
import { getRoomIdByCameraIndex } from './scada-room-session';

let manager: ScadaCameraManager | null = null;

function exposeDev(instance: ScadaCameraManager | null) {
  if (
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined'
  ) {
    (window as any).__SCADA_MANAGER__ = instance;
  }
}


function pushFruitRealtime(
  cameraIndex: number,
  result: any
) {
  (result.detections || []).forEach((d: any) => {
    if (!d.fruit_id) return;

    fruitStore.upsert({
      fruitId: d.fruit_id,
      roomId: getRoomIdByCameraIndex(cameraIndex),
      cameraId: cameraIndex + 1,
      grade: getGrade(d),
      weight: d.weight_kg ?? 0,
      confidence: d.confidence ?? null,
    });
  });
}

export function getScadaManager(
  onUpdate?: (camera: CameraChannel) => void
) {
  if (!manager) {
    manager = new ScadaCameraManager(5, onUpdate);

    exposeDev(manager);
  } else if (onUpdate) {
    manager.setOnUpdate(onUpdate);
  }

  return manager;
}

export function pushFrameResult(
  cam: any,
  result: any
) {
  const manager = getScadaManager();

  result.camera_id = cam.id;

  result.detections = (result.detections || []).map(
    (d: any) => {
      const weight =
        d.weight_kg === undefined || Number.isNaN(d.weight_kg)
          ? null
          : d.weight_kg;
      return {
        ...d,
        camera_id: cam.id,
        weight_kg: weight,
      };
    }
  );

  cam.result = result;

  // Realtime fruit store
  pushFruitRealtime(cam.id - 1, result);

  // Analytics
  const event = toAnalyticsEvent(
    cam.id,
    result
  );

  if (!cam.analytics) {
    cam.analytics = {
      events: [],
    };
  }

  cam.analytics.events.push(event);

  if (cam.analytics.events.length > 500) {
    cam.analytics.events.shift();
  }

  cam.analytics.stats = computeStats(
    cam.analytics.events
  );
}
