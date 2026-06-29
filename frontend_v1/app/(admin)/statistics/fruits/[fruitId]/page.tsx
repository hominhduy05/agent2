'use client';

import { fruitStore } from '@/lib/fruit-store';
import { useParams } from 'next/navigation';

export default function FruitDetailPage() {
  const params = useParams();

  const fruit = fruitStore.get(
    params.fruitId as string
  );

  if (!fruit) {
    return <div>Fruit not found</div>;
  }

  const counts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  fruit.cameras.forEach((cam) => {
    counts[cam.grade as keyof typeof counts]++;
  });

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold">
        {fruit.fruitId}
      </h1>

      <div className="mt-4">
        Final Grade:
        <b className="ml-2">
          {fruit.finalGrade}
        </b>
      </div>

      <div>
        Scan Time:
        {new Date(
          fruit.scanTime
        ).toLocaleString()}
      </div>

      <div className="grid grid-cols-5 gap-4 mt-8">

        {fruit.cameras.map((cam) => (
          <div
            key={cam.cameraId}
            className="border rounded p-2"
          >
            <img
              src={cam.image}
              alt=""
              className="w-full"
            />

            <div className="mt-2">
              Camera {cam.cameraId}
            </div>

            <div className="font-bold">
              Grade {cam.grade}
            </div>
          </div>
        ))}

      </div>

      <div className="mt-10 border p-4 rounded">

        <h2 className="font-bold mb-4">
          Summary
        </h2>

        <div>A : {counts.A}</div>
        <div>B : {counts.B}</div>
        <div>C : {counts.C}</div>
        <div>D : {counts.D}</div>

        <div className="mt-4 text-xl font-bold">
          Final Grade :
          {fruit.finalGrade}
        </div>

      </div>
    </div>
  );
}