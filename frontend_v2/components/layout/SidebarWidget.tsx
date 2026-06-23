import React from 'react';
import { Leaf } from 'lucide-react';

const SidebarWidget: React.FC = () => {
  return (
    <div
      style={{
        borderRadius: 12,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        padding: 20,
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Leaf size={14} style={{ color: 'var(--accent)' }} />
        <h4
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          DurianPro v1.0
        </h4>
      </div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Nhận diện độ chín sầu riêng bằng YOLOv8 · Nông nghiệp thông minh
      </p>
      <div
        style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: 'var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent), #15803d)',
              width: '75%',
            }}
          />
        </div>
        <span
          style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 500 }}
        >
          75% KPI
        </span>
      </div>
    </div>
  );
};

export default SidebarWidget;
