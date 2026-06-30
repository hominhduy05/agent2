import { Grade } from './fruit-grade';

export type FruitCameraResult = {
  cameraId: number;
  grade: Grade;
  weight: number | null;
  confidence: number | null;
};

export type FruitSession = {
  fruitId: string;
  roomId: number;
  createdAt: number;
  updatedAt: number;

  cameras: FruitCameraResult[];

  finalGrade: Grade;
  weight: number;
};

const CAMERAS_PER_ROOM = 5;

function emptyCameras(): FruitCameraResult[] {
  return Array.from({ length: CAMERAS_PER_ROOM }, (_, i) => ({
    cameraId: i + 1,
    grade: null,
    weight: null,
    confidence: null,
  }));
}

function calculateFinal(grades: (Grade | null)[]): Grade {
  const valid = grades.filter((g): g is Exclude<Grade, null> => g !== null);

  if (!valid.length) return null;
  if (valid.includes('D')) return 'D';

  const count: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };

  for (const g of valid) {
    if (g !== 'D') count[g]++;
  }

  const majorityThreshold = Math.floor(valid.length / 2) + 1;
  const majority = (['A', 'B', 'C'] as const).find(
    (grade) => count[grade] >= majorityThreshold
  );
  if (majority) return majority;

  return (['C', 'B', 'A'] as const).find((grade) => count[grade] > 0) ?? null;
}

class FruitStore {
  private fruits = new Map<string, FruitSession>();
  private listeners = new Set<(data: FruitSession[]) => void>();

  subscribe(cb: (data: FruitSession[]) => void) {
  this.listeners.add(cb);

  cb(this.getAll());

  return () => {
    this.listeners.delete(cb);
  };
}

  private emit() {
    const data = this.getAll();
    this.listeners.forEach((l) => l(data));
  }

  getAll() {
    return Array.from(this.fruits.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  upsert(params: {
    fruitId: string;
    roomId: number;
    cameraId: number;
    grade: Grade;
    weight: number | null;
    confidence: number | null;
  }) {
    const { fruitId, roomId, cameraId, grade, weight, confidence } = params;

    let fruit = this.fruits.get(fruitId);

    if (!fruit) {
      fruit = {
        fruitId,
        roomId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cameras: emptyCameras(),
        finalGrade: null,
        weight: 0,
      };

      this.fruits.set(fruitId, fruit);
    }

    fruit.updatedAt = Date.now();

    const idx = (cameraId - 1) % CAMERAS_PER_ROOM;

    fruit.cameras[idx] = {
      cameraId,
      grade,
      weight,
      confidence,
    };

    const grades = fruit.cameras.map((c) => c.grade);

    fruit.finalGrade = calculateFinal(grades);

    const weights = fruit.cameras
      .map((c) => c.weight)
      .filter((w): w is number => typeof w === 'number');

    fruit.weight =
      weights.length > 0
        ? Number((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2))
        : 0;

    this.emit();
  }

  reset() {
    this.fruits.clear();
    this.emit();
  }
}

export const fruitStore = new FruitStore();
