"use client";

import React from "react";
import CameraView from "./CameraView";
import { CameraChannel } from "@/lib/scada-camera";

interface CameraGridProps {
  cameras: CameraChannel[];
  selectedCameraId: number | null;
  onSelect: (id: number) => void;
  onStartCamera: (id: number) => void;
  onStopCamera: (id: number) => void;
}

export default function CameraGrid({
  cameras,
  selectedCameraId,
  onSelect,
  onStartCamera,
  onStopCamera,
}: CameraGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "12px",
        height: "100%",
      }}
    >
      {cameras.map((cam) => (
        <CameraView
          key={cam.id}
          camera={cam}
          isSelected={selectedCameraId === cam.id}
          onSelect={() => onSelect(cam.id)}
          onStartCamera={() => onStartCamera(cam.id)}
          onStopCamera={() => onStopCamera(cam.id)}
        />
      ))}
    </div>
  );
}
