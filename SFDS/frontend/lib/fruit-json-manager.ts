import { calculateFinalGrade, Grade } from './fruit-grade';

export interface CameraFruit {
  cameraId: number;

  grade: Grade;

  confidence: number;

  weight: number;

  image?: string;
}

export interface FruitJSON {
  id: string;

  room: string;

  createdAt: string;

  finalGrade: Grade;

  weight: number;

  cameras: CameraFruit[];
}

class FruitJSONManager {
  private fruits = new Map<string, FruitJSON>();

  updateCamera(
    fruitId: string,

    room: string,

    cameraId: number,

    data: CameraFruit
  ) {
    let fruit = this.fruits.get(fruitId);

    if (!fruit) {
      fruit = {
        id: fruitId,

        room,

        createdAt: new Date().toISOString(),

        finalGrade: 'C',

        weight: 0,

        cameras: [],
      };
    }

    const index = fruit.cameras.findIndex((x) => x.cameraId === cameraId);

    if (index >= 0) {
      fruit.cameras[index] = data;
    } else {
      fruit.cameras.push(data);
    }

    fruit.finalGrade = calculateFinalGrade(fruit.cameras.map((x) => x.grade));

    fruit.weight =
      fruit.cameras.reduce((s, x) => s + x.weight, 0) / fruit.cameras.length;

    this.fruits.set(fruitId, fruit);
  }

  getAll() {
    return Array.from(this.fruits.values());
  }

  exportJSON() {
    return {
      time: new Date().toISOString(),

      total: this.fruits.size,

      fruits: this.getAll(),
    };
  }
}

export const fruitManager = new FruitJSONManager();
