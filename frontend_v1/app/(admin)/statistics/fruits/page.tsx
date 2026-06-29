'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getSystemStatistics } from '@/lib/scada-statistics';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import styles from './page.module.css';
import Link from 'next/link';

type Grade = 'A' | 'B' | 'C' | 'D' | null;

type CameraResult = {
  cameraId: number;

  grade: Grade;

  weight: number | null;
};

type FruitRecord = {
  fruitId: string;

  room: string;

  createdAt: string;

  finalGrade: Grade;

  weight: number | null;

  cameras: CameraResult[];
};

const ROOM_CAMERA_MAP: Record<string, number[]> = {
  'BUỒNG 1': [1, 2, 3, 4, 5],
  'BUỒNG 2': [6, 7, 8, 9, 10],
  'BUỒNG 3': [11, 12, 13, 14, 15],
};

export default function StatisticsPage() {
  const weightMapRef = useRef<Map<string, number>>(new Map());

  const [fruits, setFruits] = useState<FruitRecord[]>([]);

  const [room, setRoom] = useState('ALL');

  const [grade, setGrade] = useState('ALL');

  const [date, setDate] = useState('');

  const [time, setTime] = useState('');

  const [range, setRange] = useState('DAY');
  const [maxTon, setMaxTon] = useState('');

  const [cameraId, setCameraId] = useState('ALL');

  const getWeight = (id: string, weight: number | null | undefined) => {
    // API có cân thật
    if (weight && weight > 0) {
      return Number(weight.toFixed(2));
    }

    if (!id) return 0;

    const cache = weightMapRef.current;

    if (cache.has(id)) {
      return cache.get(id)!;
    }

    const random = Number((2 + Math.random() * 3).toFixed(2));

    cache.set(id, random);

    return random;
  };

  useEffect(() => {
    const update = () => {
      const data = getSystemStatistics() as any[];

      const map = new Map<string, FruitRecord>();

      for (const item of data) {
        const id = item.fruitId;

        if (!map.has(id)) {
          map.set(id, {
            ...item,
            cameras: [...(item.cameras || [])],
            weight: getWeight(String(id), item.weight),
          });
        } else {
          const existing = map.get(id)!;

          // merge cameras (KHÔNG overwrite)
          const mergedCameras = [
            ...(existing.cameras || []),
            ...(item.cameras || []),
          ];

          // deduplicate camera theo cameraId
          const unique = new Map<number, any>();
          for (const c of mergedCameras) {
            const cid = c.cameraId ?? c.camera_id;
            unique.set(cid, c);
          }

          existing.cameras = Array.from(unique.values());
        }
      }

      setFruits(Array.from(map.values()));
    };
    update();

    const timer = setInterval(update, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    return fruits.filter((f) => {
      if (room !== 'ALL') {
        const allowedCams = ROOM_CAMERA_MAP[room] || [];

        const hasCam = f.cameras?.some((c: any) => {
          const id = c.cameraId ?? c.camera_id;
          return allowedCams.includes(Number(id));
        });

        if (!hasCam) return false;
      }
      // if (room !== 'ALL' && f.room !== room) return false;

      if (grade !== 'ALL' && f.finalGrade !== grade) return false;

      const created = new Date(f.createdAt);

      // lọc ngày
      if (date) {
        const d = created.toISOString().slice(0, 10);

        if (d !== date) return false;
      }

      // ======================
      // LỌC GIỜ
      // ======================

      if (time) {
        const hour = created.getHours();

        if (hour !== Number(time)) return false;
      }

      // ======================
      // KHOẢNG THỜI GIAN
      // ======================

      if (range !== 'DAY') {
        const now = Date.now();

        const diff = now - created.getTime();

        // 5 phút gần nhất

        if (range === '5M' && diff > 5 * 60 * 1000) return false;

        // 30 phút gần nhất

        if (range === '30M' && diff > 30 * 60 * 1000) return false;

        // 1 giờ gần nhất

        if (range === '1H' && diff > 60 * 60 * 1000) return false;

        // ======================
        // GIỜ HÀNH CHÍNH
        // ======================

        if (range === 'WORK') {
          const hour = created.getHours();

          /**
           * giờ hành chính:
           * 08:00 -> 17:00
           */

          if (hour < 8 || hour >= 17) return false;
        }
      }

      // ======================
      // LỌC SẢN LƯỢNG TẤN / NGÀY
      // ======================

      // if (maxTon) {
      //   const totalKg = fruits
      //     .filter((x) => {
      //       if (!date) return true;

      //       const d = new Date(x.createdAt).toISOString().slice(0, 10);

      //       return d === date;
      //     })
      //     .reduce((sum, x) => {
      //       return sum + Number(x.weight ?? getRandomWeight(x.fruitId));
      //     }, 0);

      //   const totalTon = totalKg / 1000;

      //   if (totalTon > Number(maxTon)) {
      //     return false;
      //   }
      // }

      return true;
    });
  }, [fruits, room, grade, date, time, range]);

  const summary = useMemo(() => {
  const s = {
    total: filtered.length,
    kg: 0,
    ton: 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  filtered.forEach((fruit) => {
    s.kg += fruit.weight || 0;

    fruit.cameras.forEach((cam) => {
      if (cam.grade) {
        s[cam.grade]++;
      }
    });
  });

  s.ton = s.kg / 1000;

  return s;
}, [filtered]);

  const chart = [
    {
      name: 'A',
      value: summary.A,
    },

    {
      name: 'B',
      value: summary.B,
    },

    {
      name: 'C',
      value: summary.C,
    },

    {
      name: 'D',
      value: summary.D,
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>SCADA FRUIT ANALYTICS</h1>

        <p>Realtime production monitoring</p>
      </header>

      <section className={styles.filter}>
        <select value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="ALL">Tất cả buồng</option>

          <option>BUỒNG 1</option>

          <option>BUỒNG 2</option>

          <option>BUỒNG 3</option>
        </select>

        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="ALL">Tất cả grade</option>

          <option>A</option>
          <option>B</option>
          <option>C</option>
          <option>D</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <input
          type="number"
          placeholder="Tấn/ngày tối đa"
          value={maxTon}
          onChange={(e) => setMaxTon(e.target.value)}
        />

        <select value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="">Tất cả giờ</option>

          {Array.from(
            {
              length: 24,
            },
            (_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>
                {i}:00
              </option>
            )
          )}
        </select>

        <select value={range} onChange={(e) => setRange(e.target.value)}>
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

        <Card
          title="Khối lượng"
          value={(summary.kg / 1000).toFixed(3) + ' Tấn'}
        />

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
            {filtered.map((f) => (
              <tr key={f.fruitId}>
                {/* <td className={styles.td}>{f.fruitId}</td> */}
                <td className={styles.td}>
  <Link
    href={`/scada/statistics/fruits/${f.fruitId}`}
    style={{
      color: '#00bfff',
      fontWeight: 600,
      textDecoration: 'underline',
    }}
  >
    {f.fruitId}
  </Link>
</td>

                <td className={styles.td}>{f.room}</td>

                {[0, 1, 2, 3, 4].map((i) => (
                  <td className={styles.td} key={i}>
                    {f.cameras[i]?.grade || 'NULL'}
                  </td>
                ))}

                <td className={`${styles.td} ${styles.final}`}>
                  {f.finalGrade || 'WAIT'}
                </td>
                <td className={styles.td}>
                  {getWeight(f.fruitId, f.weight).toFixed(2)}
                  kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className={styles.card}>
      <span>{title}</span>

      <strong>{value}</strong>
    </div>
  );
}
