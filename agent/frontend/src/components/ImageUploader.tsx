"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Camera, X } from "lucide-react";

interface ImageUploaderProps {
  onImageSelected: (file: File, preview: string) => void;
  onCameraCapture?: (b64: string) => void;
  accept?: string;
  showCamera?: boolean;
}

export default function ImageUploader({
  onImageSelected,
  onCameraCapture,
  accept = "image/*",
  showCamera = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      onImageSelected(file, url);
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  }, [handleFile]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      alert("Camera unavailable. Check browser permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg").split(",")[1];
    stopCamera();
    onCameraCapture?.(b64);
  }, [stopCamera, onCameraCapture]);

  const clearImage = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (preview) {
    return (
      <div className="preview-wrapper" style={{ display: "inline-block" }}>
        <img src={preview} alt="Preview" className="preview-img" />
        <button className="preview-remove" onClick={clearImage}>
          <X size={12} /> Remove
        </button>
      </div>
    );
  }

  if (cameraActive) {
    return (
      <div>
        <video
          ref={videoRef}
          style={{ width: "100%", maxHeight: 320, borderRadius: "var(--r)", border: "1px solid var(--border)" }}
          autoPlay playsInline muted
        />
        <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
          <button className="btn btn-accent" onClick={captureFrame}>
            <Camera size={16} /> Capture
          </button>
          <button className="btn btn-ghost" onClick={stopCamera}>
            <X size={16} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`drop-zone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="drop-zone-icon"><Upload size={32} /></div>
        <div className="drop-zone-text">Drop an image here or click to browse</div>
        <div className="drop-zone-hint">JPEG, PNG, WebP, BMP</div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {showCamera && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: "var(--sp-3)", width: "100%" }}
          onClick={(e) => { e.stopPropagation(); startCamera(); }}
        >
          <Camera size={16} /> Use Camera
        </button>
      )}
    </div>
  );
}
