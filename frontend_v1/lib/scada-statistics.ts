import { getScadaManager } from '@/lib/scada-manager';

import { getGrade, calculateFinalGrade, type Grade } from './fruit-grade';

export type FruitCameraResult = {
  cameraId: number;
  grade: Grade;
  weight: number | null;
  confidence: number | null;

  image?: string | null;
};

export type FruitStatistics = {
  fruitId: string;
  room: string;
  createdAt: string;
  cameras: FruitCameraResult[];
  finalGrade: Grade;
  weight: number;
};

export interface FruitSession {
  fruitId: string;

  roomId: number;

  createdAt: number;

  updatedAt: number;

  cameras: FruitCameraResult[];

  finalGrade: Grade;

  weight: number;
}

const CAMERAS_PER_ROOM = 5;

function getRoom(cameraId: number) {
  return Math.floor((cameraId - 1) / CAMERAS_PER_ROOM) + 1;
}

function getRoomName(cameraId: number) {
  return `BUỒNG ${getRoom(cameraId)}`;
}

function getCameraPosition(cameraId: number) {
  return ((cameraId - 1) % CAMERAS_PER_ROOM) + 1;
}

function normalizeCameraId(camera: any, index: number) {
  if (typeof camera.id === 'number') {
    return camera.id + 1;
  }

  return index + 1;
}

function createEmptyCamera(cameraId: number): FruitCameraResult {
  return {
    cameraId,
    grade: null,
    weight: null,
    confidence: null,
  };
}

/**
 * Ưu tiên global id nếu backend có
 */
function getMergeKey(d: any, cameraId: number) {
  if (d.global_track_id != null) {
    return `global-${d.global_track_id}`;
  }

  if (d.fruit_id != null) {
    return `fruit-${d.fruit_id}`;
  }

  /**
   * fallback
   * tránh bị trùng display_id giữa các buồng
   */
  const room = getRoom(cameraId);

  return `room-${room}-${d.display_id}`;
}

export function getSystemStatistics() {
  const manager = getScadaManager();

  const fruits = new Map<string, FruitStatistics>();

  manager.cameras.forEach((camera: any, index: number) => {
    const cameraId = normalizeCameraId(camera, index);

    camera.inspectionHistory?.forEach((session: any) => {
      session.detections?.forEach((d: any) => {
        const fruitId = getMergeKey(d, cameraId);

        const grade = getGrade(d);

        let fruit = fruits.get(fruitId);

        if (!fruit) {
          fruit = {
            fruitId,

            room: getRoomName(cameraId),

            createdAt: session.timestamp
              ? new Date(session.timestamp).toISOString()
              : new Date().toISOString(),

            cameras: Array.from(
              {
                length: CAMERAS_PER_ROOM,
              },
              (_, i) => createEmptyCamera(i + 1)
            ),

            finalGrade: null,

            weight: 0,
          };
        }

        const camIndex = getCameraPosition(cameraId) - 1;

        const existing = fruit.cameras[camIndex];

        fruit.cameras[camIndex] = {
          cameraId: camIndex + 1,
          grade,
          weight:
            existing?.weight ??
            (d.weight_kg != null
              ? Number(d.weight_kg)
              : Number(pseudoRandom(`${cameraId}-${d.display_id}`).toFixed(2))),
          confidence:
            d.confidence != null
              ? Number(d.confidence)
              : (existing?.confidence ?? null),
          image:
            existing?.image ??
            d.image ??
            d.frame_url ??
            `https://picsum.photos/300/200?random=${cameraId}-${d.display_id}`,
        };

        // fruit.cameras[camIndex] = {
        //   cameraId: camIndex + 1,

        //   grade,

        //   weight: d.weight_kg != null ? Number(d.weight_kg) : null,

        //   image: d.image ?? d.frame_url ?? null
        // };

        fruit.finalGrade = calculateFinalGrade(
          fruit.cameras.map((c) => c.grade)
        );

        // const weights = fruit.cameras
        //   .map((c) => c.weight)
        //   .filter((x): x is number => typeof x === 'number' && x > 0);

        // fruit.weight =
        //   weights.length > 0
        //     ? Number(
        //         (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2)
        //       )
        //     : 0;

        const validWeights = fruit.cameras
          .map((c) => c.weight)
          .filter((x): x is number => typeof x === 'number' && x > 0);

        if (validWeights.length === 0) {
          fruit.weight = 0;
        } else {
          const sum = validWeights.reduce((a, b) => a + b, 0);
          fruit.weight = Number((sum / validWeights.length).toFixed(2));
        }

        fruits.set(fruitId, fruit);
      });
    });
  });

  return Array.from(fruits.values()).sort((a, b) => {
    const roomA = Number(a.room.replace('BUỒNG ', ''));

    const roomB = Number(b.room.replace('BUỒNG ', ''));

    if (roomA !== roomB) {
      return roomA - roomB;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function pseudoRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return (hash % 2000) / 1000 + 0.5; // 0.5 - 2.5 kg
}
