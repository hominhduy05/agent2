"use client";

import AdminLayout from "@/components/layout/AdminLayout";

export default function MesLayout() {
  return (
    <AdminLayout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "16px",
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--accent-dim)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: "Sora, sans-serif",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          MES — Manufacturing Execution System
        </h1>
        <p style={{
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}>
          Module quản lý sản xuất theo chuẩn MES Level 3. Đang trong quá trình phát triển.
        </p>
        <div style={{
          marginTop: "8px",
          padding: "8px 16px",
          borderRadius: "20px",
          background: "var(--amber-dim)",
          color: "var(--amber)",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontFamily: "Outfit, sans-serif",
        }}>
          Coming Soon
        </div>
      </div>
    </AdminLayout>
  );
}
