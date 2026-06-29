'use client';

import styles from '../app/(admin)/scada/dashboard/dashboard.module.css';

export default function RecentAlerts({ cameras }: any) {
  const alerts = cameras
    .filter((c: any) => c.result?.detections?.length > 0)
    .sort(
      (a: any, b: any) =>
        (b.result?.timestamp || 0) - (a.result?.timestamp || 0)
    );

  if (!alerts.length) {
    return <div className={styles.emptyState}>No detection activity yet.</div>;
  }

  return (
    <div className={styles.alerts}>
      {alerts.map((cam: any) => (
        <div key={cam.id} className={styles.alertItem}>
          <div>
            <div className={styles.alertTitle}>{cam.label}</div>
            <div className={styles.alertDate}>
              {new Date(cam.result.timestamp).toLocaleString()}
            </div>
          </div>

          <span className={styles.badgeDanger}>
            {cam.result.detections.length} objects
          </span>
        </div>
      ))}
    </div>
  );
}
