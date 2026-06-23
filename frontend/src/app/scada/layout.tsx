"use client";

import AdminLayout from "@/components/layout/AdminLayout";

export default function ScadaLayout() {
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: "Sora, sans-serif",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          SCADA — Giám sát điều khiển
        </h1>
        <p style={{
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}>
          Giao diện giám sát & điều khiển hệ thống IoT trong nhà kính. Đang trong quá trình phát triển.
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
