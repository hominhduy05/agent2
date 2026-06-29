export interface FruitCameraResult {
  cameraId: number;
  grade: string;
  image: string;
}

export interface FruitDetail {
  fruitId: string;
  scanTime: number;
  finalGrade?: string;

  cameras: FruitCameraResult[];
}

const STORAGE_KEY = 'fruit-history';

export class FruitStore {
  private fruits = new Map<string, FruitDetail>();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    const arr: FruitDetail[] = JSON.parse(raw);

    arr.forEach((fruit) => {
      this.fruits.set(fruit.fruitId, fruit);
    });
  }

  private save() {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(this.fruits.values()))
    );
  }

  getAll() {
    return Array.from(this.fruits.values()).sort(
      (a, b) => b.scanTime - a.scanTime
    );
  }

  get(fruitId: string) {
    return this.fruits.get(fruitId);
  }

  addCameraResult(
    fruitId: string,
    cameraId: number,
    grade: string,
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

    const existed = fruit.cameras.find(
      (x) => x.cameraId === cameraId
    );

    if (!existed) {
      fruit.cameras.push({
        cameraId,
        grade,
        image,
      });
    }

    if (fruit.cameras.length === 5) {
      fruit.finalGrade =
        this.aggregateGrade(
          fruit.cameras.map((x) => x.grade)
        );
    }

    this.save();
  }

  private aggregateGrade(grades: string[]) {
    if (grades.includes('D')) {
      return 'D';
    }

    const count = {
      A: 0,
      B: 0,
      C: 0,
    };

    grades.forEach((g) => {
      if (g in count) {
        count[g as keyof typeof count]++;
      }
    });

    const values = Object.values(count);

    values.sort((a, b) => b - a);

    if (
      values[0] === 2 &&
      values[1] === 2 &&
      values[2] === 1
    ) {
      return 'B';
    }

    return Object.entries(count).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
  }
}

export const fruitStore = new FruitStore();