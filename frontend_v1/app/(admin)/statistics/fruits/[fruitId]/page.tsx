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
      <div style={{ color: 'var(--text-muted)', padding: 20 }}>
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
    <div
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        padding: 24,
      }}
    >

      {/* HEADER */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          {fruit.fruitId}
        </h1>

        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Scan Time: {new Date(fruit.createdAt).toLocaleString()}
        </div>

        <div style={{ marginTop: 10 }}>
          Final Grade:{' '}
          <b style={{ color: 'var(--success)' }}>
            {fruit.finalGrade || 'WAIT'}
          </b>
        </div>

        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Room: {fruit.room}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 20,
        }}
      >
        <Card title="Total Cameras" value={total} />
        <Card title="Valid Grades" value={valid} />
        <Card title="Weight (kg)" value={fruit.weight?.toFixed(2)} />
        <Card title="Final" value={fruit.finalGrade || 'WAIT'} />
      </div>

      {/* GRADE BREAKDOWN */}
      <div className="mt-6 bg-[var(--surface)] p-4 rounded-xl shadow border border-[var(--border)]">
  <h2 className="font-bold mb-4 text-lg text-[var(--text)]">
    Grade Breakdown
  </h2>

  <div className="grid grid-cols-4 gap-4">
    <GradeBox label="A" value={counts.A} />
    <GradeBox label="B" value={counts.B} />
    <GradeBox label="C" value={counts.C} />
    <GradeBox label="D" value={counts.D} />
  </div>
</div>

      {/* CAMERA DETAILS */}
      <div className="mt-6">
        <h2 className="font-bold text-lg mb-4">Camera Details</h2>

        <div className="grid grid-cols-5 gap-4">
  {fruit.cameras.map((cam) => (
    <div
      key={cam.cameraId}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm p-3"
    >
      {/* IMAGE PLACEHOLDER */}
      <div className="h-24 rounded mb-2 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-soft)]">
        Camera {cam.cameraId}
      </div>

      <div className="text-sm space-y-1">
        <div className="text-[var(--text)]">
          Grade:{' '}
          <span className="font-bold">
            {cam.grade || 'NULL'}
          </span>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          Camera ID: {cam.cameraId}
        </div>
      </div>
    </div>
  ))}
</div>
      </div>

      {/* FINAL ANALYTICS */}
      <div className="mt-8 p-6 rounded-xl shadow bg-[var(--surface)] border border-[var(--border)]">
  <h2 className="font-bold text-lg mb-3 text-[var(--text)]">
    Final Analytics
  </h2>

  <div className="text-sm space-y-1 text-[var(--text-muted)]">
    <div>
      Total Weight:{" "}
      <span className="text-[var(--text)] font-medium">
        {fruit.weight.toFixed(2)} kg
      </span>
    </div>

    <div>
      Average per camera:{" "}
      <span className="text-[var(--text)] font-medium">
        {(fruit.weight / 5).toFixed(2)} kg
      </span>
    </div>

    <div>
      Quality Score:{" "}
      <span className="text-[var(--accent)] font-semibold">
        {Math.round(
          ((counts.A * 4 +
            counts.B * 3 +
            counts.C * 2 +
            counts.D * 1) /
            (total * 4)) *
            100
        ) || 0}
        %
      </span>
    </div>
  </div>
</div>
    </div>
  );
}

/* ===== UI COMPONENTS ===== */

function Card({ title, value }: any) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl shadow-sm">
      <div className="text-sm text-[var(--text-muted)]">{title}</div>
      <div className="text-xl font-bold text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

const gradeColorMap: Record<string, string> = {
  A: 'var(--success)',
  B: 'var(--accent)',
  C: 'var(--warning)',
  D: 'var(--error)',
};

function GradeBox({ label, value }: any) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
      <div
        className="text-sm font-medium"
        style={{ color: gradeColorMap[label] }}
      >
        Grade {label}
      </div>

      <div className="text-2xl font-bold text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}