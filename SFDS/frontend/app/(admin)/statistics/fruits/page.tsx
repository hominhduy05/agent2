'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { listAuditDetections } from '@/lib/api';
import {
  FruitStatistics,
  mapAuditEventsToFruitStatistics,
} from '@/lib/scada-statistics';

import styles from './page.module.css';

const ROOM_CAMERA_MAP: Record<string, number[]> = {
  'BUỒNG 1': [1, 2, 3, 4, 5],
};

export default function StatisticsPage() {
  const [fruits, setFruits] = useState<FruitStatistics[]>([]);
  const [room, setRoom] = useState('ALL');
  const [grade, setGrade] = useState('ALL');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [range, setRange] = useState('DAY');
  const [maxTon, setMaxTon] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFruits() {
      try {
        const response = await listAuditDetections({ limit: 200 });
        if (cancelled) return;
        setFruits(mapAuditEventsToFruitStatistics(response.items));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setFruits([]);
        setError(
          err instanceof Error ? err.message : 'Không thể tải dữ liệu PostgreSQL'
        );
      }
    }

    loadFruits();
    const timer = setInterval(loadFruits, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    return fruits.filter((fruit) => {
      if (room !== 'ALL') {
        const allowedCameras = ROOM_CAMERA_MAP[room] || [];
        const hasCamera = fruit.cameras.some((camera) =>
          allowedCameras.includes(camera.cameraId)
        );
        if (!hasCamera) return false;
      }

      if (grade !== 'ALL' && fruit.finalGrade !== grade) return false;

      const created = new Date(fruit.createdAt);

      if (date && created.toISOString().slice(0, 10) !== date) {
        return false;
      }

      if (time && created.getHours() !== Number(time)) {
        return false;
      }

      if (range !== 'DAY') {
        const diff = Date.now() - created.getTime();

        if (range === '5M' && diff > 5 * 60 * 1000) return false;
        if (range === '30M' && diff > 30 * 60 * 1000) return false;
        if (range === '1H' && diff > 60 * 60 * 1000) return false;

        if (range === 'WORK') {
          const hour = created.getHours();
          if (hour < 8 || hour >= 17) return false;
        }
      }

      if (maxTon) {
        const maxKg = Number(maxTon) * 1000;
        if (Number.isFinite(maxKg) && fruit.weight > maxKg) return false;
      }

      return true;
    });
  }, [fruits, room, grade, date, time, range, maxTon]);

  const summary = useMemo(() => {
    const result = {
      total: filtered.length,
      kg: 0,
      ton: 0,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };

    filtered.forEach((fruit) => {
      result.kg += fruit.weight || 0;
      fruit.cameras.forEach((camera) => {
        if (camera.grade) result[camera.grade]++;
      });
    });

    if (result.kg < 1000) result.ton = result.kg;
    else result.ton = result.kg / 1000;

    return result;
  }, [filtered]);

  const chart = [
    { name: 'A', value: summary.A },
    { name: 'B', value: summary.B },
    { name: 'C', value: summary.C },
    { name: 'D', value: summary.D },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>SCADA FRUIT ANALYTICS</h1>
        <p>Dữ liệu lấy trực tiếp từ PostgreSQL offline</p>
      </header>

      {error && <section className={styles.card}>{error}</section>}

      <section className={styles.filter}>
        <select value={room} onChange={(event) => setRoom(event.target.value)}>
          <option value="ALL">Tất cả buồng</option>
          <option>BUỒNG 1</option>
        </select>

        <select
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
        >
          <option value="ALL">Tất cả grade</option>
          <option>A</option>
          <option>B</option>
          <option>C</option>
          <option>D</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <input
          type="number"
          placeholder="Tấn/ngày tối đa"
          value={maxTon}
          onChange={(event) => setMaxTon(event.target.value)}
        />

        <select value={time} onChange={(event) => setTime(event.target.value)}>
          <option value="">Tất cả giờ</option>
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={String(hour).padStart(2, '0')}>
              {hour}:00
            </option>
          ))}
        </select>

        <select
          value={range}
          onChange={(event) => setRange(event.target.value)}
        >
          <option value="DAY">Cả ngày</option>
          <option value="WORK">Giờ hành chính (08:00-17:00)</option>
          <option value="5M">5 phút gần nhất</option>
          <option value="30M">30 phút gần nhất</option>
          <option value="1H">1 giờ gần nhất</option>
        </select>

        <button
          onClick={() => {
            setRoom('ALL');
            setGrade('ALL');
            setDate('');
            setTime('');
            setRange('DAY');
            setMaxTon('');
          }}
        >
          RESET
        </button>
      </section>

      <section className={styles.cards}>
        <Card title="Tổng quả" value={summary.total} />
        <Card title="Khối lượng" value={`${summary.kg < 1000 ? `${summary.ton} Kg` : `${summary.ton.toFixed(3)} Tấn`}`} />
        <Card title="Grade A" value={summary.A} />
        <Card title="Grade B" value={summary.B} />
        <Card title="Grade C" value={summary.C} />
        <Card title="Grade D" value={summary.D} />
      </section>

      <section className={styles.chart}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className={styles.tableBox}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>ID</th>
              <th className={styles.th}>BUỒNG</th>
              <th className={styles.th}>CAM1</th>
              <th className={styles.th}>CAM2</th>
              <th className={styles.th}>CAM3</th>
              <th className={styles.th}>CAM4</th>
              <th className={styles.th}>CAM5</th>
              <th className={styles.th}>FINAL</th>
              <th className={styles.th}>KG</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((fruit) => (
              <tr key={fruit.fruitId}>
                <td className={styles.td}>
                  <Link
                    href={`/statistics/fruits/${fruit.fruitId}`}
                    style={{
                      color: '#00bfff',
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    {fruit.fruitId}
                  </Link>
                </td>

                <td className={styles.td}>{fruit.room}</td>

                {[0, 1, 2, 3, 4].map((index) => (
                  <td className={styles.td} key={index}>
                    {fruit.cameras[index]?.grade || 'NULL'}
                  </td>
                ))}

                <td className={`${styles.td} ${styles.final}`}>
                  {fruit.finalGrade || 'WAIT'}
                </td>
                <td className={styles.td}>{fruit.weight.toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className={styles.card}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
