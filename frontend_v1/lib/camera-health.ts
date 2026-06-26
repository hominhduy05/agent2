import { getScadaManager } from './scada-manager';

const OFFLINE_TIMEOUT = 10000;

export function getCameraHealth() {
  const manager = getScadaManager();

  return manager.cameras.map((cam: any, index: number) => {
    const lastDetection =
      cam.inspectionHistory?.[
        cam.inspectionHistory.length - 1
      ];

    const lastTime = lastDetection?.timestamp
      ? new Date(lastDetection.timestamp).getTime()
      : 0;

    const now = Date.now();

    const diff = now - lastTime;

    let status = 'OFFLINE';

    if (cam.stream) {
      status = 'ONLINE';
    }

    if (
      cam.stream &&
      diff > OFFLINE_TIMEOUT
    ) {
      status = 'IDLE';
    }

    return {
      cameraId: index + 1,

      room:
        Math.floor(index / 5) + 1,

      status,

      detections:
        cam.inspectionHistory?.reduce(
          (acc: number, s: any) =>
            acc +
            (s.detections?.length || 0),
          0
        ) || 0,

      lastSeen: lastTime,

      mode: cam.mode,

      resolution:
        `${cam.width || 0}x${cam.height || 0}`,
    };
  });
}