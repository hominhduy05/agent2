'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CameraChannel, ScadaCameraManager } from '@/lib/scada-camera';
import DetectionPanel from '@/components/scada/DetectionPanel';
import CameraConfig from '@/components/scada/CameraConfig';
import { classColor } from '@/lib/demo-class-display';
import {
  getScadaCameras,
  getScadaDemoMode,
  getScadaScale,
  ScadaScaleStatus,
  setScadaDemoMode,
} from '@/lib/api';
import styles from '../page.module.css';
import { useRouter } from 'next/navigation';
import { getScadaManager } from '@/lib/scada-manager';
import { scadaStore } from '@/lib/scada-store';

interface MediaDevice {
  deviceId: string;
  label: string;
}

export default function ScadaPage() {
  const [cameras, setCameras] = useState<CameraChannel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [sourceMode, setSourceMode] = useState<'webcam' | 'ip'>('webcam');
  const [demoMode, setDemoMode] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [scaleStatus, setScaleStatus] = useState<ScadaScaleStatus | null>(null);

  // const managerRef = useRef<ScadaCameraManager | null>(null);
  const managerRef = useRef(
    getScadaManager((cam) => {
      setCameras((prev) => {
        const next = [...prev];
        next[cam.id] = { ...cam };
        return next;
      });
    })
  );
  const videoRefs = useRef<React.RefObject<HTMLVideoElement | null>[]>([]);
  const canvasRefs = useRef<React.RefObject<HTMLCanvasElement | null>[]>([]);

  const autoConnectCameras = async (webcams: MediaDevice[]) => {
    const m = managerRef.current;

    if (!m) return;

    const max = Math.min(webcams.length, 5);

    for (let i = 0; i < max; i++) {
      const dev = webcams[i];

      try {
        const cam = m.cameras[i];

        if (cam?.isActive && cam.deviceId === dev.deviceId) {
          if (!cam.autoEnabled) m.startAuto(i);
          continue;
        }

        await m.startWebcam(i, dev.deviceId, dev.label);
        m.startAuto(i);

        console.log(`Camera ${i + 1} connected`);
      } catch (err) {
        console.error(`Camera ${i + 1} failed`, err);
      }
    }

    setCameras([...m.cameras]);

    setSelectedId((prev) => (prev === null ? 0 : prev));
  };

  const autoStartConfiguredIPCameras = async () => {
    const m = managerRef.current;
    if (!m) return;

    try {
      const config = await getScadaCameras();
      for (let i = 0; i < 5; i++) {
        const saved = config.cameras[String(i)];
        const rtspUrl = saved?.url?.trim();
        if (!rtspUrl) continue;

        if (m.cameras[i]?.isActive) {
          if (!m.cameras[i].autoEnabled) m.startAuto(i);
          continue;
        }

        await m.startIPCamera(i, rtspUrl, `Camera ${i + 1}`);
        m.startAuto(i);
        console.log(`IP Camera ${i + 1} auto-started`);
      }

      setCameras([...m.cameras]);
      setSelectedId((prev) => (prev === null ? 0 : prev));
    } catch (err) {
      console.error('Auto-start IP cameras failed', err);
    }
  };

  const syncDisconnectedCameras = async (webcams: MediaDevice[]) => {
    const m = managerRef.current;

    if (!m) return;

    const deviceIds = webcams.map((x) => x.deviceId);

    for (let i = 0; i < 5; i++) {
      const cam = m.cameras[i];

      if (cam?.isActive && cam.deviceId && !deviceIds.includes(cam.deviceId)) {
        m.stopCamera(i);

        console.log(`Camera ${i + 1} disconnected`);
      }
    }

    setCameras([...m.cameras]);
  };

  useEffect(() => {
    for (let i = 0; i < 5; i++) {
      videoRefs.current[i] = { current: null };
      canvasRefs.current[i] = { current: null };
    }

    const manager = getScadaManager((cam) => {
      setCameras((prev) => {
        const next = [...prev];
        next[cam.id] = { ...cam };
        return next;
      });
    });

    managerRef.current = manager;

    for (let i = 0; i < 5; i++) {
      managerRef.current.setRefs(
        i,
        videoRefs.current[i] as React.RefObject<HTMLVideoElement>,
        canvasRefs.current[i] as React.RefObject<HTMLCanvasElement>
      );
    }

    /**
     * Re-attach stream cho video sau khi quay từ detail về
     */
    for (let i = 0; i < 5; i++) {
      const cam = managerRef.current.cameras[i];

      if (cam?.stream && videoRefs.current[i]?.current) {
        videoRefs.current[i].current!.srcObject = cam.stream;

        videoRefs.current[i].current!.play().catch(() => {});
      }
    }

    setCameras([...managerRef.current.cameras]);

    async function loadDevices() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((track) => track.stop());

        const devs = await navigator.mediaDevices.enumerateDevices();

        const webcams = devs
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          }));

        setDevices(webcams);

        await autoConnectCameras(webcams);
        await autoStartConfiguredIPCameras();
      } catch (err) {
        console.error(err);
        setDevices([]);
        await autoStartConfiguredIPCameras();
      }
    }
    loadDevices();

    return () => {
      const activeManager = managerRef.current;
      setTimeout(() => {
        const nextPath = window.location.pathname;
        if (!nextPath.startsWith('/scada')) {
          console.log('LEAVING SCADA MODULE -> CLEANING UP SOCKETS & CAMERAS');
          activeManager?.cleanup();
        }
      }, 100);
    };
  }, []);

  const selectedIndex =
    selectedId !== null ? cameras.findIndex((c) => c.id === selectedId) : 0;

  const orderedCameras = (
    selectedIndex >= 0
      ? [
          cameras[selectedIndex],
          ...cameras.filter((_, i) => i !== selectedIndex),
        ]
      : cameras
  ).filter(Boolean) as CameraChannel[];

  useEffect(() => {
    getScadaDemoMode()
      .then((status) => {
        const enabled = Boolean(status.enabled);
        setDemoMode(enabled);
        managerRef.current?.setDemoMode(enabled);
      })
      .catch(() => setDemoMode(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!demoMode) {
      setScaleStatus(null);
      return () => {
        cancelled = true;
      };
    }
    async function loadScale() {
      try {
        const status = await getScadaScale();
        if (!cancelled) setScaleStatus(status);
      } catch {
        if (!cancelled) setScaleStatus(null);
      }
    }
    loadScale();
    const timer = window.setInterval(loadScale, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [demoMode]);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setThreshold(threshold);
      // Gui threshold moi qua WebSocket cho tat ca camera dang chay
      for (let i = 0; i < 5; i++) {
        if (managerRef.current.cameras[i].isActive) {
          managerRef.current.sendThreshold(i);
        }
      }
    }
  }, [threshold]);

  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;

    for (let i = 0; i < 5; i++) {
      const cam = m.cameras[i];
      const video = videoRefs.current[i]?.current;

      if (cam?.stream && video) {
        if (video.srcObject !== cam.stream) {
          video.srcObject = cam.stream;
        }

        video.play().catch(() => {});
      }
    }
  }, [cameras]);

  useEffect(() => {
    const m = managerRef.current;
    if (!m) return;

    requestAnimationFrame(() => {
      for (let i = 0; i < 5; i++) {
        m.setRefs(i, videoRefs.current[i] as any, canvasRefs.current[i] as any);

        const cam = m.cameras[i];
        const video = videoRefs.current[i]?.current;

        if (cam?.stream && video) {
          video.srcObject = cam.stream;
          video.play().catch(() => {});
        }
      }
    });
  }, []);

  const router = useRouter();

  const handleTileClick = (id: number) => {
    const cam = cameras[id];
    if (cam && cam.isActive) {
      setSelectedId(id);
    }
  };

  const handleStartWebcam = async (deviceId: string, label: string) => {
    if (pendingId === null) return;
    setShowDeviceModal(false);
    const m = managerRef.current;
    if (!m) return;
    await m.startWebcam(pendingId, deviceId, label);
    m.startAuto(pendingId);
    setPendingId(null);
    if (selectedId === null) setSelectedId(pendingId);
  };

  const handleStartIPCamera = async (rtspUrl: string) => {
    if (pendingId === null) return;
    setShowDeviceModal(false);
    const m = managerRef.current;
    if (!m) return;
    await m.startIPCamera(pendingId, rtspUrl);
    m.startAuto(pendingId);
    setPendingId(null);
    if (selectedId === null) setSelectedId(pendingId);
  };

  const handleToggle = (id: number) => {
    const m = managerRef.current;
    if (!m) return;
    m.cameras[id].autoEnabled ? m.stopAuto(id) : m.startAuto(id);
  };

  const handleCapture = (_id: number) => {
    void managerRef.current?.captureActiveOnce();
  };

  const handleDemoModeToggle = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const status = await setScadaDemoMode(!demoMode);
      const enabled = Boolean(status.enabled);
      setDemoMode(enabled);
      if (!enabled) setScaleStatus(null);
      managerRef.current?.setDemoMode(enabled);
    } finally {
      setDemoBusy(false);
    }
  };

  const handleReset = (id: number) => {
    const m = managerRef.current;
    if (!m) return;
    m.resetSession(id);
    setCameras((prev) => {
      const n = [...prev];
      n[id] = { ...m.cameras[id] };
      return n;
    });
  };

  const activeCount = cameras.filter((c) => c.isActive).length;
  const selectedCam = selectedId !== null ? cameras[selectedId] : null;
  const liveWeightKg =
    demoMode && scaleStatus?.online ? scaleStatus.latest?.weight_kg : null;

  const tileClasses = [
    styles.cam1,
    styles.cam2,
    styles.cam3,
    styles.cam4,
    styles.cam5,
  ];

  useEffect(() => {
    if (!managerRef.current) return;

    for (let i = 0; i < 5; i++) {
      managerRef.current.setRefs(
        i,
        videoRefs.current[i] as React.RefObject<HTMLVideoElement>,
        canvasRefs.current[i] as React.RefObject<HTMLCanvasElement>
      );
    }

    setCameras([...managerRef.current.cameras]);
  }, []);

  const detectionsCount = cameras.reduce(
    (sum, cam) => sum + (cam.result?.detections?.length || 0),
    0
  );

  const activeCams = cameras.filter((c) => c.isActive).length;

  const errorCams = cameras.filter((c) => c.error).length;

  const totalCams = 5;
  const activeRate = (activeCams / totalCams) * 100;
  const inactiveCams = totalCams - activeCams;

  useEffect(() => {
    scadaStore.setState({
      cameras,
      demoMode,
      scaleStatus,
    });
  }, [cameras, demoMode, scaleStatus]);

  useEffect(() => {
    const onDeviceChange = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();

        const webcams = devs
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          }));

        setDevices(webcams);

        await syncDisconnectedCameras(webcams);

        await autoConnectCameras(webcams);
      } catch (err) {
        console.error(err);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        onDeviceChange
      );
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* ── Left: Camera Grid ─────────────────────────────────────── */}
      <div className={styles.cameraPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h1 className={styles.panelTitle}>SCADA - Tự động phân loại</h1>
            <p className={styles.panelSubtitle}>
              {devices.length} webcam | {activeCount} camera sẵn sàng | AI chạy
              theo trigger tự động
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDemoModeToggle}
              disabled={demoBusy}
              title="Bat/tat che do demo gan nhan B-A-C-D"
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '8px',

                border: demoBusy
                  ? '1px solid rgba(234,179,8,0.6)' // yellow
                  : demoMode
                    ? '1px solid rgba(34,197,94,0.55)'
                    : '1px solid var(--border)',

                background: demoBusy
                  ? 'rgba(234,179,8,0.12)' // yellow bg
                  : demoMode
                    ? 'rgba(34,197,94,0.14)'
                    : 'var(--bg-elevated)',

                color: demoBusy
                  ? '#fbbf24' // yellow text
                  : demoMode
                    ? '#22c55e'
                    : 'var(--text-muted)',

                cursor: demoBusy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-outfit)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.02em',
                transition: 'all 0.15s',
                opacity: demoBusy ? 0.7 : 1,
              }}
            >
              {demoBusy ? (
                <span className="pendingWrap">
                  <span className="spinner" />
                  PENDING
                </span>
              ) : (
                <>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: demoMode ? '#22c55e' : 'var(--text-faint)',
                      boxShadow: demoMode
                        ? '0 0 8px rgba(34,197,94,0.8)'
                        : 'none',
                    }}
                  />
                  {demoMode ? 'ON' : 'OFF'}
                </>
              )}
            </button>
            {/* Config gear button */}
            <button
              onClick={() => setShowConfigModal(true)}
              title="Cau hinh Camera IP"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            <div className={styles.statusRow}>
              <div
                className={`${styles.statusDot} ${activeCount > 0 ? styles.active : ''}`}
              />
              <span className={styles.statusLabel}>
                {activeCount > 0 ? `${activeCount} active` : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.gridContainer}>
          {orderedCameras.map((cam, index) => {
            const isSelected = selectedId === cam.id;
            const badgeKey = cam.error
              ? 'error'
              : cam.isDetecting
                ? 'detecting'
                : cam.isActive
                  ? 'active'
                  : 'off';
            const hasResult =
              Array.isArray(cam.result?.detections) &&
              cam.result.detections.length > 0;

            const badgeLabel = cam.error
              ? 'Lỗi'
              : hasResult
                ? 'Đã chụp'
                : cam.isActive
                  ? cam.autoEnabled
                    ? 'Tự động'
                    : 'Preview'
                  : 'Chưa bật';
            const modeIcon =
              cam.mode === 'ip' ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ) : (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              );

            return (
              <div
                key={cam.id}
                className={`
        ${styles.cameraTile}
        ${tileClasses[index]}
        ${selectedId === cam.id ? styles.selected : ''}
        ${!cam.isActive ? styles.inactive : ''}
      `}
                onClick={() => handleTileClick(cam.id)}
              >
                <video
                  ref={
                    videoRefs.current[
                      cam.id
                    ] as React.RefObject<HTMLVideoElement>
                  }
                  muted
                  playsInline
                  className={styles.cameraVideo}
                  style={{ display: cam.isActive ? 'block' : 'none' }}
                />
                <canvas
                  ref={
                    canvasRefs.current[
                      cam.id
                    ] as React.RefObject<HTMLCanvasElement>
                  }
                  className={styles.cameraCanvas}
                />

                {!cam.isActive && !cam.error && (
                  <div className={styles.cameraOverlay}>
                    <svg
                      className={styles.cameraOverlayIcon}
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className={styles.cameraOverlayText}>
                      Chua ket noi
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingId(cam.id);
                        setShowDeviceModal(true);
                      }}
                      style={{
                        marginTop: '6px',
                        padding: '6px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontFamily: 'var(--font-outfit)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                      }}
                    >
                      Bat Camera
                    </button>
                  </div>
                )}

                <div className={styles.tileTop}>
                  <span className={styles.tileLabel}>
                    {modeIcon}
                    <span style={{ marginLeft: '4px' }}>{cam.label}</span>
                  </span>
                  <span
                    className={`${styles.tileBadge} ${badgeKey === 'active' ? styles.active : badgeKey === 'detecting' ? styles.detecting : badgeKey === 'error' ? styles.error : styles.off}`}
                  >
                    {badgeLabel}
                  </span>
                </div>

                {cam.isActive && (
                  <div className={styles.tileBottom}>
                    <div className={styles.tileDets}>
                      {cam.result && cam.result.detections.length > 0
                        ? cam.result.detections.map((d, i) => (
                            <span
                              key={i}
                              className={styles.tileDet}
                              style={{
                                background: `${classColor(d.class_name)}cc`,
                              }}
                            >
                              {(d.confidence * 100).toFixed(0)}%
                            </span>
                          ))
                        : null}
                      {liveWeightKg !== null && liveWeightKg !== undefined && (
                        <span
                          className={styles.tileDet}
                          style={{ background: 'rgba(15,23,42,0.82)' }}
                        >
                          {liveWeightKg.toFixed(2)} kg
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        managerRef.current?.stopCamera(cam.id);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239,68,56,0.5)',
                        background: 'rgba(239,68,56,0.15)',
                        color: '#ef4444',
                        fontFamily: 'var(--font-outfit)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      Tat
                    </button>
                  </div>
                )}

                {cam.error && (
                  <div className={styles.cameraOverlay}>
                    <svg
                      className={styles.cameraOverlayIcon}
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span
                      className={styles.cameraOverlayText}
                      style={{ color: '#ef4444' }}
                    >
                      {cam.error}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingId(cam.id);
                        setShowDeviceModal(true);
                      }}
                      style={{
                        marginTop: '6px',
                        padding: '6px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#ef4444',
                        color: '#fff',
                        fontFamily: 'var(--font-outfit)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Thu lai
                    </button>
                  </div>
                )}

                {cam.isActive && (
                  <div className={styles.clickHint}>
                    <span>Click để chọn camera</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status bar */}
        <div className={styles.statusBar}>
          <div className={styles.statusItem}>
            <div
              className={styles.statusBarDot}
              style={{
                background: activeCount > 0 ? '#12b76a' : 'var(--text-faint)',
              }}
            />
            {activeCount}/5 cameras
          </div>
          <div className={styles.statusItem}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {selectedCam?.deviceLabel || 'Chon camera'}
          </div>
          <div className={styles.statusItem}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Threshold: {(threshold * 100).toFixed(0)}%
          </div>
          <div className={styles.statusItem} style={{ marginLeft: 'auto' }}>
            {sourceMode === 'ip' ? 'IP Camera' : 'Webcam'}
          </div>
        </div>
      </div>

      {/* ── Right: Detection Panel ────────────────────────────────── */}
      {selectedCam && (
        <div className={styles.detectPanel}>
          <DetectionPanel
            camera={selectedCam}
            scaleStatus={scaleStatus}
            threshold={threshold}
            onThresholdChange={setThreshold}
            demoMode={demoMode}
            onToggleAuto={() => selectedId !== null && handleToggle(selectedId)}
            onCapture={() => selectedId !== null && handleCapture(selectedId)}
            onReset={() => selectedId !== null && handleReset(selectedId)}
          />
        </div>
      )}

      {/* ── Source Picker Modal (webcam vs IP) ───────────────────── */}
      {showDeviceModal && pendingId !== null && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDeviceModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              Chon nguon — Camera {pendingId + 1}
            </h2>

            {/* Source mode toggle */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button
                onClick={() => setSourceMode('webcam')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${sourceMode === 'webcam' ? 'var(--accent)' : 'var(--border)'}`,
                  background:
                    sourceMode === 'webcam'
                      ? 'var(--accent-dim)'
                      : 'var(--bg-elevated)',
                  color:
                    sourceMode === 'webcam'
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                  fontFamily: 'var(--font-outfit)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Webcam
              </button>
              <button
                onClick={() => setSourceMode('ip')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${sourceMode === 'ip' ? 'var(--accent)' : 'var(--border)'}`,
                  background:
                    sourceMode === 'ip'
                      ? 'var(--accent-dim)'
                      : 'var(--bg-elevated)',
                  color:
                    sourceMode === 'ip' ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-outfit)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                IP Camera
              </button>
            </div>

            {sourceMode === 'webcam' ? (
              devices.length === 0 ? (
                <p className={styles.modalEmpty}>
                  Khong tim thay webcam nao.
                  <br />
                  Vui long cho phep truy cap camera.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {devices.map((dev) => {
                    const used = cameras.some(
                      (c) => c.deviceId === dev.deviceId && c.isActive
                    );
                    return (
                      <button
                        key={dev.deviceId}
                        className={styles.deviceItem}
                        onClick={() =>
                          handleStartWebcam(dev.deviceId, dev.label)
                        }
                        disabled={used}
                      >
                        <div className={styles.deviceIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.deviceName}>{dev.label}</div>
                          {used && (
                            <div className={styles.deviceUsed}>Da su dung</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-outfit)',
                    fontSize: '12px',
                    color: 'var(--text-faint)',
                    margin: 0,
                  }}
                >
                  Nhap RTSP URL cho Camera {pendingId + 1}. Cau hinh truoc o nut
                  gear neu can.
                </p>
                <IPCameraInput onStart={handleStartIPCamera} slot={pendingId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Camera Config Modal ──────────────────────────────────── */}
      {showConfigModal && (
        <CameraConfig
          onClose={() => setShowConfigModal(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}

/* Inline IP camera RTSP URL input component */
function IPCameraInput({
  onStart,
  slot,
}: {
  onStart: (url: string) => void;
  slot: number | null;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!url.trim()) {
      setError('Vui long nhap RTSP URL');
      return;
    }
    if (!url.startsWith('rtsp://')) {
      setError('URL phai bat dau bang rtsp://');
      return;
    }
    setError('');
    setLoading(true);
    onStart(url.trim());
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth="1.5"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <input
          type="text"
          placeholder={`rtsp://192.168.1.${101 + (slot ?? 0)}:554/stream`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'var(--font-outfit)',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      </div>
      {error && (
        <p
          style={{
            fontFamily: 'var(--font-outfit)',
            fontSize: '11px',
            color: '#f04438',
            margin: '6px 0 0',
          }}
        >
          {error}
        </p>
      )}
      <button
        onClick={handleStart}
        disabled={loading}
        style={{
          marginTop: '10px',
          width: '100%',
          padding: '9px',
          borderRadius: '8px',
          border: 'none',
          background: loading ? 'var(--border)' : 'var(--accent)',
          color: '#fff',
          fontFamily: 'var(--font-outfit)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Dang ket noi...' : 'Ket noi IP Camera'}
      </button>
    </div>
  );
}
