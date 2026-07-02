import type { AuditDetectionEvent } from '@/lib/api';
import { calculateFinalGrade, getGrade, type Grade } from './fruit-grade';

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

function createEmptyCamera(cameraId: number): FruitCameraResult {
  return {
    cameraId,
    grade: null,
    weight: null,
    confidence: null,
  };
}

function getCameraId(event: AuditDetectionEvent) {
  return Number(event.camera_slot ?? 0) + 1;
}

function getFruitKey(event: AuditDetectionEvent, cameraId: number) {
  if (event.fruit_id) return event.fruit_id;
  if (event.track_id !== null && event.track_id !== undefined) {
    return `room-${getRoom(cameraId)}-track-${event.track_id}`;
  }
  return event.event_id;
}

function getEventWeight(event: AuditDetectionEvent) {
  if (typeof event.weight_kg === 'number' && event.weight_kg > 0) {
    return Number(event.weight_kg.toFixed(2));
  }

  const scaleWeight = Number(event.scale?.weight_kg ?? event.scale?.weight);
  if (Number.isFinite(scaleWeight) && scaleWeight > 0) {
    return Number(scaleWeight.toFixed(2));
  }

  return null;
}

function getEventGrade(event: AuditDetectionEvent): Grade {
  return getGrade({
    final_grade: event.final_grade,
    class_name: event.final_grade || event.class_name,
    weight_kg: event.weight_kg,
  });
}

export function mapAuditEventsToFruitStatistics(
  events: AuditDetectionEvent[]
): FruitStatistics[] {
  const fruits = new Map<string, FruitStatistics>();

  for (const event of events) {
    const cameraId = getCameraId(event);
    const fruitId = getFruitKey(event, cameraId);
    const camIndex = getCameraPosition(cameraId) - 1;

    let fruit = fruits.get(fruitId);
    if (!fruit) {
      fruit = {
        fruitId,
        room: getRoomName(cameraId),
        createdAt: event.timestamp || new Date().toISOString(),
        cameras: Array.from({ length: CAMERAS_PER_ROOM }, (_, i) =>
          createEmptyCamera(i + 1)
        ),
        finalGrade: null,
        weight: 0,
      };
    }

    const existing = fruit.cameras[camIndex];
    fruit.cameras[camIndex] = {
      cameraId: camIndex + 1,
      grade: getEventGrade(event),
      weight: getEventWeight(event) ?? existing?.weight ?? null,
      confidence: event.confidence ?? existing?.confidence ?? null,
      image: event.image_path ?? existing?.image ?? null,
    };

    fruit.finalGrade = calculateFinalGrade(fruit.cameras.map((c) => c.grade));

    const validWeights = fruit.cameras
      .map((c) => c.weight)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    fruit.weight =
      validWeights.length > 0
        ? Number(
            (
              validWeights.reduce((sum, value) => sum + value, 0) /
              validWeights.length
            ).toFixed(2)
          )
        : 0;

    fruits.set(fruitId, fruit);
  }

  return Array.from(fruits.values()).sort((a, b) => {
    const roomA = Number(a.room.replace('BUỒNG ', ''));
    const roomB = Number(b.room.replace('BUỒNG ', ''));
    if (roomA !== roomB) return roomA - roomB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getSystemStatistics() {
  return [];
}
