'use client';

import { useMemo, useState } from 'react';
import { useScada } from '@/hooks/use-scada';
import CameraStrip from '@/components/CameraStrip';
import DetectionChart from '@/components/DetectionChart';
import StatusDonut from '@/components/StatusDonut';
import RecentAlerts from '@/components/RecentAlerts';
import AlertsChart from '@/components/AlertsChart';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { cameras } = useScada();

  const visibleCameras = useMemo(() => cameras.filter(Boolean), [cameras]);
  const [selectedRange, setSelectedRange] = useState<
    'day' | 'hour' | 'month' | 'year'
  >('day');

  const totalCams = visibleCameras.length;
  const activeCams = visibleCameras.filter((c) => c?.isActive).length;
  const inactiveCams = totalCams - activeCams;
  const detectionsCount = visibleCameras.reduce(
    (sum, cam) => sum + (cam?.result?.detections?.length || 0),
    0
  );
  const errorCams = visibleCameras.filter((c) => c?.error).length;
  const healthyCams = visibleCameras.filter(
    (c) => !c?.error && c?.isActive
  ).length;
  const activeRate =
    totalCams > 0 ? Math.round((activeCams / totalCams) * 100) : 0;

  const kpiStatus = useMemo(() => {
    if (activeRate === 0) return 'OFFLINE';
    if (errorCams > 0) return 'ATTENTION';
    return 'ONLINE';
  }, [activeRate, errorCams]);

  const priorityCameras = useMemo(() => {
    return [...visibleCameras]
      .sort(
        (a, b) =>
          (b?.result?.detections?.length || 0) -
          (a?.result?.detections?.length || 0)
      )
      .slice(0, 5);
  }, [visibleCameras]);

  const rangeOptions = [
    { key: 'day', label: 'Ngày' },
    { key: 'hour', label: 'Giờ' },
    { key: 'month', label: 'Tháng' },
    { key: 'year', label: 'Năm' },
  ] as const;

  const selectedTrendLabel =
    rangeOptions.find((option) => option.key === selectedRange)?.label ??
    'Ngày';

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className={styles.eyebrow}>SCADA OPERATIONS</p>
            <h1>Live Production Dashboard</h1>
            <p className={styles.subtitle}>
              Real-time camera health, detections, and operational alerts from
              the live SCADA pipeline.
            </p>
          </div>

          <div className={styles.headerBadge}>
            <span className={styles.statusDot} />
            Live • {activeCams}/{totalCams} cameras online
          </div>
        </div>
      </header>

      <section className={styles.kpiGrid}>
        <div className={styles.dashboardCard}>
          <div className={styles.kpiTop}>
            <div>
              <div className={styles.kpiLabel}>Camera Status</div>
              <div className={styles.kpiValue}>
                {activeCams}/{totalCams}
              </div>
            </div>
            <span className={styles.kpiChipSuccess}>ONLINE</span>
          </div>
          <div className={styles.kpiMeta}>Active cameras in service</div>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.kpiTop}>
            <div>
              <div className={styles.kpiLabel}>Detections</div>
              <div className={styles.kpiValue}>{detectionsCount}</div>
            </div>
            <span className={styles.kpiChipAccent}>LIVE</span>
          </div>
          <div className={styles.kpiMeta}>
            Objects detected across all feeds
          </div>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.kpiTop}>
            <div>
              <div className={styles.kpiLabel}>System Health</div>
              <div className={styles.kpiValue}>{healthyCams}</div>
            </div>
            <span className={styles.kpiChipNeutral}>HEALTHY</span>
          </div>
          <div className={styles.kpiMeta}>Cameras running without errors</div>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.kpiTop}>
            <div>
              <div className={styles.kpiLabel}>Active Rate</div>
              <div className={styles.kpiValue}>{activeRate}%</div>
            </div>
            <span
              className={
                kpiStatus === 'OFFLINE'
                  ? styles.kpiChipNeutral
                  : kpiStatus === 'ATTENTION'
                    ? styles.kpiChipWarning
                    : styles.kpiChipSuccess
              }
            >
              {kpiStatus}
            </span>
          </div>
          <div className={styles.kpiMeta}>
            {errorCams} camera(s) reporting issues
          </div>
        </div>
      </section>

      <CameraStrip cameras={visibleCameras.slice(0, 5)} />

      <section className={styles.bottomGrid}>
        <div className={styles.chartCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.cardTitle}>Alert Trend</h3>
              <p className={styles.sectionSubtitle}>
                Detection intensity across the active network
              </p>
            </div>
          </div>

          <div className={styles.chartArea}>
            <AlertsChart cameras={visibleCameras} />
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.cardTitle}>Priority Cameras</h3>
              <p className={styles.sectionSubtitle}>Highest activity feeds</p>
            </div>
          </div>

          <div className={styles.priorityList}>
            {priorityCameras.length > 0 ? (
              priorityCameras.map((cam) => {
                const detections = cam?.result?.detections?.length || 0;
                const badgeTone = cam?.isActive
                  ? styles.priorityBadgeActive
                  : styles.priorityBadgeOffline;

                return (
                  <div key={cam.id} className={styles.priorityItem}>
                    <div>
                      <strong>{cam.label}</strong>
                      <div className={styles.priorityMeta}>
                        {cam?.isActive ? 'Streaming live' : 'Awaiting feed'}
                      </div>
                    </div>

                    <div className={`${styles.priorityBadge} ${badgeTone}`}>
                      {detections} detections
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>No camera activity yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.trendSection}>
        <div className={styles.trendCard}>
          <div className={styles.trendCardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Alert Generation Breakdown</h3>
              <p className={styles.sectionSubtitle}>
                Phân tích alert theo khung thời gian
              </p>
            </div>
            <div className={styles.trendPill}>Live analytics</div>
          </div>

          <div className={styles.tabRow}>
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${styles.tabButton} ${selectedRange === option.key ? styles.tabButtonActive : ''}`}
                onClick={() => setSelectedRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.trendSummary}>
            <span>Đang xem theo {selectedTrendLabel}</span>
            <span>{detectionsCount} alert tổng</span>
          </div>

          <div className={styles.chartArea}>
            <AlertsChart cameras={visibleCameras} range={selectedRange} />
          </div>
        </div>
      </section>
    </div>
  );
}
