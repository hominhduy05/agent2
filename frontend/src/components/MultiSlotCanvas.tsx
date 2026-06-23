"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDetectionClient } from "@/lib/ws-client";
import { BoundingBox } from "@/lib/types";

export interface SlotState {
  image: string | null;
  detections: BoundingBox[];
  isDetecting: boolean;
  error: string | null;
}

interface MultiSlotCanvasProps {
  onStatsUpdate: (slots: SlotState[]) => void;
}

interface SlotContext {
  image: string | null;
  file: File | null;
  detections: BoundingBox[];
  isDetecting: boolean;
  error: string | null;
  videoStream: MediaStream | null;
  imgWidth: number;
  imgHeight: number;
}

const SLOT_LABELS = ["Khung 1", "Khung 2", "Khung 3", "Khung 4"];

function freshSlot(): SlotContext {
  return {
    image: null,
    file: null,
    detections: [],
    isDetecting: false,
    error: null,
    videoStream: null,
    imgWidth: 0,
    imgHeight: 0,
  };
}

function slotToState(s: SlotContext): SlotState {
  return {
    image: s.image,
    detections: s.detections,
    isDetecting: s.isDetecting,
    error: s.error,
  };
}

export default function MultiSlotCanvas({ onStatsUpdate }: MultiSlotCanvasProps) {
  const [slots, setSlots] = useState<SlotContext[]>([
    freshSlot(), freshSlot(), freshSlot(), freshSlot(),
  ]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);

  const updateSlot = useCallback((idx: number, upd: Partial<SlotContext>) => {
    setSlots((prev) => {
      const next = prev.map((s, i) => i === idx ? { ...s, ...upd } : s);
      onStatsUpdate(next.map(slotToState));
      return next;
    });
  }, [onStatsUpdate]);

  const drawBoxes = useCallback((idx: number, image: string, detections: BoundingBox[]) => {
    const container = document.getElementById(`slot-container-${idx}`);
    const canvas = canvasRefs.current[idx];
    const imgEl = document.getElementById(`slot-img-${idx}`) as HTMLImageElement | null;
    if (!container || !canvas || !imgEl?.naturalWidth) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);

    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;
    const imgAspect = natW / natH;
    const cAspect = cw / ch;

    let dW: number, dH: number, dX: number, dY: number;
    if (imgAspect > cAspect) {
      dW = cw; dH = cw / imgAspect;
      dX = 0; dY = (ch - dH) / 2;
    } else {
      dH = ch; dW = ch * imgAspect;
      dX = (cw - dW) / 2; dY = 0;
    }

    const COLOR_MAP: Record<string, string> = {
      mature: "#22c55e",
      immature: "#f59e0b",
      defective: "#ef4444",
    };

    for (const box of detections) {
      const cx1 = (box.x1 / natW) * dW + dX;
      const cy1 = (box.y1 / natH) * dH + dY;
      const bw = ((box.x2 - box.x1) / natW) * dW;
      const bh = ((box.y2 - box.y1) / natH) * dH;
      const color = COLOR_MAP[box.class_name] || "#ffffff";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx1, cy1, bw, bh, 4);
      ctx.stroke();

      // Label
      const label = `${box.class_name} ${(box.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px Sora, sans-serif";
      const lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = `${color}cc`;
      ctx.beginPath();
      ctx.roundRect(cx1 + 3, cy1 + 3, lw, 18, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, cx1 + 7, cy1 + 15);
    }
  }, []);

  // Redraw boxes whenever detections change
  useEffect(() => {
    slots.forEach((slot, idx) => {
      if (slot.image) {
        const imgEl = document.getElementById(`slot-img-${idx}`) as HTMLImageElement | null;
        if (imgEl?.complete) {
          drawBoxes(idx, slot.image, slot.detections);
        }
      }
    });
  }, [slots, drawBoxes]);

  const handleImageLoad = useCallback((idx: number) => {
    const slot = slots[idx];
    if (slot?.image) {
      drawBoxes(idx, slot.image, slot.detections);
    }
  }, [slots, drawBoxes]);

  const runDetection = useCallback(async (idx: number, file: File, w: number, h: number) => {
    updateSlot(idx, { isDetecting: true, error: null });
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const wsClient = getDetectionClient();
      try {
        await wsClient.connect();
      } catch {
        updateSlot(idx, { isDetecting: false, error: "Không thể kết nối WS server" });
        return;
      }

      const result = await wsClient.detect(dataUrl, 0.25, 30000);
      if (result.error) {
        updateSlot(idx, { isDetecting: false, error: result.error });
      } else {
        updateSlot(idx, { isDetecting: false, detections: result.detections || [], imgWidth: w, imgHeight: h });
      }
    } catch (err) {
      updateSlot(idx, {
        isDetecting: false,
        error: err instanceof Error ? err.message : "Lỗi nhận diện",
      });
    }
  }, [updateSlot]);

  const handleFileChange = useCallback((idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const tmpImg = new window.Image();
    tmpImg.onload = () => {
      updateSlot(idx, {
        image: url,
        file,
        detections: [],
        imgWidth: tmpImg.naturalWidth,
        imgHeight: tmpImg.naturalHeight,
        error: null,
      });
      runDetection(idx, file, tmpImg.naturalWidth, tmpImg.naturalHeight);
    };
    tmpImg.src = url;
  }, [updateSlot, runDetection]);

  const handleDrop = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const input = fileInputRefs.current[idx];
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, []);

  const stopCamera = useCallback((idx: number) => {
    const slot = slots[idx];
    if (slot?.videoStream) {
      slot.videoStream.getTracks().forEach((t) => t.stop());
    }
  }, [slots]);

  const startCamera = useCallback(async (idx: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      updateSlot(idx, { videoStream: stream });
      const video = videoRefs.current[idx];
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => { video?.play().catch(() => {}); };
        video.play().catch(() => {});
      }
    } catch {
      updateSlot(idx, { error: "Không thể bật camera" });
    }
  }, [updateSlot]);

  const captureFrame = useCallback((idx: number) => {
    const video = videoRefs.current[idx];
    if (!video || video.readyState < 2) return;
    const tc = document.createElement("canvas");
    tc.width = video.videoWidth;
    tc.height = video.videoHeight;
    const ctx = tc.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    tc.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `slot-${idx + 1}.jpg`, { type: "image/jpeg" });
      updateSlot(idx, {
        image: url,
        file,
        detections: [],
        imgWidth: video.videoWidth,
        imgHeight: video.videoHeight,
        videoStream: null,
        error: null,
      });
      stopCamera(idx);
      runDetection(idx, file, video.videoWidth, video.videoHeight);
    }, "image/jpeg", 0.9);
  }, [slots, updateSlot, stopCamera, runDetection]);

  const handleSlotClick = useCallback((idx: number) => {
    setSelectedSlot(idx === selectedSlot ? null : idx);
  }, [selectedSlot]);

  const totalDetections = slots.reduce((s, slot) => s + slot.detections.length, 0);

  return (
    <div className="relative">
      {/* Stats bar */}
      {totalDetections > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            {totalDetections} phát hiện
          </span>
          {(["mature", "immature", "defective"] as const).map((cls) => {
            const count = slots.flatMap(s => s.detections).filter(d => d.class_name === cls).length;
            if (!count) return null;
            const colors: Record<string, string> = { mature: "#22c55e", immature: "#f59e0b", defective: "#ef4444" };
            return (
              <div key={cls} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: `${colors[cls]}15`, border: `1px solid ${colors[cls]}30`, color: colors[cls] }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors[cls] }} />
                {{ mature: "Chín", immature: "Chưa chín", defective: "Hư" }[cls]} {count}
              </div>
            );
          })}
        </div>
      )}

      {/* 4-slot grid */}
      <div className="grid grid-cols-2 gap-4">
        {slots.map((slot, idx) => {
          const isActive = activeSlot === idx;
          return (
            <div
              key={idx}
              id={`slot-container-${idx}`}
              className="relative rounded-2xl overflow-hidden transition-all"
              style={{
                aspectRatio: "4/3",
                background: "var(--bg-surface)",
                border: selectedSlot === idx ? "2px solid var(--accent)" : "1px solid var(--border)",
                cursor: slot.image ? "pointer" : "default",
              }}
              onClick={() => slot.image && handleSlotClick(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(idx, e)}
            >
              {/* Image / camera */}
              {slot.image ? (
                <>
                  <img
                    id={`slot-img-${idx}`}
                    src={slot.image}
                    alt={SLOT_LABELS[idx]}
                    className="w-full h-full object-cover"
                    onLoad={() => handleImageLoad(idx)}
                    draggable={false}
                  />
                  <canvas
                    ref={(el) => { canvasRefs.current[idx] = el; }}
                    className="absolute inset-0 w-full h-full"
                    style={{ zIndex: 2 }}
                  />
                </>
              ) : slot.videoStream ? (
                <video
                  ref={(el) => { videoRefs.current[idx] = el; }}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-3"
                  onClick={() => fileInputRefs.current[idx]?.click()}
                  style={{ cursor: "pointer" }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: "var(--text-faint)" }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                    Kéo thả hoặc bấm để chọn ảnh
                  </span>
                </div>
              )}

              {/* Detecting overlay */}
              {slot.isDetecting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
                  style={{ background: "rgba(0,0,0,0.55)" }}>
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-white">Đang phân tích...</span>
                </div>
              )}

              {/* Error overlay */}
              {slot.error && (
                <div className="absolute bottom-2 left-2 right-2 z-10 px-2 py-1 rounded-lg text-xs"
                  style={{ background: "var(--error-dim)", color: "var(--error)" }}>
                  {slot.error}
                </div>
              )}

              {/* Slot number badge */}
              <div
                className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  background: "var(--bg-overlay)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                  fontFamily: "Sora, sans-serif",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {idx + 1}
              </div>

              {/* Detection count badge */}
              {slot.detections.length > 0 && (
                <div
                  className="absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: "var(--accent)",
                    color: "#07090a",
                    fontFamily: "Sora, sans-serif",
                  }}
                >
                  {slot.detections.length} quả
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={(el) => { fileInputRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(idx, e)}
              />

              {/* Controls when image is shown */}
              {slot.image && (
                <div
                  className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Camera toggle */}
                  <button
                    onClick={() => {
                      if (slot.videoStream) {
                        stopCamera(idx);
                        updateSlot(idx, { videoStream: null });
                      } else {
                        setActiveSlot(idx);
                        startCamera(idx);
                      }
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)" }}
                    title="Chụp ảnh"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </button>

                  {/* Capture button */}
                  {slot.videoStream && (
                    <button
                      onClick={() => captureFrame(idx)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: "var(--accent)", color: "#07090a" }}
                      title="Chụp"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="5"/>
                      </svg>
                    </button>
                  )}

                  {/* Redetect */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (slot.file) runDetection(idx, slot.file, slot.imgWidth, slot.imgHeight);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)" }}
                    title="Detect lại"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-3.58"/>
                    </svg>
                  </button>

                  {/* Clear */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSlot(idx, freshSlot());
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)" }}
                    title="Xoá"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
