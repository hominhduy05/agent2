'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

export default function DetectionChart({
  cameras,
}: any) {
  const data = cameras.map((cam: any) => ({
    name: cam.label,
    detections:
      cam.lastRawDetectionCount ??
      cam.result?.detections?.length ??
      0,
  }));

  
  return (
    <ResponsiveContainer
  width="100%"
  height={350}
>
      <BarChart data={data}>
        <CartesianGrid
          stroke="var(--border)"
          vertical={false}
        />

        <XAxis
          dataKey="name"
          stroke="var(--text-muted)"
        />

        <YAxis stroke="var(--text-muted)" />

        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        />

        <Bar
          radius={[8, 8, 0, 0]}
          dataKey="detections"
        >
          {data.map((_: any, i: number) => (
            <Cell
              key={i}
              fill="var(--accent)"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}