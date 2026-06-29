'use client';

import { getSystemStatistics } from '@/lib/scada-statistics';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

export default function FruitDetailPage() {
  const params = useParams();
  const fruitId = params.fruitId as string;

  // const fruits = getSystemStatistics();
  // const fruit = fruits.find(f => f.fruitId === fruitId);

  const fruits = useMemo(() => getSystemStatistics(), []);
const fruit = fruits.find(f => f.fruitId === fruitId);

  if (!fruit) {
    return (
      <div className="p-6 text-red-500 text-xl">
        Fruit not found
      </div>
    );
  }

  const counts = { A: 0, B: 0, C: 0, D: 0 };

  fruit.cameras.forEach(cam => {
    if (cam.grade) counts[cam.grade]++;
  });

  const total = fruit.cameras.length;
  const valid = counts.A + counts.B + counts.C + counts.D;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-3xl font-bold text-blue-600">
          {fruit.fruitId}
        </h1>

        <div className="mt-2 text-gray-600">
          Scan Time: {' '}
          {new Date(fruit.createdAt).toLocaleString()}
        </div>

        <div className="mt-2 text-lg">
          Final Grade:
          <span className="ml-2 font-bold text-green-600">
            {fruit.finalGrade || 'WAIT'}
          </span>
        </div>

        <div className="mt-2 text-gray-600">
          Room: {fruit.room}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-4 gap-4 mt-6">

        <Card title="Total Cameras" value={total} />
        <Card title="Valid Grades" value={valid} />
        <Card title="Weight (kg)" value={fruit.weight.toFixed(2)} />
        <Card title="Final" value={fruit.finalGrade || 'WAIT'} />
      </div>

      {/* GRADE BREAKDOWN */}
      <div className="mt-6 bg-white p-4 rounded-xl shadow">
        <h2 className="font-bold mb-4 text-lg">Grade Breakdown</h2>

        <div className="grid grid-cols-4 gap-4">
          <GradeBox label="A" value={counts.A} color="text-green-600" />
          <GradeBox label="B" value={counts.B} color="text-blue-600" />
          <GradeBox label="C" value={counts.C} color="text-yellow-600" />
          <GradeBox label="D" value={counts.D} color="text-red-600" />
        </div>
      </div>

      {/* CAMERA DETAILS */}
      <div className="mt-6">
        <h2 className="font-bold text-lg mb-4">Camera Details</h2>

        <div className="grid grid-cols-5 gap-4">
          {fruit.cameras.map(cam => (
            <div
              key={cam.cameraId}
              className="bg-white rounded-xl shadow p-3"
            >

              {/* IMAGE PLACEHOLDER */}
              <div className="h-24 bg-gray-200 rounded mb-2 flex items-center justify-center text-xs text-gray-500">
                Camera {cam.cameraId}
              </div>

              <div className="text-sm">
                <div>
                  Grade:{' '}
                  <span className="font-bold">
                    {cam.grade || 'NULL'}
                  </span>
                </div>

                <div className="text-gray-500 text-xs mt-1">
                  Camera ID: {cam.cameraId}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL ANALYTICS */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow">
        <h2 className="font-bold text-lg mb-3">
          Final Analytics
        </h2>

        <div className="text-sm text-gray-600">
          <div>Total Weight: {fruit.weight.toFixed(2)} kg</div>
          <div>Average per camera: {(fruit.weight / 5).toFixed(2)} kg</div>
          <div>
            Quality Score:{' '}
            {Math.round(
              ((counts.A * 4 +
                counts.B * 3 +
                counts.C * 2 +
                counts.D * 1) /
                (total * 4)) *
                100
            ) || 0}
            %
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== UI COMPONENTS ===== */

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function GradeBox({ label, value, color }: any) {
  return (
    <div className="p-3 bg-gray-100 rounded">
      <div className={`text-xl font-bold ${color}`}>
        {label}
      </div>
      <div className="text-sm text-gray-600">
        {value} items
      </div>
    </div>
  );
}