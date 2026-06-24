'use client';

import { useEffect, useRef } from 'react';
import styles from '../app/(admin)/scada/dashboard/dashboard.module.css';
import { CameraChannel } from '@/lib/scada-camera';

interface Props {
  cameras: CameraChannel[];
}

export default function CameraStrip({
  cameras,
}: Props) {
  const videoMap = useRef<
    Record<number, HTMLVideoElement | null>
  >({});

  useEffect(() => {
    cameras.forEach((cam) => {
      const video = videoMap.current[cam.id];

      if (!video) return;
      if (!cam.stream) return;

      if (video.srcObject !== cam.stream) {
        video.srcObject = cam.stream;

        video.play().catch(() => {});
      }
    });
  }, [cameras]);

  return (
    <div className={styles.videoStrip}>
      {cameras.map((cam) => (
        <div
          key={cam.id}
          className={styles.videoCard}
        >
          <video
            ref={(el) => {
              videoMap.current[cam.id] = el;
            }}
            muted
            autoPlay
            playsInline
            className={styles.video}
          />

          {!cam.stream && (
            <div className={styles.videoOffline}>
              No Signal
            </div>
          )}

          <div className={styles.videoFooter}>
            <div>
              <div className={styles.camName}>
                {cam.label}
              </div>

              <div className={styles.camSub}>
                {cam.mode === 'ip'
                  ? 'IP Camera'
                  : 'Webcam'}
              </div>
            </div>

            <span
              className={
                cam.isActive
                  ? styles.live
                  : styles.offline
              }
            >
              {cam.isActive
                ? 'LIVE'
                : 'OFFLINE'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}