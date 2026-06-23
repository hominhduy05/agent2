"use client";

import React, { useEffect, useState } from "react";
import { configScadaCameras, getScadaCameras } from "@/lib/api";

interface CameraSlotConfig {
  slot: number;
  url: string;
  label: string;
}

interface CameraConfigProps {
  onClose: () => void;
  onSaved?: () => void;
}

export default function CameraConfig({ onClose, onSaved }: CameraConfigProps) {
  const [slots, setSlots] = useState<CameraSlotConfig[]>([
    { slot: 0, url: "", label: "Camera 1" },
    { slot: 1, url: "", label: "Camera 2" },
    { slot: 2, url: "", label: "Camera 3" },
    { slot: 3, url: "", label: "Camera 4" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScadaCameras()
      .then((data) => {
        const updated = slots.map((s) => {
          const cfg = data.cameras[String(s.slot)];
          return {
            ...s,
            url: cfg?.url || "",
            label: cfg?.url || s.label,
          };
        });
        setSlots(updated);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cameraMap: Record<string, string> = {};
      slots.forEach((s) => {
        cameraMap[String(s.slot)] = s.url;
      });
      await configScadaCameras(cameraMap);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loi luu cau hinh");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "16px",
          padding: "24px",
          width: "440px",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: "15px",
            color: "var(--text)",
            margin: "0 0 4px",
          }}>
            Cau hinh Camera IP
          </h2>
          <p style={{
            fontFamily: "var(--font-outfit)",
            fontSize: "12px",
            color: "var(--text-faint)",
            margin: 0,
          }}>
            Nhap RTSP URL cho tung camera slot. Bo trong neu khong su dung.
          </p>
        </div>

        {/* Slot inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          {slots.map((slot) => (
            <div key={slot.slot} style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "12px",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    background: "var(--accent-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-sora)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}>
                    {slot.slot + 1}
                  </div>
                  <span style={{
                    fontFamily: "var(--font-outfit)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text)",
                  }}>
                    {slot.label}
                  </span>
                </div>
              </div>
              <input
                type="text"
                placeholder={`rtsp://IP:${slot.slot + 101}:554/stream`}
                value={slot.url}
                onChange={(e) => {
                  setSlots((prev) =>
                    prev.map((s) =>
                      s.slot === slot.slot ? { ...s, url: e.target.value } : s
                    )
                  );
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontFamily: "var(--font-outfit)",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(240,68,56,0.1)",
            border: "1px solid rgba(240,68,56,0.2)",
            borderRadius: "8px",
            padding: "8px 12px",
            marginBottom: "12px",
            fontFamily: "var(--font-outfit)",
            fontSize: "12px",
            color: "#f04438",
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-outfit)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Huy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "none",
              background: saving ? "var(--border)" : "var(--accent)",
              color: "#fff",
              fontFamily: "var(--font-outfit)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              minWidth: "80px",
            }}
          >
            {saving ? "Dang luu..." : "Luu cau hinh"}
          </button>
        </div>
      </div>
    </div>
  );
}
