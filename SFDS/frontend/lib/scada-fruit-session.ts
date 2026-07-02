import { calculateFinalGrade, getGrade, type Grade } from './fruit-grade';

export interface FruitCameraResult {
  cameraId: number;

  grade: Grade;

  weight: number | null;

  confidence: number | null;
}

export interface FruitSession {
  fruitId: string;

  status: 'RUNNING' | 'DONE';

  cameras: FruitCameraResult[];

  finalGrade: Grade;

  weight: number;

  createdAt: number;
}

let currentFruit: FruitSession | null = null;

function emptyCamera(id: number): FruitCameraResult {
  return {
    cameraId: id,
    grade: null,
    weight: null,
    confidence: null,
  };
}

export function createFruitFromCamera1(detection: any) {
  const fruit: FruitSession = {
    fruitId: `F-${Date.now()}`,

    status: 'RUNNING',

    cameras: [
      emptyCamera(1),
      emptyCamera(2),
      emptyCamera(3),
      emptyCamera(4),
      emptyCamera(5),
    ],

    finalGrade: null,

    weight: 0,

    createdAt: Date.now(),
  };

  fruit.cameras[0] = {
    cameraId: 1,

    grade: getGrade(detection),

    weight: detection.weight_kg ?? null,

    confidence: detection.confidence ?? null,
  };

  currentFruit = fruit;

  return fruit;
}

export function updateFruitCamera(cameraId: number, detection: any) {
  if (!currentFruit) return null;

  currentFruit.cameras[cameraId - 1] = {
    cameraId,

    grade: getGrade(detection),

    weight: detection.weight_kg ?? null,

    confidence: detection.confidence ?? null,
  };

  return currentFruit;
}

export function finishFruit() {
  if (!currentFruit) return null;

  currentFruit.finalGrade = calculateFinalGrade(
    currentFruit.cameras.map((c) => c.grade)
  );

  currentFruit.status = 'DONE';

  const result = currentFruit;

  currentFruit = null;

  return result;
}

export function getCurrentFruit() {
  return currentFruit;
}
