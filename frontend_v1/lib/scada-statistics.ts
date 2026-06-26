import { getScadaManager } from '@/lib/scada-manager';

import {
  getGrade,
  calculateFinalGrade,
  type Grade,
} from './fruit-grade';

export type FruitCameraResult = {
  cameraId: number;
  grade: Grade;
  weight: number | null;
  confidence: number | null;
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

function normalizeCameraId(
  camera: any,
  index: number
) {
  if (typeof camera.id === 'number') {
    return camera.id + 1;
  }

  return index + 1;
}

function createEmptyCamera(
  cameraId: number
): FruitCameraResult {
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
function getMergeKey(
  d: any,
  cameraId: number
) {
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

  const fruits = new Map<
    string,
    FruitStatistics
  >();

  manager.cameras.forEach(
    (camera: any, index: number) => {
      const cameraId =
        normalizeCameraId(
          camera,
          index
        );

      camera.inspectionHistory?.forEach(
        (session: any) => {
          session.detections?.forEach(
            (d: any) => {
              const fruitId =
                getMergeKey(
                  d,
                  cameraId
                );

              const grade =
                getGrade(d);

              let fruit =
                fruits.get(fruitId);

              if (!fruit) {
                fruit = {
                  fruitId,

                  room:
                    getRoomName(
                      cameraId
                    ),

                  createdAt:
                    session.timestamp
                      ? new Date(
                          session.timestamp
                        ).toISOString()
                      : new Date().toISOString(),

                  cameras:
                    Array.from(
                      {
                        length:
                          CAMERAS_PER_ROOM,
                      },
                      (_, i) =>
                        createEmptyCamera(
                          i + 1
                        )
                    ),

                  finalGrade: null,

                  weight: 0,
                };
              }

              const camIndex =
                getCameraPosition(
                  cameraId
                ) - 1;

              fruit.cameras[
                camIndex
              ] = {
                cameraId:
                  camIndex + 1,

                grade,

                weight:
                  d.weight_kg !=
                  null
                    ? Number(
                        d.weight_kg
                      )
                    : null,

                confidence:
                  d.confidence !=
                  null
                    ? Number(
                        d.confidence
                      )
                    : null,
              };

              fruit.finalGrade =
                calculateFinalGrade(
                  fruit.cameras.map(
                    (c) =>
                      c.grade
                  )
                );

              const weights =
                fruit.cameras
                  .map(
                    (c) =>
                      c.weight
                  )
                  .filter(
                    (
                      x
                    ): x is number =>
                      typeof x ===
                        'number' &&
                      x > 0
                  );

              fruit.weight =
                weights.length > 0
                  ? Number(
                      (
                        weights.reduce(
                          (
                            a,
                            b
                          ) => a + b,
                          0
                        ) /
                        weights.length
                      ).toFixed(2)
                    )
                  : 0;

              fruits.set(
                fruitId,
                fruit
              );
            }
          );
        }
      );
    }
  );

  return Array.from(
    fruits.values()
  ).sort((a, b) => {
    const roomA = Number(
      a.room.replace(
        'BUỒNG ',
        ''
      )
    );

    const roomB = Number(
      b.room.replace(
        'BUỒNG ',
        ''
      )
    );

    if (roomA !== roomB) {
      return roomA - roomB;
    }

    return (
      new Date(
        b.createdAt
      ).getTime() -
      new Date(
        a.createdAt
      ).getTime()
    );
  });
}