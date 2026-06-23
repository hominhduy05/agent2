"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { getDetectionClient } from "@/lib/ws-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetBox {
  x1: number; y1: number;
  x2: number; y2: number;
  confidence: number;
  class_id: number;
  class_name: string;
  color: string;
}

type ExportGrade = "A" | "B" | "C" | "D";
type ActualCondition = "Xanh" | "Sượng" | "Chín" | "Sâu rầy" | "Hư";
type Category = "export_criteria" | "condition";
interface MediaDevice { deviceId: string; label: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScaleFit(natW: number, natH: number, clientW: number, clientH: number) {
  const imgAspect = natW / natH;
  const cAspect = clientW / clientH;
  let dW: number, dH: number, dX: number, dY: number;
  if (imgAspect > cAspect) {
    dW = clientW; dH = clientW / imgAspect;
    dX = 0; dY = (clientH - dH) / 2;
  } else {
    dH = clientH; dW = clientH * imgAspect;
    dX = (clientW - dW) / 2; dY = 0;
  }
  return { dW, dH, dX, dY };
}

function scaleToDisplay(
  ix: number, iy: number,
  dX: number, dY: number, dW: number, dH: number,
  natW: number, natH: number,
) {
  return {
    cx: (ix / natW) * dW + dX,
    cy: (iy / natH) * dH + dY,
  };
}

// ─── Colors ────────────────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#15803d",
  C: "#eab308",
  D: "#ef4444",
  "Xanh": "#22c55e",
  "Sượng": "#15803d",
  "Chín": "#eab308",
  "Sâu rầy": "#dc2626",
  "Hư": "#b91c1c",
};

const EXPORT_LABELS: ExportGrade[] = ["A", "B", "C", "D"];
const CONDITION_LABELS: ActualCondition[] = ["Xanh", "Sượng", "Chín", "Sâu rầy", "Hư"];

function getGradeDisplay(label: ExportGrade): string {
  return label;
}

function getGradeCssClass(label: ExportGrade): string {
  return `grade${label}`;
}

function getConditionCssClass(label: ActualCondition): string {
  switch (label) {
    case "Xanh": return "condXanh";
    case "Sượng": return "condSuong";
    case "Chín": return "condChin";
    case "Sâu rầy": return "condSauray";
    case "Hư": return "condHu";
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────

const LIVE_TARGET_ROI = {
  x1: 0.28,
  y1: 0.18,
  x2: 0.82,
  y2: 0.82,
};
const STABILITY_WINDOW = 7;
const STABLE_REQUIRED = 4;
const STABLE_IOU = 0.5;
const LIVE_DETECT_INTERVAL_MS = 800;

interface StableCandidate {
  box: DetBox;
  blob: Blob;
  width: number;
  height: number;
}

function boxIou(a: DetBox, b: DetBox): number {
  const ix1 = Math.max(a.x1, b.x1);
  const iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2);
  const iy2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

function fitWholeFruitBox(boxes: DetBox[], width: number, height: number): DetBox[] {
  if (boxes.length === 0 || width <= 0 || height <= 0) return [];

  const candidates = boxes.filter((box) => {
    const bw = Math.max(0, box.x2 - box.x1);
    const bh = Math.max(0, box.y2 - box.y1);
    const areaRatio = (bw * bh) / (width * height);
    const cx = ((box.x1 + box.x2) / 2) / width;
    const cy = ((box.y1 + box.y2) / 2) / height;
    const touchesEdge =
      box.x1 <= 3 || box.y1 <= 3 || box.x2 >= width - 3 || box.y2 >= height - 3;

    return (
      !touchesEdge &&
      areaRatio >= 0.015 &&
      areaRatio <= 0.45 &&
      cx >= LIVE_TARGET_ROI.x1 &&
      cx <= LIVE_TARGET_ROI.x2 &&
      cy >= LIVE_TARGET_ROI.y1 &&
      cy <= LIVE_TARGET_ROI.y2
    );
  });

  if (candidates.length === 0) return [];

  const roiCx = (LIVE_TARGET_ROI.x1 + LIVE_TARGET_ROI.x2) / 2;
  const roiCy = (LIVE_TARGET_ROI.y1 + LIVE_TARGET_ROI.y2) / 2;
  const best = [...candidates].sort((a, b) => {
    const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    const acx = ((a.x1 + a.x2) / 2) / width;
    const acy = ((a.y1 + a.y2) / 2) / height;
    const bcx = ((b.x1 + b.x2) / 2) / width;
    const bcy = ((b.y1 + b.y2) / 2) / height;
    const distA = Math.hypot(acx - roiCx, acy - roiCy);
    const distB = Math.hypot(bcx - roiCx, bcy - roiCy);
    const scoreA = Math.max(a.confidence, 0.1) + Math.min(areaA / (width * height), 0.25) - distA;
    const scoreB = Math.max(b.confidence, 0.1) + Math.min(areaB / (width * height), 0.25) - distB;
    return scoreB - scoreA;
  })[0];

  const bw = Math.max(1, best.x2 - best.x1);
  const bh = Math.max(1, best.y2 - best.y1);
  const padX = Math.max(12, bw * 0.22);
  const padY = Math.max(12, bh * 0.22);

  return [{
    ...best,
    x1: Math.max(0, best.x1 - padX),
    y1: Math.max(0, best.y1 - padY),
    x2: Math.min(width, best.x2 + padX),
    y2: Math.min(height, best.y2 + padY),
  }];
}

function cropBlobToBox(blob: Blob, box: DetBox): Promise<{ file: File; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const x = Math.max(0, Math.floor(box.x1));
      const y = Math.max(0, Math.floor(box.y1));
      const w = Math.min(img.naturalWidth - x, Math.ceil(box.x2 - box.x1));
      const h = Math.min(img.naturalHeight - y, Math.ceil(box.y2 - box.y1));
      if (w <= 4 || h <= 4) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      canvas.toBlob((cropBlob) => {
        if (!cropBlob) {
          resolve(null);
          return;
        }
        resolve({
          file: new File([cropBlob], "durian-crop.jpg", { type: "image/jpeg" }),
          width: w,
          height: h,
        });
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

interface InteractiveFaceSlotProps {
  face: string;
  state: {
    image: string | null;
    file: File | null;
    grade: ExportGrade | null;
    condition: ActualCondition | null;
    boxes: DetBox[];
    imgWidth: number;
    imgHeight: number;
    mode: "upload" | "camera";
    videoStream: MediaStream | null;
    deviceId: string | null;
    deviceLabel: string | null;
    saved: boolean;
  };
  threshold: number;
  category: Category;
  devices: MediaDevice[];
  activeDeviceIds: string[];
  onRefreshDevices: () => void | Promise<void>;
  onState: (s: Partial<{
    image: string | null;
    file: File | null;
    grade: ExportGrade | null;
    condition: ActualCondition | null;
    boxes: DetBox[];
    imgWidth: number;
    imgHeight: number;
    mode: "upload" | "camera";
    videoStream: MediaStream | null;
    deviceId: string | null;
    deviceLabel: string | null;
    saved: boolean;
  }>) => void;
  // onDetect: được gọi với (file, imgWidth, imgHeight) từ InteractiveFaceSlot
  onDetect: (file: File, imgWidth: number, imgHeight: number) => Promise<void>;
  onSave: () => void;
  isSaving: boolean;
}

// ─── InteractiveFaceSlot ─────────────────────────────────────────────────────

export default function InteractiveFaceSlot({
  face,
  state,
  threshold,
  category,
  devices,
  activeDeviceIds,
  onRefreshDevices,
  onState,
  onDetect,
  onSave,
  isSaving,
}: InteractiveFaceSlotProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detecting, setDetecting]     = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [sourceMode, setSourceMode] = useState<"webcam" | "ip">("webcam");
  const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
  const [previewBoxes, setPreviewBoxes] = useState<DetBox[]>([]);
  const liveDetectingRef = useRef(false);
  const frozenFrameUrlRef = useRef<string | null>(null);
  const stableCandidatesRef = useRef<StableCandidate[]>([]);
  const onStateRef = useRef(onState);

  const hasImage = state.image !== null;
  const availableDevices = devices.filter(
    (dev) => !activeDeviceIds.includes(dev.deviceId) || dev.deviceId === state.deviceId
  );

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  // ── Draw canvas ──────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas   = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const clientW = container.clientWidth;
    const clientH = container.clientHeight;
    canvas.width  = clientW;
    canvas.height = clientH;

    const natImg = document.getElementById(`img-${face}`) as HTMLImageElement | null;
    const video = videoRef.current;
    const frozenImg = document.getElementById(`frozen-${face}`) as HTMLImageElement | null;
    const natW = hasImage
      ? (natImg?.naturalWidth || clientW)
      : (frozenImg?.naturalWidth || video?.videoWidth || clientW);
    const natH = hasImage
      ? (natImg?.naturalHeight || clientH)
      : (frozenImg?.naturalHeight || video?.videoHeight || clientH);
    const { dW, dH, dX, dY } = getScaleFit(natW, natH, clientW, clientH);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, clientW, clientH);

    const boxesToDraw = frozenFrameUrl ? previewBoxes : state.boxes;
    for (const box of boxesToDraw) {
      const { cx: dx1, cy: dy1 } = scaleToDisplay(box.x1, box.y1, dX, dY, dW, dH, natW, natH);
      const { cx: dx2, cy: dy2 } = scaleToDisplay(box.x2, box.y2, dX, dY, dW, dH, natW, natH);
      const bw = dx2 - dx1;
      const bh = dy2 - dy1;

      // Color follows the currently selected label, falls back to box color
      const activeLabel = category === "export_criteria" ? state.grade : state.condition;
      const color = activeLabel
        ? (LABEL_COLORS[activeLabel] || "#ffffff")
        : box.color;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(dx1, dy1, bw, bh);
    }
  }, [face, frozenFrameUrl, hasImage, previewBoxes, state.boxes, state.grade, state.condition, category]);

  useEffect(() => {
    if (!hasImage) return;
    const img = document.getElementById(`img-${face}`) as HTMLImageElement | null;
    if (!img) return;
    if (img.complete) redrawCanvas();
    else img.addEventListener("load", redrawCanvas);
    return () => img?.removeEventListener("load", redrawCanvas);
  }, [hasImage, face, redrawCanvas]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !state.videoStream || state.mode !== "camera") return;
    if (video.srcObject !== state.videoStream) {
      video.srcObject = state.videoStream;
    }
    video.play().catch(() => {});
  }, [state.videoStream, state.mode, isStreaming, frozenFrameUrl]);

  useEffect(() => {
    if (state.videoStream || !isStreaming) return;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
  }, [state.videoStream, isStreaming]);

  useEffect(() => () => {
    if (frozenFrameUrlRef.current) URL.revokeObjectURL(frozenFrameUrlRef.current);
    stableCandidatesRef.current = [];
  }, []);

  useEffect(() => {
    if (state.file || !frozenFrameUrlRef.current) return;
    URL.revokeObjectURL(frozenFrameUrlRef.current);
    frozenFrameUrlRef.current = null;
    setFrozenFrameUrl(null);
    setPreviewBoxes([]);
    stableCandidatesRef.current = [];
  }, [state.file]);

  useEffect(() => {
    if (!isStreaming || frozenFrameUrl || hasImage || state.mode !== "camera") return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const detectLiveFrame = async () => {
      if (cancelled || liveDetectingRef.current) return;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

      const tc = document.createElement("canvas");
      tc.width = video.videoWidth;
      tc.height = video.videoHeight;
      const ctx = tc.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        tc.toBlob(resolve, "image/jpeg", 0.82);
      });
      if (!blob || cancelled) return;

      liveDetectingRef.current = true;
      const file = new File([blob], `${face}-live.jpg`, { type: "image/jpeg" });
      await runDetect(
        file,
        (boxes, w, h) => {
          const imgWidth = w || video.videoWidth;
          const imgHeight = h || video.videoHeight;
          const fittedBoxes = fitWholeFruitBox(boxes, imgWidth, imgHeight);
          if (fittedBoxes.length === 0) {
            onStateRef.current({ boxes: [], file: null, imgWidth, imgHeight });
            stableCandidatesRef.current = [];
            return;
          }

          const latestCandidate: StableCandidate = {
            box: fittedBoxes[0],
            blob,
            width: imgWidth,
            height: imgHeight,
          };
          stableCandidatesRef.current = [
            ...stableCandidatesRef.current,
            latestCandidate,
          ].slice(-STABILITY_WINDOW);

          const stableCluster = stableCandidatesRef.current.filter(
            (candidate) => boxIou(candidate.box, latestCandidate.box) >= STABLE_IOU
          );
          if (stableCluster.length < STABLE_REQUIRED) return;

          const accepted = [...stableCluster].sort((a, b) => {
            const areaA = Math.max(0, a.box.x2 - a.box.x1) * Math.max(0, a.box.y2 - a.box.y1);
            const areaB = Math.max(0, b.box.x2 - b.box.x1) * Math.max(0, b.box.y2 - b.box.y1);
            return (b.box.confidence * areaB) - (a.box.confidence * areaA);
          })[0];

          cropBlobToBox(accepted.blob, accepted.box).then((crop) => {
            if (cancelled) return;
            if (!crop) {
              onStateRef.current({ boxes: [], file: null, imgWidth, imgHeight });
              stableCandidatesRef.current = [];
              return;
            }

            if (frozenFrameUrlRef.current) URL.revokeObjectURL(frozenFrameUrlRef.current);
            const nextFrozenUrl = URL.createObjectURL(accepted.blob);
            frozenFrameUrlRef.current = nextFrozenUrl;
            setFrozenFrameUrl(nextFrozenUrl);
            setPreviewBoxes([accepted.box]);
            onStateRef.current({
              file: crop.file,
              boxes: [{
                ...accepted.box,
                x1: 0,
                y1: 0,
                x2: crop.width,
                y2: crop.height,
              }],
              imgWidth: crop.width,
              imgHeight: crop.height,
            });
            stableCandidatesRef.current = [];
          });
        },
        undefined,
        Math.min(threshold, 0.15),
      );
      liveDetectingRef.current = false;
    };

    detectLiveFrame();
    const timer = window.setInterval(detectLiveFrame, LIVE_DETECT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      liveDetectingRef.current = false;
    };
  }, [face, frozenFrameUrl, hasImage, isStreaming, state.mode, threshold]);

  useEffect(() => {
    if (!isStreaming || hasImage) return;
    redrawCanvas();
  }, [hasImage, isStreaming, redrawCanvas, state.boxes]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const tmpImg = new window.Image();
    tmpImg.onload = () => {
      const w = tmpImg.naturalWidth;
      const h = tmpImg.naturalHeight;
      onState({ image: url, file, boxes: [], imgWidth: w, imgHeight: h, mode: "upload", videoStream: null, deviceId: null, deviceLabel: null });
      stopCamera();
      setDetecting(true);
      onDetect(file, w, h).finally(() => setDetecting(false));
    };
    tmpImg.src = url;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const tmpImg = new window.Image();
    tmpImg.onload = () => {
      const w = tmpImg.naturalWidth;
      const h = tmpImg.naturalHeight;
      onState({ image: url, file, boxes: [], imgWidth: w, imgHeight: h, mode: "upload", videoStream: null, deviceId: null, deviceLabel: null });
      stopCamera();
      setDetecting(true);
      onDetect(file, w, h).finally(() => setDetecting(false));
    };
    tmpImg.src = url;
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = async (device?: MediaDevice) => {
    try {
      if (!device && devices.length === 0) {
        await onRefreshDevices();
      }
      device = device || availableDevices[0] || devices[0];
      if (devices.length > 0 && availableDevices.length === 0) return;
      if (devices.length > 0 && !device) return;
      state.videoStream?.getTracks().forEach((track) => track.stop());
      if (frozenFrameUrlRef.current) URL.revokeObjectURL(frozenFrameUrlRef.current);
      frozenFrameUrlRef.current = null;
      setFrozenFrameUrl(null);
      setPreviewBoxes([]);
      stableCandidatesRef.current = [];
      onState({ boxes: [], file: null });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: device
          ? { deviceId: { exact: device.deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        videoRef.current.play().catch(() => {});
      }
      onState({
        videoStream: stream,
        mode: "camera",
        image: null,
        boxes: [],
        deviceId: device?.deviceId || null,
        deviceLabel: device?.label || "Camera",
      });
      setIsStreaming(true);
      setShowDeviceModal(false);
    } catch { /* ignore */ }
  };

  const stopCamera = () => {
    if (frozenFrameUrlRef.current) URL.revokeObjectURL(frozenFrameUrlRef.current);
    frozenFrameUrlRef.current = null;
    setFrozenFrameUrl(null);
    setPreviewBoxes([]);
    stableCandidatesRef.current = [];
    state.videoStream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
  };

  const reloadCameraDetect = () => {
    if (frozenFrameUrlRef.current) URL.revokeObjectURL(frozenFrameUrlRef.current);
    frozenFrameUrlRef.current = null;
    setFrozenFrameUrl(null);
    setPreviewBoxes([]);
    stableCandidatesRef.current = [];
    liveDetectingRef.current = false;
    onState({ file: null, boxes: [], grade: null, condition: null, imgWidth: 0, imgHeight: 0 });
  };

  useEffect(() => () => { stopCamera(); }, []);

  const handleModeSwitch = (mode: "upload" | "camera") => {
    if (mode === state.mode) return;
    stopCamera();
    onState({ image: null, file: null, videoStream: null, deviceId: null, deviceLabel: null, mode, boxes: [] });
  };

  // ── Status ─────────────────────────────────────────────────────────────────
  const getStatusText = () => {
    if (state.saved) return "Đã lưu";
    if (state.mode === "camera" && isStreaming && state.file) return "Đang nhận diện";
    if (state.mode === "camera" && isStreaming) return "Đang camera";
    if (!hasImage) return "Chưa chụp";
    if (state.grade && state.condition) return "Sẵn sàng lưu";
    if (state.grade || state.condition) return "Chưa đủ nhãn";
    return "Chưa nhãn";
  };

  const getStatusClass = () => {
    if (state.saved) return `${styles.faceStatus} ${styles.savedStatus}`;
    if (state.mode === "camera" && isStreaming) return `${styles.faceStatus} ${styles.readyStatus}`;
    if (!hasImage) return styles.faceStatus;
    if (state.grade && state.condition) return `${styles.faceStatus} ${styles.labeledStatus}`;
    return `${styles.faceStatus} ${styles.readyStatus}`;
  };

  const getStatusDotClass = () => {
    if (state.saved) return `${styles.statusDot} ${styles.savedDot}`;
    if (state.mode === "camera" && isStreaming) return `${styles.statusDot} ${styles.ready}`;
    if (!hasImage) return styles.statusDot;
    if (state.grade && state.condition) return `${styles.statusDot} ${styles.labeledDot}`;
    return `${styles.statusDot} ${styles.ready}`;
  };

  return (
    <div className={styles.faceCard}>
      {/* Card header */}
      <div className={styles.cardTop}>
        <span className={styles.faceLabel}>{face}</span>
        <span className={getStatusClass()}>
          <span className={getStatusDotClass()} />
          {getStatusText()}
        </span>
      </div>

      {/* Image viewport with canvas overlay */}
      <div
        ref={containerRef}
        className={styles.viewport}
        style={{ cursor: hasImage ? "crosshair" : "default" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {hasImage ? (
          <>
            <img
              id={`img-${face}`}
              src={state.image!}
              alt={face}
              className={styles.uploadedImg}
              draggable={false}
            />
            <canvas ref={canvasRef} className={styles.overlay} />
          </>
        ) : state.mode === "camera" && isStreaming ? (
          <>
            {frozenFrameUrl ? (
              <img
                id={`frozen-${face}`}
                src={frozenFrameUrl}
                alt={face}
                className={styles.uploadedImg}
                draggable={false}
                onLoad={redrawCanvas}
              />
            ) : (
              <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
            )}
            {!frozenFrameUrl && state.boxes.length === 0 && (
              <div className={styles.cameraGuide} aria-hidden="true"><div className={styles.guideFrame} /></div>
            )}
            <canvas ref={canvasRef} className={styles.overlay} />
          </>
        ) : (
          <div className={styles.placeholder} onClick={() => fileInputRef.current?.click()}>
            <svg className={styles.placeholderIcon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className={styles.placeholderText}>Kéo thả ảnh<br/>hoặc bấm để chọn</span>
          </div>
        )}

        {/* Overlay spinner */}
        {(detecting || isSaving) && (
          <div className={styles.overlayInner}>
            {isSaving ? (
              <>
                <div className={styles.spinner} />
                <span style={{ color: "#fff", fontSize: 12, marginTop: 8 }}>Đang lưu...</span>
              </>
            ) : (
              <>
                <div className={styles.spinner} />
                <span style={{ color: "#fff", fontSize: 12, marginTop: 8 }}>Đang phân tích...</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${state.mode === "upload" ? styles.active : ""}`}
            onClick={() => handleModeSwitch("upload")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            Upload
          </button>
          <button
            className={`${styles.modeBtn} ${state.mode === "camera" ? styles.active : ""}`}
            onClick={() => handleModeSwitch("camera")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            Camera
          </button>
        </div>

        {state.mode === "camera" && !hasImage && (
          <div className={styles.cameraDevicePanel}>
            <div className={styles.cameraActionRow}>
              <button
                className={`${styles.modeBtn} ${styles.active}`}
                onClick={() => setShowDeviceModal(true)}
                disabled={!isStreaming && devices.length > 0 && availableDevices.length === 0}
              >
                {isStreaming ? "Đổi camera" : "Bật camera"}
              </button>
              {isStreaming && (
                <button
                  className={styles.cameraReloadBtn}
                  onClick={reloadCameraDetect}
                  title="Tải lại nhận diện"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.58"/>
                  </svg>
                  Tải lại
                </button>
              )}
              {isStreaming && (
                <button
                  className={styles.cameraStopBtn}
                  onClick={() => {
                    stopCamera();
                    onState({ file: null, videoStream: null, deviceId: null, deviceLabel: null, boxes: [], imgWidth: 0, imgHeight: 0 });
                  }}
                >
                  Tắt
                </button>
              )}
            </div>
          </div>
        )}

        {showDeviceModal && (
          <div className={styles.deviceModalOverlay} onClick={() => setShowDeviceModal(false)}>
            <div className={styles.deviceModalCard} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.deviceModalTitle}>Chọn nguồn — {face}</h3>

              <div className={styles.sourceTabs}>
                <button
                  type="button"
                  className={`${styles.sourceTab} ${sourceMode === "webcam" ? styles.sourceTabActive : ""}`}
                  onClick={() => setSourceMode("webcam")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Webcam
                </button>
                <button
                  type="button"
                  className={`${styles.sourceTab} ${sourceMode === "ip" ? styles.sourceTabActive : ""}`}
                  onClick={() => setSourceMode("ip")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                  IP Camera
                </button>
              </div>

              {sourceMode === "webcam" ? (
                devices.length === 0 ? (
                  <div className={styles.modalEmpty}>
                    <span>Không tìm thấy webcam.</span>
                    <button type="button" onClick={() => onRefreshDevices()}>Quét lại</button>
                  </div>
                ) : (
                  <div className={styles.deviceList}>
                    {devices.map((dev) => {
                      const used = activeDeviceIds.includes(dev.deviceId);
                      return (
                        <button
                          key={dev.deviceId}
                          className={styles.deviceItem}
                          onClick={() => !used && startCamera(dev)}
                          disabled={used}
                        >
                          <span className={styles.deviceIcon}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                          </span>
                          <span className={styles.deviceText}>
                            <span className={styles.deviceName}>{dev.label}</span>
                            {used && <span className={styles.deviceUsed}>Đang dùng</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className={styles.modalEmpty}>
                  <span>Dataset hiện hỗ trợ chọn webcam trực tiếp.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

        {/* Re-detect */}
        {hasImage && state.file && (
          <button
            className={`${styles.modeBtn} ${styles.active}`}
            style={{ background: "var(--accent-faint)", borderColor: "var(--border-strong)", color: "var(--accent)" }}
            onClick={() => {
              setDetecting(true);
              onDetect(state.file!, state.imgWidth, state.imgHeight).finally(() => setDetecting(false));
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.58"/>
            </svg>
            Detect lại
          </button>
        )}

        {/* Grade label — Tiêu chí xuất khẩu */}
        <div className={styles.labelSection}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className={styles.sectionTitle}>Tiêu chí xuất khẩu</span>
            {state.saved && (
              <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 600 }}>Đã lưu</span>
            )}
          </div>
          <div className={styles.labelRow}>
            {EXPORT_LABELS.map((g) => {
              const isSelected = state.grade === g;
              const color = LABEL_COLORS[g];
              return (
                <button
                  key={g}
                  className={`${styles.labelBtn} ${styles[`grade${g}`]} ${isSelected ? styles.labelSelected : ""}`}
                  style={isSelected ? {
                    background: color + "22",
                    borderColor: color,
                    color: color,
                  } : {}}
                  onClick={() => onState({ grade: state.grade === g ? null : g })}
                  disabled={state.saved}
                >
                  {getGradeDisplay(g)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition label — Tình trạng thực tế */}
        <div className={styles.labelSection}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className={styles.sectionTitle}>Tình trạng thực tế</span>
          </div>
          <div className={styles.labelRow}>
            {CONDITION_LABELS.map((c) => {
              const isSelected = state.condition === c;
              const color = LABEL_COLORS[c];
              return (
                <button
                  key={c}
                  className={`${styles.labelBtn} ${styles[getConditionCssClass(c)]} ${isSelected ? styles.labelSelected : ""}`}
                  style={isSelected ? {
                    background: color + "22",
                    borderColor: color,
                    color: color,
                  } : {}}
                  onClick={() => onState({ condition: state.condition === c ? null : c })}
                  disabled={state.saved}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button — appears when BOTH labels are selected */}
        {state.file && state.grade && state.condition && !state.saved && (
          <button
            className={styles.saveSingleBtn}
            onClick={onSave}
            disabled={isSaving}
            style={{ marginTop: 6, width: "100%", justifyContent: "center" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
            </svg>
            Lưu Dataset (8 ảnh)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Exported detect helper ──────────────────────────────────────────────────

export async function runDetect(
  file: File,
  onState: (boxes: DetBox[], imgWidth: number, imgHeight: number) => void,
  setDetecting?: (v: boolean) => void,
  threshold = 0.3,
): Promise<void> {
  setDetecting?.(true);
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const wsClient = getDetectionClient();
    await wsClient.connect();

    const data = await wsClient.detect(dataUrl, threshold);

    const BOX_COLORS: Record<string, string> = {
      "Xanh": "#22c55e",
      "Sượng": "#15803d",
      "Chín": "#eab308",
      "Sâu rầy": "#dc2626",
      "Hư": "#b91c1c",
      "A": "#22c55e",
      "B": "#15803d",
      "C": "#eab308",
      "D": "#ef4444",
    };
    const boxes: DetBox[] = (data.detections || []).map((d) => ({
      ...d,
      color: BOX_COLORS[d.class_name] || "#ffffff",
    }));
    const imgWidth = data.image_width || 0;
    const imgHeight = data.image_height || 0;
    onState(boxes, imgWidth, imgHeight);
  } catch (e) {
    console.error("[detect]", e);
  } finally {
    setDetecting?.(false);
  }
}
