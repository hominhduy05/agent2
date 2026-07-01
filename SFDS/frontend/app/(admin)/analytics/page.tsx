'use client';

import { useMemo } from 'react';
import { useScada } from '@/hooks/use-scada';
import {
  Download,
  Activity,
  Gauge,
  Weight,
  AlertTriangle,
} from 'lucide-react';
import { Bar as RechartsBar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateFinalGrade, getGrade } from '@/lib/fruit-grade';




export default function AnalyticsPage() {
  const {
    cameras,
    fruits,
    stats,
    timeline,
    cameraStats,
  } = useScada();

  const total = stats.totalFruit || 1;

  /* =========================
     EXPORT CSV
  ========================= */

  const exportCSV = () => {
    const header =
      'timestamp,grade,confidence,weight,cameraId';

    const rows = fruits.map((fruit) =>
      [
        new Date(fruit.timestamp).toISOString(),
        fruit.final_grade ?? '',
        fruit.confidence ?? 0,
        fruit.weight_kg ?? 0,
        fruit.cameraId ?? '',
      ].join(',')
    );

    const blob = new Blob(
      [header + '\n' + rows.join('\n')],
      {
        type: 'text/csv',
      }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;
    a.download = `scada_analytics_${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };
  /* =========================
     BAR CHART
  ========================= */

  const cameraData = cameraStats.map((cam) => ({
    camera: cam.label,
    count: cam.totalFruit,
  }));


  /**
 * ===================================================
 * GROUP ALL CAMERA RESULTS BY FRUIT_ID
 * ===================================================
 */

const finalFruits = useMemo(() => {
  const groups = new Map<string, any[]>();

  fruits.forEach((fruit) => {
    const id =
      fruit.fruit_id ??
      `${fruit.cameraId}_${fruit.timestamp}`;

    if (!groups.has(id)) {
      groups.set(id, []);
    }

    groups.get(id)!.push(fruit);
  });

  return [...groups.entries()].map(([fruitId, items]) => {
    const grades = items.map((i) => getGrade(i));

    const finalGrade = calculateFinalGrade(grades);

    const avgConfidence =
      items.reduce(
        (s, i) => s + (i.confidence ?? 0),
        0
      ) / items.length;

    const avgWeight =
      items.reduce(
        (s, i) => s + (i.weight_kg ?? 0),
        0
      ) / items.length;

    return {
      ...items[0],

      fruit_id: fruitId,

      cameraCount: items.length,

      final_grade: finalGrade,

      confidence: avgConfidence,

      weight_kg: avgWeight,
    };
  });
}, [fruits]);

/**
 * ===================================================
 * FINAL GRADE DISTRIBUTION
 * ===================================================
 */


const gradeDistribution = useMemo(() => {
  const dist = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };

  finalFruits.forEach((fruit) => {
    if (fruit.final_grade) {
      const grade = fruit.final_grade as keyof typeof dist;

if (grade in dist) {
  dist[grade]++;
}
    }
  });

  return dist;
}, [finalFruits]);

const gradeChart = useMemo(
  () => [
    {
      name: 'A',
      value: gradeDistribution.A,
      fill: 'var(--grade-mature)',
    },
    {
      name: 'B',
      value: gradeDistribution.B,
      fill: 'var(--grade-immature)',
    },
    {
      name: 'C',
      value: gradeDistribution.C,
      fill: 'var(--grade-defective)',
    },
    {
      name: 'D',
      value: gradeDistribution.D,
      fill: 'var(--accent)',
    },
  ],
  [gradeDistribution]
);

/**
 * ===================================================
 * FINAL STATS
 * ===================================================
 */

const analytics = useMemo(() => {
  return {
    totalFruit: finalFruits.length,

    avgConfidence:
      finalFruits.reduce(
        (s, f) => s + (f.confidence ?? 0),
        0
      ) / (finalFruits.length || 1),

    avgWeight:
      finalFruits.reduce(
        (s, f) => s + (f.weight_kg ?? 0),
        0
      ) / (finalFruits.length || 1),
  };
}, [finalFruits]);

  return (
  <div className="min-h-screen bg-[var(--bg)] p-6">

    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            SCADA Analytics Dashboard
          </h1>

          <p className="text-slate-500">
            Real-time fruit classification analytics
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
        >
          <Download size={18} />
          Export CSV
        </button>

      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        <KPI
  title="Total Fruits"
  value={analytics.totalFruit}
  icon={<Activity size={20} />}
  color="blue"
/>

<KPI
  title="Avg Confidence"
  value={`${(analytics.avgConfidence * 100).toFixed(1)}%`}
  icon={<Gauge size={20} />}
  color="green"
/>

<KPI
  title="Avg Weight"
  value={`${analytics.avgWeight.toFixed(2)} kg`}
  icon={<Weight size={20} />}
  color="slate"
/>

        <KPI
          title="Online Cameras"
  value={stats.onlineCamera}
          icon={<AlertTriangle size={20} />}
          color="green"
        />

      </div>

      {/* ROW 1 */}
      <div className="grid lg:grid-cols-2 gap-6">

        <div className="bg-[var(--surface)] ring-1 ring-[var(--border-strong)] rounded-3xl shadow p-6">

          <h2 className="font-semibold text-lg mb-4">
            Grade Distribution
          </h2>

          <div className="h-[350px]">

            <ResponsiveContainer>

              <PieChart>

                <Pie
                  data={gradeChart}
                  dataKey="value"
                  outerRadius={120}
                  label
                >
                  {gradeChart.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.fill}
                    />
                  ))}
                </Pie>

                <Tooltip />
                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </div>

        <div className="bg-[var(--surface)] rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

    {/* Header */}

    <div className="px-6 py-5 border-b bg-[var(--bg-elevated)]">

        <div className="flex items-center justify-between">

            <div>

                <h2 className="text-lg font-semibold">
                    Production Timeline
                </h2>

                <p className="text-sm text-slate-500">
                    Fruit processing throughput by time
                </p>

            </div>

            <div className="flex items-center gap-2">

                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

                <span className="text-sm text-green-600 font-medium">
                    Live
                </span>

            </div>

        </div>

    </div>

    {/* Stats */}

    <div className="grid grid-cols-3 border-b">

        <StatItem
            title="Processed"
            value={analytics.totalFruit}
        />

        <StatItem
            title="Peak"
            value={Math.max(...timeline.map(i => i.count),0)}
        />

        <StatItem
            title="Intervals"
            value={timeline.length}
        />

    </div>

    {/* Chart */}

    <div className="h-[360px] p-4">

        <ResponsiveContainer>

            <LineChart data={timeline}>

                <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                />

                <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                />

                <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                />

                <Tooltip
                    contentStyle={{
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                    }}
                />

                <Line
                    dataKey="count"
                    type="monotone"
                    stroke="var(--accent)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                        r: 6,
                    }}
                />

            </LineChart>

        </ResponsiveContainer>

    </div>

</div>

      </div>

      {/* ROW 2 */}
      <div className="grid lg:grid-cols-2 gap-6">

        <div className="bg-[var(--surface)] ring-1 ring-[var(--border-strong)] rounded-3xl shadow p-6">

          <h2 className="font-semibold text-lg mb-4">
            Camera Throughput
          </h2>

          <div className="h-[350px]">

            <ResponsiveContainer>

              <BarChart data={cameraData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="camera" />

                <YAxis />

                <Tooltip />

                <RechartsBar
  dataKey="count"
  fill="var(--scada-primary)"
  radius={[8, 8, 0, 0]}
/>

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        <div className="bg-[var(--surface)] ring-1 ring-[var(--border-strong)] rounded-3xl shadow p-6">

          <h2 className="font-semibold text-lg mb-4">
            Grade Breakdown
          </h2>

          <div className="space-y-4">

            <GradeRow
  label="Grade A"
  value={gradeDistribution.A ?? 0}
  total={analytics.totalFruit}
  color="bg-[var(--grade-mature)]"
/>

<GradeRow
  label="Grade B"
  value={gradeDistribution.B ?? 0}
  total={analytics.totalFruit}
  color="bg-[var(--accent)]"
/>

<GradeRow
  label="Grade C"
  value={gradeDistribution.C ?? 0}
  total={analytics.totalFruit}
  color="bg-[var(--grade-immature)]"
/>

<GradeRow
  label="Grade D"
  value={gradeDistribution.D ?? 0}
  total={analytics.totalFruit}
  color="bg-[var(--grade-defective)]"
/>

          </div>

        </div>

      </div>

      {/* DEBUG */}
      <div className="bg-[var(--surface)] ring-1 ring-[var(--border-strong)] rounded-3xl shadow p-6">

        <h2 className="font-semibold text-lg mb-5">
          Analytics Debug
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <DebugCard
  title="Live Detections"
  value={stats.totalDetection}
/>

<DebugCard
  title="Processed Fruits"
  value={stats.totalFruit}
/>

<DebugCard
  title="Online Cameras"
  value={stats.onlineCamera}
/>

        </div>

      </div>

    </div>

  </div>
);
}

/* ================= KPI ================= */

function KPI({ title, value, icon, color = 'slate' }: any) {
  const colors: any = {
     blue: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  green: 'bg-[var(--success-dim)] text-[var(--success)]',
  red: 'bg-[var(--error-dim)] text-[var(--error)]',
  slate: 'bg-[var(--bg-elevated)] text-[var(--text)]',
  };

  return (
    <div className="rounded-2xl ring-1 ring-[var(--border-strong)] bg-[var(--surface)] p-5 shadow flex justify-between items-center">
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </div>

      <div className={`p-3 rounded-xl ${colors[color]}`}>
        {icon}
      </div>
    </div>
  );
}

/* ================= BAR ================= */

function Bar({ label, value, total, color }: any) {
  const percent = total ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 text-sm text-slate-600">{label}</div>

      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="w-10 text-right text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

function GradeRow({
  label,
  value,
  total,
  color,
}: any) {
  const percent =
    total > 0
      ? (value / total) * 100
      : 0;

  return (
    <div>

      <div className="flex justify-between mb-1 text-sm">

        <span>{label}</span>

        <span>
          {value} ({percent.toFixed(1)}%)
        </span>

      </div>

      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

        <div
          className={`h-full ${color}`}
          style={{
            width: `${percent}%`,
          }}
        />

      </div>

    </div>
  );
}

function DebugCard({
  title,
  value,
}: any) {
  return (
    <div className="rounded-2xl bg-[var(--bg-elevated)] p-4">

      <div className="text-slate-500 text-sm">
        {title}
      </div>

      <div className="text-3xl font-bold mt-2">
        {value}
      </div>

    </div>
  );
}

function StatItem({
    title,
    value,
}: any) {
    return (
        <div className="p-5">

            <div className="text-xs uppercase tracking-wide text-slate-400">
                {title}
            </div>

            <div className="mt-1 text-2xl font-bold">
                {value}
            </div>

        </div>
    );
}