'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { BoundingBox } from '@/lib/types';

interface WebcamStatsState {
  totalCount: number;
  matureCount: number;
  immatureCount: number;
  defectiveCount: number;
  rejectCount: number;
  qualityRate: number;
  lastUpdate: number | null;
  sessionCount: number;
}

interface WebcamContextValue {
  stats: WebcamStatsState;
  isStreaming: boolean;
  isDetecting: boolean;
  onDetection: (detections: BoundingBox[]) => void;
  onReset: () => void;
  setStreaming: (v: boolean) => void;
  setDetecting: (v: boolean) => void;
}

const defaultStats: WebcamStatsState = {
  totalCount: 0,
  matureCount: 0,
  immatureCount: 0,
  defectiveCount: 0,
  rejectCount: 0,
  qualityRate: 0,
  lastUpdate: null,
  sessionCount: 0,
};

const WebcamContext = createContext<WebcamContextValue>({
  stats: defaultStats,
  isStreaming: false,
  isDetecting: false,
  onDetection: () => {},
  onReset: () => {},
  setStreaming: () => {},
  setDetecting: () => {},
});

export function useWebcamStats() {
  return useContext(WebcamContext);
}

export function WebcamStatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stats, setStats] = useState<WebcamStatsState>(defaultStats);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const onDetection = useCallback((detections: BoundingBox[]) => {
    setStats((prev) => {
      const mature = detections.filter((d) => d.class_name === 'mature').length;
      const immature = detections.filter(
        (d) => d.class_name === 'immature'
      ).length;
      const defective = detections.filter(
        (d) => d.class_name === 'defective'
      ).length;
      const frameTotal = mature + immature + defective;
      const newTotal = prev.totalCount + frameTotal;
      const goodCount =
        prev.matureCount + mature + (prev.immatureCount + immature);

      return {
        ...prev,
        totalCount: prev.totalCount + 1,
        matureCount: prev.matureCount + mature,
        immatureCount: prev.immatureCount + immature,
        defectiveCount: prev.defectiveCount + defective,
        qualityRate:
          newTotal > 0 ? Math.round((goodCount / newTotal) * 1000) / 10 : 0,
        lastUpdate: Date.now(),
        sessionCount: prev.sessionCount + 1,
      };
    });
  }, []);

  const onReset = useCallback(() => {
    setStats(defaultStats);
  }, []);

  return (
    <WebcamContext.Provider
      value={{
        stats,
        isStreaming,
        isDetecting,
        onDetection,
        onReset,
        setStreaming: setIsStreaming,
        setDetecting: setIsDetecting,
      }}
    >
      {children}
    </WebcamContext.Provider>
  );
}
