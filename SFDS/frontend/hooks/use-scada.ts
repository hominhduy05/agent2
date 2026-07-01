'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getScadaManager } from '@/lib/scada-manager';
import { CameraChannel } from '@/lib/scada-camera';
import { BoundingBox } from '@/lib/types';

export function useScada() {
  const [cameras, setCameras] = useState<CameraChannel[]>(() => {
    if (typeof window === 'undefined') return [];

    return [...getScadaManager().cameras];
  });

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const manager = getScadaManager();

    const sync = () => {
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        setCameras([...manager.cameras]);
        rafRef.current = null;
      });
    };

    // manager.setOnUpdate(sync);

    sync();

    setCameras([...manager.cameras]);

    return () => {
      // manager.setOnUpdate(undefined);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * ==========================
   * ALL DETECTIONS
   * ==========================
   */

  const detections = useMemo(() => {
    return cameras.flatMap((cam) =>
      (cam.result?.detections ?? []).map((d) => ({
        ...d,
        cameraId: cam.id,
        cameraLabel: cam.label,
        timestamp: cam.result?.timestamp,
      }))
    );
  }, [cameras]);

  /**
   * ==========================
   * ALL FRUITS (inspection history)
   * ==========================
   */

  const fruits = useMemo(() => {
    return cameras.flatMap((cam) =>
      (cam.inspectionHistory ?? []).flatMap((item) =>
        item.detections.map((fruit) => ({
          ...fruit,
          cameraId: cam.id,
          cameraLabel: cam.label,
          image: item.dataUrl,
          timestamp: item.timestamp,
        }))
      )
    );
  }, [cameras]);

  /**
   * ==========================
   * ACTIVE CAMERAS
   * ==========================
   */

  const activeCameras = useMemo(
    () => cameras.filter((c) => c.isActive),
    [cameras]
  );

  /**
   * ==========================
   * SYSTEM STATS
   * ==========================
   */

  /**
   * ==========================
   * INACTIVE CAMERAS
   * ==========================
   */

  const inactiveCameras = useMemo(
    () => cameras.filter((c) => !c.isActive),
    [cameras]
  );

  /**
   * ==========================
   * INSPECTION HISTORY
   * ==========================
   */

  const inspectionHistory = useMemo(() => {
    return cameras.flatMap((cam) =>
      (cam.inspectionHistory ?? []).map((item) => ({
        ...item,
        cameraId: cam.id,
        cameraLabel: cam.label,
      }))
    );
  }, [cameras]);

  /**
   * ==========================
   * CROP HISTORY
   * ==========================
   */

  const cropHistory = useMemo(() => {
    return cameras.flatMap((cam) =>
      (cam.cropHistory ?? []).map((item) => ({
        ...item,
        cameraId: cam.id,
        cameraLabel: cam.label,
      }))
    );
  }, [cameras]);

  /**
   * ==========================
   * GRADE DISTRIBUTION
   * ==========================
   */

  const gradeDistribution = useMemo(() => {
    const dist = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };

    fruits.forEach((fruit) => {
      const grade = fruit.final_grade;

      if (grade && grade in dist) {
        dist[grade as keyof typeof dist]++;
      }
    });

    return dist;
  }, [fruits]);

  /**
   * ==========================
   * CONDITION DISTRIBUTION
   * ==========================
   */

  const conditionDistribution = useMemo(() => {
    const result: Record<string, number> = {};

    fruits.forEach((fruit) => {
      const key = fruit.class_name;

      result[key] = (result[key] || 0) + 1;
    });

    return result;
  }, [fruits]);

  /**
   * ==========================
   * CAMERA STATS
   * ==========================
   */

  const cameraStats = useMemo(() => {
    return cameras.map((cam) => {
      const items = cam.inspectionHistory ?? [];

      const detections = items.flatMap((i) => i.detections);

      return {
        id: cam.id,

        label: cam.label,

        mode: cam.mode,

        online: cam.isActive,

        detecting: cam.isDetecting,

        frameCount: cam.frameCount,

        totalFruit: detections.length,

        avgConfidence:
          detections.reduce((s, d) => s + (d.confidence ?? 0), 0) /
          (detections.length || 1),

        avgWeight:
          detections.reduce((s, d) => s + (d.weight_kg ?? 0), 0) /
          (detections.length || 1),

        qualityPhase: cam.qualityPhase,

        qualityReason: cam.qualityReason,

        blurScore: cam.blurScore,

        stableFrames: cam.stableFrames,

        lastCropAt: cam.lastCropAt,

        error: cam.error,

        health: cam.health,
      };
    });
  }, [cameras]);

  /**
   * ==========================
   * TIMELINE
   * ==========================
   */

  const timeline = useMemo(() => {
    const grouped: Record<string, number> = {};

    fruits.forEach((fruit) => {
      const time = new Date(fruit.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      grouped[time] = (grouped[time] || 0) + 1;
    });

    return Object.entries(grouped).map(([time, count]) => ({
      time,
      count,
    }));
  }, [fruits]);

  /**
   * ==========================
   * HELPERS
   * ==========================
   */

  const getCameraById = (id: number) => cameras.find((c) => c.id === id);

  const getFruitById = (fruitId: string) =>
    fruits.find((f) => f.fruit_id === fruitId);

  const stats = useMemo(() => {
    const totalFruit = fruits.length;
    const totalDetection = detections.length;

    const onlineCamera = cameras.filter((c) => c.isActive).length;

    const avgWeight =
      fruits.reduce((sum, fruit) => sum + (fruit.weight_kg ?? 0), 0) /
      (totalFruit || 1);

    const avgConfidence =
      detections.reduce((sum, d) => sum + (d.confidence ?? 0), 0) /
      (totalDetection || 1);

    return {
      totalCamera: cameras.length,
      onlineCamera,
      offlineCamera: cameras.length - onlineCamera,

      totalFruit,
      totalDetection,

      avgWeight,
      avgConfidence,
    };
  }, [cameras, detections, fruits]);

  useEffect(() => {
    console.log('===== SCADA DEBUG =====');

    console.log('cameras', cameras.length);
    console.log('fruits', fruits.length);
    console.log('detections', detections.length);

    console.log('sample fruit', fruits[0]);
    console.log('sample detection', detections[0]);

    console.log('stats', stats);
    console.log('gradeDistribution', gradeDistribution);
    console.log('timeline', timeline);
    console.log('cameraStats', cameraStats);
  }, [
    cameras,
    fruits,
    detections,
    stats,
    gradeDistribution,
    timeline,
    cameraStats,
  ]);

  return {
    manager: getScadaManager(),

    // Cameras
    cameras,
    activeCameras,
    inactiveCameras,

    // Live
    detections,
    fruits,

    // History
    inspectionHistory,
    cropHistory,

    // Analytics
    stats,
    gradeDistribution,
    conditionDistribution,
    cameraStats,
    timeline,

    // Helpers
    getCameraById,
    getFruitById,
  };
}