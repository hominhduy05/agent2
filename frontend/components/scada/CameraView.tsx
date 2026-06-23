"use client";

import React, { forwardRef } from "react";
import { CameraChannel } from "@/lib/scada-camera";
import { classColor } from "@/lib/demo-class-display";

interface CameraViewProps {
  camera: CameraChannel;
  isSelected: boolean;
  onSelect: () => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
}

const CameraView = forwardRef<HTMLDivElement, CameraViewProps>(
  ({ camera, isSelected, onSelect, onStartCamera, onStopCamera }, ref) => {
    const statusBadge = () => {
      if (camera.error) {
        return (
          <span style={{
            background: "rgba(240,68,56,0.15)",
            color: "#f04438",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
          }}>
            Loi
          </span>
        );
      }
      if (camera.isDetecting) {
        return (
          <span style={{
            background: "rgba(99,102,241,0.15)",
            color: "var(--accent)",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
          }}>
            Dang nhan dien...
          </span>
        );
      }
      if (camera.autoEnabled && camera.isActive) {
        return (
          <span style={{
            background: "rgba(18,183,106,0.15)",
            color: "#12b76a",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
          }}>
            Auto
          </span>
        );
      }
      if (camera.isActive) {
        return (
          <span style={{
            background: "rgba(102,112,133,0.15)",
            color: "var(--text-muted)",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
          }}>
            Dung
          </span>
        );
      }
      return (
        <span style={{
          background: "rgba(102,112,133,0.08)",
          color: "var(--text-faint)",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "10px",
          fontWeight: 600,
        }}>
          Chua bat
        </span>
      );
    };

    return (
      <div
        ref={ref}
        onClick={onSelect}
        style={{
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          cursor: "pointer",
          aspectRatio: "16/9",
          background: "var(--bg-surface)",
          border: isSelected
            ? "2px solid var(--accent)"
            : "2px solid var(--border)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: isSelected ? "0 0 0 3px var(--accent-glow)" : "none",
        }}
      >
        {/* Video layer */}
        <video
          ref={camera.videoRef as React.RefObject<HTMLVideoElement>}
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: camera.isActive ? "block" : "none",
          }}
        />

        {/* Canvas overlay */}
        <canvas
          ref={camera.canvasRef as React.RefObject<HTMLCanvasElement>}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />

        {/* Empty state */}
        {!camera.isActive && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span style={{ color: "var(--text-faint)", fontSize: "11px", fontFamily: "var(--font-outfit)" }}>
              Chua ket noi
            </span>
          </div>
        )}

        {/* Top bar: label + status */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
        }}>
          <span style={{
            color: "#fff",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "var(--font-sora)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}>
            {camera.label}
          </span>
          {statusBadge()}
        </div>

        {/* Bottom bar: detection count + actions */}
        {camera.isActive && (
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
          }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {camera.result?.detections.length !== undefined && camera.result?.detections.length > 0 && (
                camera.result.detections.map((d, i) => {
                  return (
                    <span key={i} style={{
                      background: `${classColor(d.class_name)}cc`,
                      color: "#fff",
                      padding: "1px 6px",
                      borderRadius: "8px",
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "var(--font-outfit)",
                    }}>
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  );
                })
              )}
              {(!camera.result?.detections || camera.result.detections.length === 0) && (
                <span style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "10px",
                  fontFamily: "var(--font-outfit)",
                }}>
                  Khong co qua
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (camera.isActive) onStopCamera();
                else onStartCamera();
              }}
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                color: "#fff",
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-outfit)",
              }}
            >
              {camera.isActive ? "Tat" : "Bat"}
            </button>
          </div>
        )}

        {/* Error overlay */}
        {camera.error && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(240,68,56,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{
              color: "#f04438",
              fontSize: "11px",
              fontFamily: "var(--font-outfit)",
              fontWeight: 600,
              padding: "4px 10px",
              background: "rgba(240,68,56,0.15)",
              borderRadius: "8px",
            }}>
              {camera.error}
            </span>
          </div>
        )}
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
export default CameraView;
