'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { listAuditDetections } from '@/lib/api';
import {
  FruitStatistics,
  mapAuditEventsToFruitStatistics,
} from '@/lib/scada-statistics';

export default function FruitDetailPage() {
  const params = useParams();
  const fruitId = params.fruitId as string;
  const [fruits, setFruits] = useState<FruitStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFruit() {
      try {
        setLoading(true);
        const response = await listAuditDetections({ limit: 200 });
        if (cancelled) return;
        setFruits(mapAuditEventsToFruitStatistics(response.items));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Không thể tải dữ liệu PostgreSQL'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFruit();

    return () => {
      cancelled = true;
    };
  }, []);

  const fruit = useMemo(
    () => fruits.find((item) => item.fruitId === fruitId),
    [fruits, fruitId]
  );

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 20 }}>
        Đang tải dữ liệu từ PostgreSQL...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)', padding: 20 }}>
        {error}
      </div>
    );
  }

  if (!fruit) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 20 }}>
        Không tìm thấy dữ liệu quả này trong PostgreSQL
      </div>
    );
  }

  const counts = { A: 0, B: 0, C: 0, D: 0 };

  fruit.cameras.forEach((camera) => {
    if (camera.grade) counts[camera.grade]++;
  });

  const total = fruit.cameras.length;
  const valid = counts.A + counts.B + counts.C + counts.D;
  const qualityScore =
    total > 0
      ? Math.round(
          ((counts.A * 4 + counts.B * 3 + counts.C * 2 + counts.D) /
            (total * 4)) *
            100
        )
      : 0;

  return (
    <div
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>{fruit.fruitId}</h1>

        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Thời gian scan: {new Date(fruit.createdAt).toLocaleString()}
        </div>

        <div style={{ marginTop: 10 }}>
          Final Grade:{' '}
          <b style={{ color: 'var(--success)' }}>
            {fruit.finalGrade || 'WAIT'}
          </b>
        </div>

        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Buồng: {fruit.room}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 20,
        }}
      >
        <Card title="Tổng camera" value={total} />
        <Card title="Grade hợp lệ" value={valid} />
        <Card title="Khối lượng (kg)" value={fruit.weight.toFixed(2)} />
        <Card title="Final" value={fruit.finalGrade || 'WAIT'} />
      </div>

      <div className="mt-6 bg-[var(--surface)] p-4 rounded-xl shadow border border-[var(--border)]">
        <h2 className="font-bold mb-4 text-lg text-[var(--text)]">
          Phân bố grade
        </h2>

        <div className="grid grid-cols-4 gap-4">
          <GradeBox label="A" value={counts.A} />
          <GradeBox label="B" value={counts.B} />
          <GradeBox label="C" value={counts.C} />
          <GradeBox label="D" value={counts.D} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-bold text-lg mb-4">Chi tiết camera</h2>

        <div className="grid grid-cols-5 gap-4">
          {fruit.cameras.map((camera) => (
            <div
              key={camera.cameraId}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm p-3"
            >
              <div className="h-24 rounded mb-2 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-soft)]">
                Camera {camera.cameraId}
              </div>

              <div className="text-sm space-y-1">
                <div className="text-[var(--text)]">
                  Grade:{' '}
                  <span className="font-bold">
                    {camera.grade || 'NULL'}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-muted)]">
                  Độ tin cậy:{' '}
                  {camera.confidence !== null
                    ? `${(camera.confidence * 100).toFixed(1)}%`
                    : 'NULL'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-6 rounded-xl shadow bg-[var(--surface)] border border-[var(--border)]">
        <h2 className="font-bold text-lg mb-3 text-[var(--text)]">
          Tổng hợp cuối
        </h2>

        <div className="text-sm space-y-1 text-[var(--text-muted)]">
          <div>
            Tổng khối lượng:{' '}
            <span className="text-[var(--text)] font-medium">
              {fruit.weight.toFixed(2)} kg
            </span>
          </div>

          <div>
            Trung bình mỗi camera:{' '}
            <span className="text-[var(--text)] font-medium">
              {(fruit.weight / 5).toFixed(2)} kg
            </span>
          </div>

          <div>
            Quality Score:{' '}
            <span className="text-[var(--accent)] font-semibold">
              {qualityScore}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl shadow-sm">
      <div className="text-sm text-[var(--text-muted)]">{title}</div>
      <div className="text-xl font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}

const gradeColorMap: Record<string, string> = {
  A: 'var(--success)',
  B: 'var(--accent)',
  C: 'var(--warning)',
  D: 'var(--error)',
};

function GradeBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
      <div
        className="text-sm font-medium"
        style={{ color: gradeColorMap[label] }}
      >
        Grade {label}
      </div>

      <div className="text-2xl font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}
