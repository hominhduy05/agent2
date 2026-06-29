export type Grade = 'A' | 'B' | 'C' | 'D';

export interface FruitCameraResult {
  cameraId: number;
  grade: Grade;
  image: string;
}

export interface FruitDetail {
  fruitId: string;
  scanTime: number;
  finalGrade?: Grade;
  cameras: FruitCameraResult[];
}

const STORAGE_KEY = 'fruit-history';

type Listener = () => void;

export class FruitStore {
  private fruits = new Map<string, FruitDetail>();
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /* =========================
     PERSISTENCE
  ==========================*/
  private load() {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const arr: FruitDetail[] = JSON.parse(raw);

      arr.forEach((fruit) => {
        this.fruits.set(fruit.fruitId, fruit);
      });
    } catch (err) {
      console.warn('FruitStore load failed:', err);
    }
  }

  private save() {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(this.fruits.values()))
    );
  }

  /* =========================
     EVENT SYSTEM (REALTIME)
  ==========================*/
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /* =========================
     QUERY
  ==========================*/
  getAll() {
    return Array.from(this.fruits.values()).sort(
      (a, b) => b.scanTime - a.scanTime
    );
  }

  get(fruitId: string) {
    return this.fruits.get(fruitId);
  }

  /* =========================
     UPSERT CAMERA RESULT
  ==========================*/
  addCameraResult(
    fruitId: string,
    cameraId: number,
    grade: Grade,
    image: string
  ) {
    let fruit = this.fruits.get(fruitId);

    if (!fruit) {
      fruit = {
        fruitId,
        scanTime: Date.now(),
        cameras: [],
      };

      this.fruits.set(fruitId, fruit);
    }

    const cam = fruit.cameras.find(
      (x) => x.cameraId === cameraId
    );

    if (cam) {
      cam.grade = grade;
      cam.image = image;
    } else {
      fruit.cameras.push({
        cameraId,
        grade,
        image,
      });
    }

    if (fruit.cameras.length >= 5) {
      fruit.finalGrade = this.aggregateGrade(
        fruit.cameras.map((x) => x.grade)
      );
    }

    this.save();
    this.emit(); // 🔥 realtime update
  }

  /* =========================
     GRADE AGGREGATION
  ==========================*/
  private aggregateGrade(grades: Grade[]): Grade {
  const count: Record<Grade, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  for (const g of grades) {
    count[g]++;
  }

  // 1. D luôn ưu tiên fail
  if (count.D > 0) return 'D';

  const entries = (['A', 'B', 'C'] as Grade[])
    .map((g) => [g, count[g]] as const)
    .sort((a, b) => b[1] - a[1]);

  const topCount = entries[0][1];
  const top = entries.filter((x) => x[1] === topCount);

  // 2. majority clear win
  if (top.length === 1) return top[0][0];

  // 3. tie → lấy grade "xấu nhất"
  const priority: Record<Grade, number> = {
    A: 3,
    B: 2,
    C: 1,
    D: 0,
  };

  return top.sort((a, b) => priority[a[0]] - priority[b[0]])[0][0];
}

  /* =========================
     DEV HELP
  ==========================*/
  clear() {
    this.fruits.clear();
    this.save();
    this.emit();
  }
}

/* =========================
   SINGLETON
=========================*/
export const fruitStore = new FruitStore();