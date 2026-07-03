// 'use client';

// import { useEffect, useMemo, useState } from 'react';
// import {
//   AuditDetectionEvent,
//   AuditSummary,
//   getAuditSummary,
//   listAuditDetections,
// } from '@/lib/api';
// import styles from './analytics.module.css';

// export default function AnalyticsPage() {
//   const [events, setEvents] = useState<AuditDetectionEvent[]>([]);
//   const [summary, setSummary] = useState<AuditSummary | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     let cancelled = false;

//     async function loadAnalytics() {
//       try {
//         setError(null);
//         const [history, nextSummary] = await Promise.all([
//           listAuditDetections({ limit: 200 }),
//           getAuditSummary(24),
//         ]);
//         if (cancelled) return;
//         setEvents(history.items);
//         setSummary(nextSummary);
//       } catch (err) {
//         if (cancelled) return;
//         setError(err instanceof Error ? err.message : 'Khong the tai analytics');
//         setEvents([]);
//         setSummary(null);
//       }
//     }

//     loadAnalytics();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const stats = useMemo(() => {
//     const total = summary?.total_detections ?? events.length;
//     const avgConfidence = summary?.avg_confidence ?? average(events.map((e) => e.confidence ?? 0));
//     const gradeCounts = summary?.grade_counts ?? {};
//     const dist = {
//       green: gradeCounts.immature ?? gradeCounts.B ?? 0,
//       ripe: gradeCounts.mature ?? gradeCounts.A ?? 0,
//       overripe: gradeCounts.C ?? 0,
//       defect: gradeCounts.defective ?? gradeCounts.D ?? 0,
//     };
//     const avgWeight = average(events.map((e) => e.weight_kg ?? 0).filter((value) => value > 0));

//     return { total, avgConfidence, dist, avgWeight };
//   }, [events, summary]);

//   const exportCSV = () => {
//     const header = 'timestamp,grade,class_name,confidence,weight_kg,camera_slot,event_id';
//     const rows = events.map((event) =>
//       [
//         event.timestamp || '',
//         event.final_grade || '',
//         event.class_name || '',
//         event.confidence ?? '',
//         event.weight_kg ?? '',
//         event.camera_slot ?? '',
//         event.event_id,
//       ].join(',')
//     );

//     const blob = new Blob([header + '\n' + rows.join('\n')], {
//       type: 'text/csv',
//     });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `sfds_audit_analytics_${Date.now()}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   const total = stats.total || 1;

//   return (
//     <div className={styles.page}>
//       <div className={styles.header}>
//         <div>
//           <div className={styles.title}>SCADA ANALYTICS</div>
//           <div className={styles.subtitle}>
//             offline PostgreSQL audit aggregation
//           </div>
//         </div>

//         <button className={styles.btnPrimary} onClick={exportCSV}>
//           Export CSV
//         </button>
//       </div>

//       {error && <div className={styles.panel}>{error}</div>}

//       <div className={styles.grid}>
//         <div className={styles.kpi}>
//           <div className={styles.kpiLabel}>TOTAL EVENTS</div>
//           <div className={styles.kpiValue}>{stats.total}</div>
//         </div>

//         <div className={styles.kpi}>
//           <div className={styles.kpiLabel}>AVG CONFIDENCE</div>
//           <div className={styles.kpiValue}>
//             {(stats.avgConfidence * 100).toFixed(1)}%
//           </div>
//         </div>

//         <div className={styles.kpi}>
//           <div className={styles.kpiLabel}>AVG WEIGHT</div>
//           <div className={styles.kpiValue}>{stats.avgWeight.toFixed(2)} kg</div>
//         </div>

//         <div className={styles.kpi}>
//           <div className={styles.kpiLabel}>DEFECT RATE</div>
//           <div className={styles.kpiValue}>
//             {((stats.dist.defect / total) * 100).toFixed(1)}%
//           </div>
//         </div>
//       </div>

//       <div className={styles.panel}>
//         <div className={styles.panelTitle}>GRADE DISTRIBUTION</div>

//         <DistributionRow label="GREEN / B" value={stats.dist.green} total={total} tone="green" />
//         <DistributionRow label="RIPE / A" value={stats.dist.ripe} total={total} tone="blue" />
//         <DistributionRow label="C" value={stats.dist.overripe} total={total} tone="orange" />
//         <DistributionRow label="DEFECT / D" value={stats.dist.defect} total={total} tone="red" />
//       </div>
//     </div>
//   );
// }

// function DistributionRow({
//   label,
//   value,
//   total,
//   tone,
// }: {
//   label: string;
//   value: number;
//   total: number;
//   tone: 'green' | 'blue' | 'orange' | 'red';
// }) {
//   return (
//     <div className={styles.row}>
//       <div className={styles.label}>{label}</div>
//       <div className={styles.bar}>
//         <div
//           className={styles[tone]}
//           style={{ width: `${(value / total) * 100}%` }}
//         />
//       </div>
//       <div className={styles.value}>{value}</div>
//     </div>
//   );
// }

// function average(values: number[]) {
//   return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
// }


'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AuditDetectionEvent,
  AuditSummary,
  getAuditSummary,
  listAuditDetections,
} from '@/lib/api';

import styles from './analytics.module.css';

export default function AnalyticsPage() {
  const [events, setEvents] = useState<AuditDetectionEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [history, s] = await Promise.all([
        listAuditDetections({ limit: 200 }),
        getAuditSummary(24),
      ]);

      setEvents(history.items);
      setSummary(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot load analytics');
    } finally {
      setLoading(false);
    }
  }

  const grade = summary?.grade_counts ?? {};
  const cameras = summary?.camera_counts ?? {};

  const distribution = {
    A: grade.A ?? grade.mature ?? 0,
    B: grade.B ?? grade.immature ?? 0,
    C: grade.C ?? 0,
    D: grade.D ?? grade.defective ?? 0,
  };

  const total = summary?.total_detections ?? 0;

  const avgWeight = useMemo(() => {
    const values = events
      .map((e) => e.weight_kg ?? 0)
      .filter((x) => x > 0);

    if (!values.length) return 0;

    return (
      values.reduce((a, b) => a + b, 0) / values.length
    );
  }, [events]);

  function exportCSV() {
    const header =
      'timestamp,grade,class,confidence,weight,camera,event';

    const rows = events.map((e) =>
      [
        e.timestamp,
        e.final_grade,
        e.class_name,
        e.confidence,
        e.weight_kg,
        e.camera_slot,
        e.event_id,
      ].join(',')
    );

    const blob = new Blob([header + '\n' + rows.join('\n')]);

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Detection Analytics (Last 24 Hours)</p>
        </div>

        <button className={styles.button} onClick={exportCSV}>
          Export CSV
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.kpis}>
        <Card
          title="TOTAL DETECTIONS"
          value={summary?.total_detections ?? 0}
        />

        <Card
          title="SORT COMMANDS"
          value={summary?.total_sorting_commands ?? 0}
        />

        <Card
          title="AVG CONFIDENCE"
          value={`${(
            (summary?.avg_confidence ?? 0) * 100
          ).toFixed(1)}%`}
        />

        <Card
          title="AVG WEIGHT"
          value={`${avgWeight.toFixed(2)} kg`}
        />
      </section>

      <div className={styles.content}>
        <div className={styles.panel}>
          <h3>Grade Distribution</h3>

          <Bar
            label="A"
            value={distribution.A}
            total={total}
            color="green"
          />

          <Bar
            label="B"
            value={distribution.B}
            total={total}
            color="blue"
          />

          <Bar
            label="C"
            value={distribution.C}
            total={total}
            color="orange"
          />

          <Bar
            label="D"
            value={distribution.D}
            total={total}
            color="red"
          />
        </div>

        <div className={styles.panel}>
          <h3>Camera Distribution</h3>

          {Object.entries(cameras).length === 0 ? (
            <div className={styles.empty}>
              No camera data
            </div>
          ) : (
            Object.entries(cameras).map(([camera, count]) => (
              <Bar
                key={camera}
                label={camera}
                value={count}
                total={total}
                color="blue"
              />
            ))
          )}
        </div>
      </div>

      <section className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          Recent Detection Events
        </div>

        {loading ? (
          <div className={styles.empty}>
            Loading...
          </div>
        ) : events.length === 0 ? (
          <div className={styles.empty}>
            No detection history.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Time</th>
                <th className={styles.th}>Camera</th>
                <th className={styles.th}>Grade</th>
                <th className={styles.th}>Weight</th>
                <th className={styles.th}>Confidence</th>
              </tr>
            </thead>

            <tbody>
              {events.slice(0, 15).map((e) => (
                <tr key={e.event_id}>
                  <td className={styles.td}>{e.timestamp}</td>

                  <td className={styles.td}>{e.camera_slot}</td>

                  <td className={styles.td}>{e.final_grade}</td>

                  <td className={styles.td}>
                    {e.weight_kg
                      ? `${e.weight_kg.toFixed(2)} kg`
                      : '-'}
                  </td>

                  <td className={styles.td}>
                    {((e.confidence ?? 0) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className={styles.card}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div className={styles.barRow}>
  <span className={styles.barLabel}>{label}</span>


  <div className={styles.track}>
    <div
      className={`${styles.fill} ${styles[color]}`}
      style={{
        width: `${total ? (value / total) * 100 : 0}%`,
      }}
    />
  </div>

  <div className={styles.barValue}>
    {value}
  </div>
</div>
  );
}