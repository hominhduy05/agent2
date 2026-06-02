"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BoundingBox } from "@/lib/types";
import { detectImage } from "@/lib/api";

export interface WebcamDetection {
  detections: BoundingBox[];
  imageWidth: number;
  imageHeight: number;
  imageDataUrl: string;
  timestamp: number;
  isDetecting: boolean;
  error: string | null;
}

export interface UseWebcamDetectOptions {
  /** Milliseconds between captures. Default: 3000 */
  captureInterval?: number;
  /** Confidence threshold for detections. Default: 0.25 */
  confidenceThreshold?: number;
  /** Device ID of the camera to use */
  deviceId?: string;
}

export interface UseWebcamDetectReturn {
  /** Current video stream (for display) */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Canvas showing detections */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Stream object (cleanup use) */
  stream: MediaStream | null;
  /** All detections in current session */
  detections: BoundingBox[];
  /** Latest detection result */
  latestResult: WebcamDetection | null;
  /** Camera status */
  isStreaming: boolean;
  /** Currently capturing + detecting */
  isDetecting: boolean;
  /** Camera permission error */
  error: string | null;
  /** Start the camera */
  startCamera: (deviceId?: string) => Promise<void>;
  /** Stop the camera */
  stopCamera: () => void;
  /** Start auto-detection */
  startDetecting: () => void;
  /** Stop auto-detection */
  stopDetecting: () => void;
  /** Capture a single frame manually */
  captureOnce: () => Promise<void>;
  /** Reset session stats */
  resetStats: () => void;
  /** Stats: total frames captured in session */
  sessionCount: number;
}

export function useWebcamDetect(
  options: UseWebcamDetectOptions = {}
): UseWebcamDetectReturn {
  const {
    captureInterval = 3000,
    confidenceThreshold = 0.25,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<WebcamDetection | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  // Accumulate all detections in session
  const [detections, setDetections] = useState<BoundingBox[]>([]);

  // ─── Draw detections on canvas ───────────────────────────────────────────
  const drawDetections = useCallback(
    (result: WebcamDetection) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { detections: boxes, imageWidth, imageHeight } = result;
      if (!imageWidth || !imageHeight) return;

      // Match canvas size to video display size
      const video = videoRef.current;
      if (!video) return;
      const displayWidth = video.clientWidth || video.offsetWidth || imageWidth;
      const displayHeight = video.clientHeight || video.offsetHeight || imageHeight;

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      const scaleX = displayWidth / imageWidth;
      const scaleY = displayHeight / imageHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      boxes.forEach((box) => {
        const x1 = box.x1 * scaleX;
        const y1 = box.y1 * scaleY;
        const x2 = box.x2 * scaleX;
        const y2 = box.y2 * scaleY;
        const w = x2 - x1;
        const h = y2 - y1;

        const colorMap: Record<string, string> = {
          mature: "#22c55e",
          immature: "#f59e0b",
          defective: "#ef4444",
        };
        const color = colorMap[box.class_name] || "#ffffff";

        // Label
        const label = `${box.class_name} ${(box.confidence * 100).toFixed(0)}%`;
        const labelX = x1 + 4;
        const labelY = y1 + 18;
        ctx.font = "bold 13px Sora, sans-serif";
        const labelW = ctx.measureText(label).width + 8;

        // Label bg
        ctx.fillStyle = `${color}cc`;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY - 13, labelW, 18, 3);
        ctx.fill();

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(x1, y1, w, h, 4);
        ctx.stroke();

        // Label text
        ctx.fillStyle = "#fff";
        ctx.fillText(label, labelX + 4, labelY);
      });
    },
    []
  );

  // ─── Capture + detect ──────────────────────────────────────────────────
  const captureAndDetect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    setIsDetecting(true);
    try {
      // Draw current frame to a temp canvas
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tctx = tempCanvas.getContext("2d");
      if (!tctx) return;
      tctx.drawImage(video, 0, 0);
      const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.85);

      // Convert to Blob for upload
      const blob = await new Promise<Blob | null>((res) =>
        tempCanvas.toBlob(res, "image/jpeg", 0.85)
      );
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      // Call detection API
      const res = await detectImage(file);
      if (!res.ok) throw new Error("Detection failed");

      const data = await res.json();
      const boxes: BoundingBox[] = (data.detections || []).filter(
        (d: BoundingBox) => d.confidence >= confidenceThreshold
      );

      const result: WebcamDetection = {
        detections: boxes,
        imageWidth: data.image_width || video.videoWidth,
        imageHeight: data.image_height || video.videoHeight,
        imageDataUrl: dataUrl,
        timestamp: Date.now(),
        isDetecting: false,
        error: null,
      };

      setLatestResult(result);
      setDetections((prev) => [...prev, ...boxes]);
      setSessionCount((c) => c + 1);
      drawDetections(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi nhận diện";
      setLatestResult((prev) => prev ? { ...prev, isDetecting: false, error: msg } : null);
    } finally {
      setIsDetecting(false);
    }
  }, [confidenceThreshold, drawDetections]);

  // ─── Start camera ───────────────────────────────────────────────────────
  const startCamera = useCallback(async (deviceId?: string) => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        videoRef.current.play().catch(() => {});
      }
      setIsStreaming(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Không có quyền truy cập camera. Vui lòng cho phép trong trình duyệt.");
        } else if (err.name === "NotFoundError") {
          setError("Không tìm thấy camera trên thiết bị.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Lỗi khi bật camera.");
      }
      setIsStreaming(false);
    }
  }, []);

  // ─── Stop camera ────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsStreaming(false);
    setIsDetecting(false);
  }, []);

  // ─── Start auto-detect ─────────────────────────────────────────────────
  const startDetecting = useCallback(() => {
    if (!isStreaming) return;
    // Capture immediately
    captureAndDetect();
    // Then repeat
    captureTimerRef.current = setInterval(() => {
      captureAndDetect();
    }, captureInterval);
  }, [isStreaming, captureAndDetect, captureInterval]);

  // ─── Stop auto-detect ───────────────────────────────────────────────────
  const stopDetecting = useCallback(() => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }, []);

  // ─── Manual capture ───────────────────────────────────────────────────
  const captureOnce = useCallback(async () => {
    if (!isStreaming) return;
    await captureAndDetect();
  }, [isStreaming, captureAndDetect]);

  // ─── Reset session ─────────────────────────────────────────────────────
  const resetStats = useCallback(() => {
    setDetections([]);
    setLatestResult(null);
    setSessionCount(0);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    stream,
    detections,
    latestResult,
    isStreaming,
    isDetecting,
    error,
    startCamera,
    stopCamera,
    startDetecting,
    stopDetecting,
    captureOnce,
    resetStats,
    sessionCount,
  };
}
