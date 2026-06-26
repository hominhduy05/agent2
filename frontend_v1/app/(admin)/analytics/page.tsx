'use client';

import { useMemo } from 'react';
import { useScada } from '@/hooks/use-scada';
import styles from './analytics.module.css';

export default function AnalyticsPage() {
  const { cameras } = useScada();

  const events = useMemo(() => {
    return cameras.flatMap((c) => c.inspectionHistory || []);
  }, [cameras]);

  const stats = useMemo(() => {
    const total = events.length;

    const avgConfidence =
      events.reduce((acc, e: any) => acc + (e.confidence ?? 0), 0) /
      (total || 1);

    const dist = {
      green: events.filter((e: any) => e.ripeness === 'green').length,
      ripe: events.filter((e: any) => e.ripeness === 'ripe').length,
      overripe: events.filter((e: any) => e.ripeness === 'overripe').length,
      defect: events.filter((e: any) => e.ripeness === 'defect').length,
    };

    const weights = events.map((e: any) => e.weight ?? 0);

    const avgWeight =
      weights.reduce((a, b) => a + b, 0) / (weights.length || 1);

    return { total, avgConfidence, dist, avgWeight };
  }, [events]);

  const exportCSV = () => {
    const header = 'timestamp,ripeness,confidence,weight,cameraId';

    const rows = events.map((e: any) =>
      [
        new Date(e.timestamp).toISOString(),
        e.ripeness,
        e.confidence,
        e.weight,
        e.cameraId,
      ].join(',')
    );

    const blob = new Blob([header + '\n' + rows.join('\n')], {
      type: 'text/csv',
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `scada_analytics_${Date.now()}.csv`;
    a.click();
  };

  const total = stats.total || 1;

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>SCADA ANALYTICS</div>
          <div className={styles.subtitle}>
            inspection telemetry / historical aggregation
          </div>
        </div>

        <button className={styles.btnPrimary} onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {/* KPI GRID */}
      <div className={styles.grid}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>TOTAL EVENTS</div>
          <div className={styles.kpiValue}>{stats.total}</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>AVG CONFIDENCE</div>
          <div className={styles.kpiValue}>
            {(stats.avgConfidence * 100).toFixed(1)}%
          </div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>AVG WEIGHT</div>
          <div className={styles.kpiValue}>{stats.avgWeight.toFixed(2)} kg</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>DEFECT RATE</div>
          <div className={styles.kpiValue}>
            {((stats.dist.defect / total) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* DISTRIBUTION PANEL */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>RIPENESS DISTRIBUTION</div>

        <div className={styles.row}>
          <div className={styles.label}>GREEN</div>
          <div className={styles.bar}>
            <div
              className={styles.green}
              style={{ width: `${(stats.dist.green / total) * 100}%` }}
            />
          </div>
          <div className={styles.value}>{stats.dist.green}</div>
        </div>

        <div className={styles.row}>
          <div className={styles.label}>RIPE</div>
          <div className={styles.bar}>
            <div
              className={styles.blue}
              style={{ width: `${(stats.dist.ripe / total) * 100}%` }}
            />
          </div>
          <div className={styles.value}>{stats.dist.ripe}</div>
        </div>

        <div className={styles.row}>
          <div className={styles.label}>OVER</div>
          <div className={styles.bar}>
            <div
              className={styles.orange}
              style={{ width: `${(stats.dist.overripe / total) * 100}%` }}
            />
          </div>
          <div className={styles.value}>{stats.dist.overripe}</div>
        </div>

        <div className={styles.row}>
          <div className={styles.label}>DEFECT</div>
          <div className={styles.bar}>
            <div
              className={styles.red}
              style={{ width: `${(stats.dist.defect / total) * 100}%` }}
            />
          </div>
          <div className={styles.value}>{stats.dist.defect}</div>
        </div>
      </div>
    </div>
  );
}
