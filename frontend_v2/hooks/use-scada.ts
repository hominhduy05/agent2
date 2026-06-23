'use client';

import { useEffect, useState } from 'react';

import { getScadaManager } from '@/lib/scada-manager';
import { CameraChannel } from '@/lib/scada-camera';

export function useScada() {
  const [cameras, setCameras] = useState<CameraChannel[]>([]);

  useEffect(() => {
    const manager = getScadaManager((camera) => {
      setCameras((prev) => {
        const next = [...prev];

        next[camera.id] = {
          ...camera,
        };

        return next;
      });
    });

    setCameras([...manager.cameras]);

    return () => {
      manager.setOnUpdate();
    };
  }, []);

  return {
    cameras,
  };
}