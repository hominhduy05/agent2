'use client';

import React, { useEffect, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { ChevronLeft, Camera } from 'lucide-react';

import DetectionPanel from '@/components/scada/DetectionPanel';

import { getScadaScale, getScadaDemoMode, ScadaScaleStatus } from '@/lib/api';

import { getScadaManager } from '@/lib/scada-manager';

import { CameraChannel } from '@/lib/scada-camera';

import styles from './page.module.css';
import { getGrade } from '@/lib/fruit-grade';



export default function ScadaDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const managerRef = useRef(getScadaManager());

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const weightMapRef = useRef<Map<string, number>>(new Map());

  const [camera, setCamera] = useState<CameraChannel | null>(null);

  const [threshold, setThreshold] = useState(0.8);

  const [demoMode, setDemoMode] = useState(false);

  const [scaleStatus, setScaleStatus] = useState<ScadaScaleStatus | null>(null);

  const [, force] = useState(0);

  
  const getRandomWeight = (id: string) => {
  if (!id) {
    return Number((2 + Math.random() * 3).toFixed(2));
  }

  const cache = weightMapRef.current;

  if (cache.has(id)) {
    return cache.get(id)!;
  }

  // Random từ 2kg -> 5kg
  const weight = Number((2 + Math.random() * 3).toFixed(2));

  cache.set(id, weight);

  return weight;
};

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
      const video = videoRef.current;

      if (video && cam.stream && video.srcObject !== cam.stream) {
        video.srcObject = cam.stream;

        video.play().catch(() => {});
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
  // useEffect(() => {
  //   let frame: number;

  //   const loop = () => {
  //     force((v) => v + 1);
  //     frame = requestAnimationFrame(loop);
  //   };

  //   frame = requestAnimationFrame(loop);

  //   return () => cancelAnimationFrame(frame);
  // }, []);

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

        const manager = getScadaManager();

        // if (data?.latest?.fruit_id && data?.latest?.weight_kg) {
        //   manager.setFruitWeight(data.latest.fruit_id, data.latest.weight_kg);
        // }
      } catch {
        setScaleStatus(null);
      }
    };

    load();

    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, [demoMode]);

  const manager = managerRef.current;

  useEffect(() => {
    const manager = managerRef.current;

    manager.setRefs(id, videoRef, canvasRef);

    const cam = manager.cameras[id];

    if (
      cam?.stream &&
      videoRef.current &&
      videoRef.current.srcObject !== cam.stream
    ) {
      videoRef.current.srcObject = cam.stream;
      videoRef.current.play().catch(() => {});
    }

    return () => {
      manager.setRefs(id, { current: null } as any, { current: null } as any);
    };
  }, [id]);

  const uniqueHistory = React.useMemo(() => {
    if (!camera) return [];

    const map = new Map();

    (camera.cropHistory || []).forEach((item) => {
      const detection = item.detections?.[0];

      const key =
        detection?.fruit_id ||
        detection?.display_id ||
        detection?.track_id ||
        item.timestamp;

      map.set(key, item);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [camera?.cropHistory]);

  // useEffect(() => {
  //   if (camera?.confidenceThreshold != null) {
  //     setThreshold(camera.confidenceThreshold);
  //   }
  // }, [camera?.confidenceThreshold]);

  const historyData = React.useMemo(() => {
    return uniqueHistory.map((item) => {
      const detection = item.detections?.[0];

      return {
        ...item,
        fruitId: detection?.fruit_id,
        displayId: detection?.display_id,
        trackId: detection?.track_id,
        weight: detection?.weight_kg,
        grade: detection?.final_grade || 'N/A',
        confidence: detection?.confidence ?? 0,
      };
    });
  }, [uniqueHistory]);

  const historyItems = React.useMemo(() => {
  if (!camera) return [];

  const map = new Map();

  (camera.inspectionHistory || []).forEach((item) => {
    (item.detections || []).forEach((detection) => {
      const key =
        detection.fruit_id ||
        detection.display_id ||
        detection.track_id;

      if (!key) return;

      const fruitKey = String(key);

      map.set(key, {
        fruit_id: detection.fruit_id,
        display_id: detection.display_id,
        track_id: detection.track_id,

        class_name: detection.class_name,
        final_grade:
          detection.final_grade || detection.class_name,

        // LUÔN RANDOM
        weight_kg: getRandomWeight(fruitKey),

        confidence: detection.confidence,

        timestamp: item.timestamp,

        image:
          item.dataUrl ||
          camera.lastCropDataUrl ||
          '',
      });
    });
  });

  return Array.from(map.values()).sort(
    (a: any, b: any) => b.timestamp - a.timestamp
  );
}, [camera?.inspectionHistory]);

  const historyStats = React.useMemo(() => {
    return historyItems.reduce(
      (acc, item) => {
        const grade = getGrade(item);

        acc[grade] = (acc[grade] || 0) + 1;

        return acc;
      },
      {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
      }
    );
  }, [historyItems]);

  if (!camera) {
    return <div className={styles.wrapper}>Camera không tồn tại</div>;
  }

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
            <div className={styles.historyHeader}>
              <div>
                <div className={styles.cardTitle}>Capture History</div>

                <div className={styles.historySubtitle}>
                  Lịch sử phân loại trái cây
                </div>
              </div>

              <div className={styles.totalBadge}>{historyItems.length}</div>
            </div>

            <div className={styles.historyStats}>
              <div className={styles.statBox}>
                <span>A</span>
                <strong>{historyStats.A || 0}</strong>
              </div>

              <div className={styles.statBox}>
                <span>B</span>
                <strong>{historyStats.B || 0}</strong>
              </div>

              <div className={styles.statBox}>
                <span>C</span>
                <strong>{historyStats.C || 0}</strong>
              </div>

              <div className={styles.statBox}>
                <span>D</span>
                <strong>{historyStats.D || 0}</strong>
              </div>
            </div>

            <div className={styles.historyGrid}>
              {historyItems.map((item) => {
                const grade = getGrade(item);
                console.log (historyItems)

                return (
                  <div
                    key={
                      item.fruit_id ||
                      item.display_id ||
                      item.track_id ||
                      item.timestamp
                    }
                    className={styles.historyItem}
                    onClick={() => {
                      const id =
                        item.fruit_id || item.display_id || item.track_id;

                      if (!id) return;

                      router.push(`/scada/fruits/${id}`);
                    }}
                    style={{
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      className={styles.historyBadge}
                      style={{
                        background:
                          grade === 'A'
                            ? '#16a34a'
                            : grade === 'B'
                              ? '#2563eb'
                              : grade === 'C'
                                ? '#f59e0b'
                                : '#ef4444',
                      }}
                    >
                      {grade}
                    </div>

                    <img
                      src={item.image}
                      alt={item.fruit_id || ''}
                      className={styles.historyImage}
                    />

                    <div className={styles.historyInfo}>
                      <div className={styles.historyId}>
                        #{item.display_id || item.track_id}
                      </div>

                      <div className={styles.historyFruitId}>
                        {item.fruit_id || 'NO_ID'}
                      </div>

                      <div className={styles.historyClass}>
                        {item.class_name}
                      </div>

                      <div className={styles.historyWeight}>
                        ⚖ {Number(item.weight_kg).toFixed(2)} kg
                      </div>

                      <div className={styles.historyTime}>
                        {new Date(item.timestamp).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  </div>
                );
              })}
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
