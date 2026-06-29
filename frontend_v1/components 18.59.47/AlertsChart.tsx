'use client';

import { useMemo } from 'react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  cameras?: any[];
  range?: 'day' | 'hour' | 'month' | 'year';
}

export default function AlertsChart({ cameras = [], range = 'day' }: Props) {
  const chartData = useMemo(() => {
    if (!cameras.length) {
      return [];
    }

    const buckets = buildBuckets(range);
    const rows: Array<Record<string, string | number>> = buckets.map(
      (bucket) => ({
        name: bucket.label,
      })
    );

    cameras.forEach((cam, index) => {
      const history = [cam.result, ...(cam.resultHistory || [])]
        .filter(Boolean)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const values = new Map<string, number>();
      history.forEach((entry) => {
        const bucketKey = getBucketKey(entry.timestamp, range);
        const current = values.get(bucketKey) || 0;
        const count = entry.rawDetectionCount ?? entry.detections?.length ?? 0;
        values.set(bucketKey, current + count);
      });

      buckets.forEach((bucket, bucketIndex) => {
        rows[bucketIndex][`series-${index}`] = values.get(bucket.key) || 0;
      });
    });

    return rows;
  }, [cameras, range]);

  const seriesColors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <div
      style={{
        width: '100%',
        // height: '100%',
        minHeight: 320,
      }}
    >
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={10}
          />

          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />

          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          />

          {cameras.map((cam, index) => (
            <Line
              key={cam.id || cam.label || index}
              type="monotone"
              dataKey={`series-${index}`}
              name={cam.label || `Camera ${index + 1}`}
              stroke={seriesColors[index % seriesColors.length]}
              strokeWidth={3}
              dot={{
                r: 5,
                fill: seriesColors[index % seriesColors.length],
                stroke: 'var(--surface)',
                strokeWidth: 2,
              }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildBuckets(range: 'day' | 'hour' | 'month' | 'year') {
  const now = new Date();

  if (range === 'hour') {
    return Array.from({ length: 24 }, (_, index) => {
      const date = new Date(now);
      date.setMinutes(0, 0, 0);
      date.setHours(now.getHours() - (23 - index));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`,
        label: `${String(date.getHours()).padStart(2, '0')}:00`,
      };
    });
  }

  if (range === 'month') {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      date.setHours(0, 0, 0, 0);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleString('vi-VN', { month: 'short' }),
      };
    });
  }

  if (range === 'year') {
    return Array.from({ length: 4 }, (_, index) => {
      const year = now.getFullYear() - (3 - index);
      return {
        key: `${year}`,
        label: `${year}`,
      };
    });
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: date.toLocaleString('vi-VN', { weekday: 'short' }),
    };
  });
}

function getBucketKey(
  timestamp: number | undefined,
  range: 'day' | 'hour' | 'month' | 'year'
) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);

  if (range === 'hour') {
    date.setMinutes(0, 0, 0);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  if (range === 'month') {
    date.setHours(0, 0, 0, 0);
    return `${date.getFullYear()}-${date.getMonth()}`;
  }

  if (range === 'year') {
    return `${date.getFullYear()}`;
  }

  date.setHours(0, 0, 0, 0);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
