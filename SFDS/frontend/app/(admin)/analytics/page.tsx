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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        setError(null);
        const [history, nextSummary] = await Promise.all([
          listAuditDetections({ limit: 200 }),
          getAuditSummary(24),
        ]);
        if (cancelled) return;
        setEvents(history.items);
        setSummary(nextSummary);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Khong the tai analytics');
        setEvents([]);
        setSummary(null);
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = summary?.total_detections ?? events.length;
    const avgConfidence = summary?.avg_confidence ?? average(events.map((e) => e.confidence ?? 0));
    const gradeCounts = summary?.grade_counts ?? {};
    const dist = {
      green: gradeCounts.immature ?? gradeCounts.B ?? 0,
      ripe: gradeCounts.mature ?? gradeCounts.A ?? 0,
      overripe: gradeCounts.C ?? 0,
      defect: gradeCounts.defective ?? gradeCounts.D ?? 0,
    };
    const avgWeight = average(events.map((e) => e.weight_kg ?? 0).filter((value) => value > 0));

    return { total, avgConfidence, dist, avgWeight };
  }, [events, summary]);

  const exportCSV = () => {
    const header = 'timestamp,grade,class_name,confidence,weight_kg,camera_slot,event_id';
    const rows = events.map((event) =>
      [
        event.timestamp || '',
        event.final_grade || '',
        event.class_name || '',
        event.confidence ?? '',
        event.weight_kg ?? '',
        event.camera_slot ?? '',
        event.event_id,
      ].join(',')
    );

    const blob = new Blob([header + '\n' + rows.join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sfds_audit_analytics_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = stats.total || 1;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>SCADA ANALYTICS</div>
          <div className={styles.subtitle}>
            offline PostgreSQL audit aggregation
          </div>
        </div>

        <button className={styles.btnPrimary} onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {error && <div className={styles.panel}>{error}</div>}

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

      <div className={styles.panel}>
        <div className={styles.panelTitle}>GRADE DISTRIBUTION</div>

        <DistributionRow label="GREEN / B" value={stats.dist.green} total={total} tone="green" />
        <DistributionRow label="RIPE / A" value={stats.dist.ripe} total={total} tone="blue" />
        <DistributionRow label="C" value={stats.dist.overripe} total={total} tone="orange" />
        <DistributionRow label="DEFECT / D" value={stats.dist.defect} total={total} tone="red" />
      </div>
    </div>
  );
}

function DistributionRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'green' | 'blue' | 'orange' | 'red';
}) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>{label}</div>
      <div className={styles.bar}>
        <div
          className={styles[tone]}
          style={{ width: `${(value / total) * 100}%` }}
        />
      </div>
      <div className={styles.value}>{value}</div>
    </div>
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}
