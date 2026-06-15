"use client";

import React from "react";
import { CameraChannel } from "@/lib/scada-camera";
import { classColor, classGrade, classLabel } from "@/lib/demo-class-display";

interface DetectionPanelProps {
  camera: CameraChannel;
  threshold: number;
  onThresholdChange: (v: number) => void;
  onToggleAuto: () => void;
  onCapture: () => void;
  onReset: () => void;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "var(--bg-elevated)",
      borderRadius: "10px",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}>
      <span style={{ color: "var(--text-faint)", fontSize: "10px", fontFamily: "var(--font-outfit)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ color, fontSize: "20px", fontFamily: "var(--font-sora)", fontWeight: 700, lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

function DetetionRow({ box }: { box: { class_name: string; confidence: number; x1: number; y1: number; x2: number; y2: number } }) {
  const color = classColor(box.class_name);
  const label = classLabel(box.class_name);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 12px",
      borderRadius: "8px",
      background: "var(--bg-elevated)",
    }}>
      {/* Class indicator */}
      <div style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }} />

      {/* Label + confidence */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "var(--text)", fontSize: "13px", fontFamily: "var(--font-outfit)", fontWeight: 600 }}>
            {label}
          </span>
          <span style={{
            color,
            fontSize: "11px",
            fontFamily: "var(--font-outfit)",
            fontWeight: 700,
          }}>
            {(box.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{
          color: "var(--text-faint)",
          fontSize: "10px",
          fontFamily: "var(--font-outfit)",
          marginTop: "2px",
        }}>
          x1:{box.x1.toFixed(0)} y1:{box.y1.toFixed(0)} x2:{box.x2.toFixed(0)} y2:{box.y2.toFixed(0)}
        </div>
      </div>

      {/* Status */}
      <span style={{
        background: `${color}18`,
        color,
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: "10px",
        fontWeight: 600,
        fontFamily: "var(--font-outfit)",
        flexShrink: 0,
      }}>
        Detected
      </span>
    </div>
  );
}

function HistoryRow({ result }: { result: { detections: { class_name: string }[]; timestamp: number } }) {
  const time = new Date(result.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const counts: Record<string, number> = {};
  result.detections.forEach((d) => {
    counts[d.class_name] = (counts[d.class_name] || 0) + 1;
  });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "6px 12px",
      borderBottom: "1px solid var(--border-soft)",
    }}>
      <span style={{
        color: "var(--text-faint)",
        fontSize: "11px",
        fontFamily: "var(--font-outfit)",
        width: "70px",
        flexShrink: 0,
      }}>
        {time}
      </span>
      {Object.entries(counts).map(([cls, count]) => {
        const color = classColor(cls);
        return (
          <span key={cls} style={{
            color,
            fontSize: "11px",
            fontFamily: "var(--font-outfit)",
            fontWeight: 700,
          }}>
            {classLabel(cls)}:{count}
          </span>
        );
      })}
      {result.detections.length === 0 && (
        <span style={{ color: "var(--text-faint)", fontSize: "11px", fontFamily: "var(--font-outfit)" }}>
          Khong co qua
        </span>
      )}
    </div>
  );
}

function qualityLabel(reason?: string) {
  const labels: Record<string, string> = {
    waiting_for_fruit: "Hãy cho trái vào vùng nhìn",
    fruit_outside_roi: "Trái nằm ngoài vùng nhìn",
    fruit_too_small_or_large: "Chưa đủ kích thước",
    fruit_too_close_to_edge: "Trái sát mép khung hình",
    frame_blurry: "Ảnh bị mờ",
    waiting_for_stability: "Đang đợi ổn định",
    waiting_for_stable_frame: "Đang đợi frame tốt",
    low_confidence: "Độ tin cậy thấp",
    frame_accepted: "Đã chụp frame",
    fruit_already_captured: "Đã chụp, cho trái rời vùng",
  };
  return labels[reason || ""] || "Đang kiểm tra chất lượng";
}

export default function DetectionPanel({
  camera,
  threshold,
  onThresholdChange,
  onToggleAuto,
  onCapture,
  onReset,
}: DetectionPanelProps) {
  const result = camera.result;
  const qualityText = qualityLabel(camera.qualityReason || result?.quality?.reason);
  const stableText = camera.requiredStableFrames
    ? `${camera.stableFrames ?? 0}/${camera.requiredStableFrames}`
    : `${camera.stableFrames ?? 0}`;
  const cropHistory = camera.cropHistory?.length
    ? camera.cropHistory
    : camera.lastCropDataUrl
      ? [{ dataUrl: camera.lastCropDataUrl, timestamp: camera.lastCropAt || Date.now(), detections: [] }]
      : [];
  const inspectionHistory = camera.inspectionHistory || [];
  const displayDetections = inspectionHistory.flatMap((item) => item.detections || []);

  const gradeCounts = displayDetections.reduce<Record<string, number>>((acc, d) => {
    const grade = classGrade(d.class_name);
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});
  const total = displayDetections.length;
  const avgConf = displayDetections.length
    ? (displayDetections.reduce((sum, d) => sum + d.confidence, 0) / displayDetections.length) * 100
    : 0;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      gap: "16px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "var(--accent-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div>
          <div style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: "15px",
            color: "var(--text)",
          }}>
            {camera.label}
          </div>
          <div style={{
            color: "var(--text-faint)",
            fontSize: "11px",
            fontFamily: "var(--font-outfit)",
          }}>
            {camera.deviceLabel || "Chua chon camera"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {camera.isDetecting && (
            <span style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              padding: "3px 10px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
            }}>
              Dang nhan dien
            </span>
          )}
          {camera.error && (
            <span style={{
              background: "rgba(240,68,56,0.1)",
              color: "#f04438",
              padding: "3px 10px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
            }}>
              Loi
            </span>
          )}
          {!camera.isDetecting && !camera.error && camera.isActive && (
            <span style={{
              background: "rgba(18,183,106,0.1)",
              color: "#12b76a",
              padding: "3px 10px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
            }}>
              San sang
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        <StatCard label="Tổng" value={total} color="var(--text)" />
        <StatCard label="Loai B" value={gradeCounts.B || 0} color={classColor("demo_grade_b")} />
        <StatCard label="Loai A" value={gradeCounts.A || 0} color={classColor("demo_grade_a")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <StatCard label="Loai C" value={gradeCounts.C || 0} color={classColor("demo_grade_c")} />
        <StatCard label="Loai D" value={gradeCounts.D || 0} color={classColor("demo_grade_d")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
        <StatCard label="Độ tin cậy" value={`${avgConf.toFixed(1)}%`} color="var(--accent)" />
      </div>

      {/* Frames processed */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        fontSize: "12px",
        fontFamily: "var(--font-outfit)",
        color: "var(--text-faint)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
        </svg>
        {camera.frameCount} frame da xu ly
        {result?.rawDetectionCount !== undefined && (
          <span>
            YOLO raw: {result.rawDetectionCount} | Track: {result.trackedDetectionCount ?? total} | Conf: {Math.round((result.confidenceThreshold ?? threshold) * 100)}%
          </span>
        )}
      </div>

      {/* Quality gate */}
      {camera.isActive && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          fontSize: "11px",
          fontFamily: "var(--font-outfit)",
        }}>
          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: "8px",
            padding: "8px 10px",
            color: "var(--text-muted)",
          }}>
            <div style={{ color: "var(--text-faint)", marginBottom: "3px" }}>Trang thai chup</div>
            <div style={{ color: camera.qualityPhase === "cooldown" || camera.qualityPhase === "captured" ? "#12b76a" : "var(--accent)", fontWeight: 700 }}>
              {qualityText}
            </div>
          </div>
          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: "8px",
            padding: "8px 10px",
            color: "var(--text-muted)",
          }}>
            <div style={{ color: "var(--text-faint)", marginBottom: "3px" }}>Net / on dinh</div>
            <div style={{ color: "var(--text)", fontWeight: 700 }}>
              Blur {camera.blurScore?.toFixed(0) ?? "-"} | Stable {stableText}
            </div>
          </div>
        </div>
      )}

      {/* Last crop */}
      <div style={{
        background: "var(--bg-elevated)",
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid var(--border-soft)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 11px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-outfit)",
        }}>
          <span style={{
            color: "var(--text-muted)",
            fontWeight: 700,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Top 3 ảnh gần nhất
          </span>
          <span style={{ color: "var(--text-faint)", fontSize: "11px" }}>
            {cropHistory.length}/3
          </span>
        </div>
        <div style={{
          minHeight: "150px",
          display: "grid",
          gridTemplateColumns: cropHistory.length > 1 ? "1fr 1fr 1fr" : "1fr",
          gap: "6px",
          padding: cropHistory.length > 0 ? "8px" : 0,
          background: "rgba(0,0,0,0.22)",
        }}>
          {cropHistory.length > 0 ? (
            cropHistory.slice(0, 3).map((crop, index) => (
              <div key={`${crop.timestamp}-${index}`} style={{
                minHeight: "132px",
                borderRadius: "8px",
                overflow: "hidden",
                border: index === 0 ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--border-soft)",
                background: "rgba(0,0,0,0.26)",
                position: "relative",
              }}>
                <img
                  src={crop.dataUrl}
                  alt={`Ảnh gần nhất ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <span style={{
                  position: "absolute",
                  left: "6px",
                  bottom: "6px",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  background: "rgba(0,0,0,0.62)",
                  color: index === 0 ? "#86efac" : "var(--text-faint)",
                  fontSize: "10px",
                  fontFamily: "var(--font-outfit)",
                  fontWeight: 700,
                }}>
                  #{index + 1}
                </span>
              </div>
            ))
          ) : (
            <span style={{
              color: "var(--text-faint)",
              fontSize: "12px",
              fontFamily: "var(--font-outfit)",
              alignSelf: "center",
              justifySelf: "center",
            }}>
              Chưa có ảnh gần nhất
            </span>
          )}
        </div>
      </div>

      {/* Detection list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{
          fontFamily: "var(--font-outfit)",
          fontWeight: 600,
          fontSize: "12px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "2px",
        }}>
          Chi tiết phát hiện ({total})
        </div>
        {!camera.isActive && (
          <div style={{
            color: "var(--text-faint)",
            fontSize: "13px",
            fontFamily: "var(--font-outfit)",
            textAlign: "center",
            padding: "24px",
          }}>
            Camera chưa bật. Chọn một camera để xem kết quả.
          </div>
        )}
        {camera.isActive && total === 0 && (
          <div style={{
            color: "var(--text-faint)",
            fontSize: "13px",
            fontFamily: "var(--font-outfit)",
            textAlign: "center",
            padding: "24px",
          }}>
            Không có trái nào được phát hiện.
          </div>
        )}
        {camera.isActive && displayDetections.map((d, i) => (
          <DetetionRow key={i} box={d} />
        ))}
      </div>

      {/* History */}
      {camera.resultHistory.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: "var(--font-outfit)",
            fontWeight: 600,
            fontSize: "12px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}>
            Lich su ({camera.resultHistory.length})
          </div>
          <div style={{
            background: "var(--bg-elevated)",
            borderRadius: "10px",
            overflow: "hidden",
            maxHeight: "120px",
            overflowY: "auto",
          }}>
            {camera.resultHistory.map((r, i) => (
              <HistoryRow key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        borderTop: "1px solid var(--border)",
        paddingTop: "14px",
        flexShrink: 0,
      }}>
        {/* Threshold */}
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "6px",
            fontSize: "12px",
            fontFamily: "var(--font-outfit)",
            color: "var(--text-muted)",
          }}>
            <span>Threshold</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{(threshold * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={95}
            value={threshold * 100}
            onChange={(e) => onThresholdChange(Number(e.target.value) / 100)}
            style={{
              width: "100%",
              accentColor: "var(--accent)",
              cursor: "pointer",
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onToggleAuto}
            disabled={!camera.isActive}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: "8px",
              border: camera.autoEnabled ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: camera.autoEnabled ? "var(--accent-dim)" : "var(--bg-elevated)",
              color: camera.autoEnabled ? "var(--accent)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
              cursor: camera.isActive ? "pointer" : "not-allowed",
              opacity: camera.isActive ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {camera.autoEnabled ? (
                <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
              ) : (
                <polygon points="5,3 19,12 5,21"/>
              )}
            </svg>
            {camera.autoEnabled ? "Dung Auto" : "Auto"}
          </button>

          <button
            onClick={onCapture}
            disabled={!camera.isActive || camera.isDetecting}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: camera.isActive ? "var(--text)" : "var(--text-faint)",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
              cursor: camera.isActive && !camera.isDetecting ? "pointer" : "not-allowed",
              opacity: camera.isActive && !camera.isDetecting ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
            {camera.isDetecting ? "Dang xu ly..." : "Chup ngay"}
          </button>

          <button
            onClick={onReset}
            disabled={!camera.isActive}
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-outfit)",
              cursor: camera.isActive ? "pointer" : "not-allowed",
              opacity: camera.isActive ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
