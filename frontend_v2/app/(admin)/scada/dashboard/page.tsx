'use client';

import { useScada } from '@/hooks/use-scada';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { cameras } = useScada();

  const totalCams = 5;

  const activeCams = cameras.filter((c) => c?.isActive).length;
  const inactiveCams = totalCams - activeCams;

  const detectionsCount = cameras.reduce(
    (sum, cam) => sum + (cam?.result?.detections?.length || 0),
    0
  );

  const errorCams = cameras.filter((c) => c?.error).length;

  const activeRate = Math.round((activeCams / totalCams) * 100);

  return (
    <div className={styles.dashboard}>
      {/* KPI STRIP */}
      <section className={styles.kpiStrip}>
        <div className={styles.kpiMain}>
          <div className={styles.kpiValue}>
            {activeCams}/{totalCams}
          </div>
          <div className={styles.kpiLabel}>Active Cameras</div>
        </div>

        <div className={styles.kpiDivider} />

        <div className={styles.kpiMain}>
          <div className={styles.kpiValue}>{activeRate}%</div>
          <div className={styles.kpiLabel}>Active Rate</div>
        </div>

        <div className={styles.kpiDivider} />

        <div className={styles.kpiMain}>
          <div className={styles.kpiValue}>{detectionsCount}</div>
          <div className={styles.kpiLabel}>Detections</div>
        </div>

        <div className={styles.kpiDivider} />

        <div className={styles.kpiMain}>
          <div className={styles.kpiValue}>{inactiveCams}</div>
          <div className={styles.kpiLabel}>Inactive Cameras</div>
        </div>
      </section>

      {/* METRIC GRID */}
      <section className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>System Errors</div>
          <div className={`${styles.metricValue} ${styles.danger}`}>
            {errorCams}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Mode</div>
          <div className={styles.metricValue}>LIVE</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Nodes</div>
          <div className={styles.metricValue}>{totalCams}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Engine</div>
          <div className={styles.metricValue}>YOLOv8</div>
        </div>
      </section>

      {/* SYSTEM BAR */}
      <section className={styles.systemBar}>
        <div className={styles.systemItem}>
          <span className={styles.dotGreen} />
          System Healthy
        </div>

        <div className={styles.systemItem}>
          Cameras: {activeCams}/{totalCams}
        </div>

        <div className={styles.systemItem}>
          Detections: {detectionsCount}
        </div>

        <div className={styles.systemItemRight}>
          SCADA v1.0 • YOLOv8
        </div>
      </section>

      {/* ANALYTICS TABLE */}
<section className={styles.analyticsSection}>
  <div className={styles.sectionHeader}>
    <h3 className={styles.sectionTitle}>Analytics Overview</h3>
    <span className={styles.sectionSubtitle}>
      Real-time detection breakdown per camera
    </span>
  </div>

  <div className={styles.tableWrapper}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Camera</th>
          <th>Status</th>
          <th>Detections</th>
          <th>Error</th>
          <th>Activity</th>
        </tr>
      </thead>

      <tbody>
        {Array.from({ length: totalCams }).map((_, i) => {
          const cam = cameras[i];
          const detections = cam?.result?.detections?.length || 0;

          return (
            <tr key={i}>
              <td>Cam {i + 1}</td>

              <td>
                <span
                  className={
                    cam?.isActive
                      ? styles.statusActive
                      : styles.statusOffline
                  }
                >
                  {cam?.isActive ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </td>

              <td>{detections}</td>

              <td>
                {cam?.error ? (
                  <span className={styles.statusError}>YES</span>
                ) : (
                  <span className={styles.statusOk}>NO</span>
                )}
              </td>

              <td>
                <div className={styles.activityBar}>
                  <div
                    className={styles.activityFill}
                    style={{
                      width: `${Math.min(detections * 10, 100)}%`,
                    }}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</section>
    </div>
  );
}