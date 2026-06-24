'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import styles from '../app/(admin)/scada/dashboard/dashboard.module.css';

export default function StatusDonut({
  active,
  inactive,
}: any) {
  const data = [
    {
      name: 'Online',
      value: active,
    },
    {
      name: 'Offline',
      value: inactive,
    },
  ];

  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={65}
            outerRadius={95}
            strokeWidth={0}
          >
            <Cell fill="var(--success)" />
            <Cell fill="var(--error)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className={styles.donutCenter}>
        <div className={styles.donutNumber}>{active}</div>
        <div className={styles.donutLabel}>Active</div>
      </div>
    </div>
  );
}