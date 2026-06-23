'use client';

import { useEffect, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { ChevronLeft, Camera } from 'lucide-react';

import DetectionPanel from '@/components/scada/DetectionPanel';

import { getScadaScale, getScadaDemoMode, ScadaScaleStatus } from '@/lib/api';

import { getScadaManager } from '@/lib/scada-manager';

import { CameraChannel } from '@/lib/scada-camera';

import styles from './page.module.css';

export default function ScadaDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const managerRef = useRef(getScadaManager());

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [camera, setCamera] = useState<CameraChannel | null>(null);

  const [threshold, setThreshold] = useState(0.25);

  const [demoMode, setDemoMode] = useState(false);

  const [scaleStatus, setScaleStatus] = useState<ScadaScaleStatus | null>(null);

  const [, force] = useState(0);

  /**
   * LOAD CAMERA + LISTENER
   */
  useEffect(() => {
    const manager = getScadaManager((cam) => {
      if (cam.id !== id) return;

      setCamera({
        ...cam,
      });

      /**
       * attach stream khi camera update
       */
      if (cam.stream && videoRef.current) {
        videoRef.current.srcObject = cam.stream;

        videoRef.current.play().catch(() => {});
      }
    });

    managerRef.current = manager;

    const current = manager.cameras[id];

    if (current) {
      setCamera({
        ...current,
      });

      if (current.stream && videoRef.current) {
        videoRef.current.srcObject = current.stream;

        videoRef.current.play().catch(() => {});
      }
    }

    return () => {};
  }, [id]);

  /**
   * SET VIDEO/CANVAS REF
   */
  useEffect(() => {
  const manager = managerRef.current;

  manager.setRefs(
    id,
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>
  );

  const cam = manager.cameras[id];

  if (cam?.stream && videoRef.current) {
    videoRef.current.srcObject = cam.stream;
    videoRef.current.play().catch(() => {});
  }

  return () => {
    // clear ref khi rời trang detail
    manager.setRefs(
      id,
      { current: null } as React.RefObject<HTMLVideoElement>,
      { current: null } as React.RefObject<HTMLCanvasElement>
    );
  };
}, [id]);

  /**
   * force update UI
   */
  useEffect(() => {
    const timer = setInterval(() => {
      force((v) => v + 1);
    }, 30000000);

    return () => clearInterval(timer);
  }, []);

  /**
   * DEMO MODE
   */
  useEffect(() => {
    getScadaDemoMode().then((res) => {
      setDemoMode(Boolean(res.enabled));
    });
  }, []);

  /**
   * SCALE
   */
  useEffect(() => {
  const load = async () => {
    try {
      const data = await getScadaScale();
      setScaleStatus(data);
    } catch {
      setScaleStatus(null);
    }
  };

  load();

  const timer = setInterval(load, 1000);
  return () => clearInterval(timer);
}, [demoMode]);

  if (!camera) {
    return <div className={styles.wrapper}>Camera không tồn tại</div>;
  }

  const manager = managerRef.current;

  return (
    <div className={styles.wrapper}>
      {/* HEADER */}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backButton}
            onClick={() => router.push('/scada/monitor')}
          >
            <ChevronLeft size={18} />
          </button>

          <div className={styles.cameraName}>Camera {id + 1}</div>
        </div>

        <div
          className={`${styles.status}

            ${camera.isActive ? styles.online : styles.offline}`}
        >
          <span
            style={{
              width: 8,

              height: 8,

              borderRadius: '50%',

              background: camera.isActive ? '#22c55e' : '#ef4444',
            }}
          />

          {camera.isActive ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.cameraCard}>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={styles.video}
              style={{
                display: camera.isActive ? 'block' : 'none',
              }}
            />

            <canvas ref={canvasRef} className={styles.canvas} />

            {!camera.isActive && (
              <div className={styles.empty}>
                <Camera size={48} />

                <div>Camera chưa hoạt động</div>
              </div>
            )}
          </div>

          <div className={styles.historyCard}>
            <div className={styles.cardTitle}>Capture History</div>

            <div className={styles.historyGrid}>
              {(camera.cropHistory || []).map((item, i) => (
                <div key={i} className={styles.historyItem}>
                  <img src={item.dataUrl} alt="" />

                  <div className={styles.historyTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <DetectionPanel
            camera={camera}
            demoMode={demoMode}
            scaleStatus={scaleStatus}
            threshold={threshold}
            onThresholdChange={(v) => {
              setThreshold(v);

              manager.setThreshold(v);

              manager.sendThreshold(id);
            }}
            onToggleAuto={() => {
              camera.autoEnabled ? manager.stopAuto(id) : manager.startAuto(id);

              force((v) => v + 1);
            }}
            onCapture={() => {
              manager.captureAndDetect(id);
            }}
            onReset={() => {
              manager.resetSession(id);

              force((v) => v + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
