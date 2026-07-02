'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Play,
  RefreshCw,
  Save,
  Square,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  configScadaCameras,
  getScadaCameraHealth,
  getScadaCameras,
  ScadaCameraHealthItem,
  startScadaCamera,
  stopScadaCamera,
} from '@/lib/api';

import styles from './camera.module.css';

type CameraConfigView = {
  slot: number;
  label: string;
  url: string;
  configured: boolean;
  online: boolean;
  message: string;
  width?: number;
  height?: number;
  latency_ms?: number;
};

const CAMERA_COUNT = 5;

function emptyCameras(): CameraConfigView[] {
  return Array.from({ length: CAMERA_COUNT }, (_, slot) => ({
    slot,
    label: `Camera ${slot + 1}`,
    url: '',
    configured: false,
    online: false,
    message: 'not_loaded',
  }));
}

export default function CameraManagementPage() {
  const [cameras, setCameras] = useState<CameraConfigView[]>(emptyCameras);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [actionSlot, setActionSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCameras() {
    try {
      setLoading(true);
      const config = await getScadaCameras();

      let healthCameras: Record<string, ScadaCameraHealthItem> = {};
      try {
        const health = await getScadaCameraHealth(1500);
        healthCameras = health.cameras;
      } catch {
        healthCameras = {};
      }

      setCameras(
        Array.from({ length: CAMERA_COUNT }, (_, slot) => {
          const key = String(slot);
          const configItem = config.cameras[key] as
            | { url?: string; online?: boolean }
            | undefined;
          const healthItem = healthCameras[key];
          const url = healthItem?.url ?? configItem?.url ?? '';

          return {
            slot,
            label: `Camera ${slot + 1}`,
            url,
            configured: healthItem?.configured ?? Boolean(url),
            online: healthItem?.online ?? Boolean(configItem?.online),
            message: healthItem?.message ?? 'unknown',
            width: healthItem?.width,
            height: healthItem?.height,
            latency_ms: healthItem?.latency_ms,
          };
        })
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải cấu hình camera'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCameras();
    const timer = setInterval(loadCameras, 10000);

    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    return {
      total: cameras.length,
      configured: cameras.filter((camera) => camera.configured).length,
      online: cameras.filter((camera) => camera.online).length,
      errors: cameras.filter((camera) => camera.configured && !camera.online)
        .length,
    };
  }, [cameras]);

  function updateUrl(slot: number, url: string) {
    setCameras((current) =>
      current.map((camera) =>
        camera.slot === slot ? { ...camera, url } : camera
      )
    );
  }

  async function saveCamera(slot: number) {
    setSavingSlot(slot);
    setNotice(null);
    setError(null);

    try {
      const payload = Object.fromEntries(
        cameras.map((camera) => [String(camera.slot), camera.url.trim()])
      );
      await configScadaCameras(payload);
      setNotice(`Đã lưu cấu hình Camera ${slot + 1} vào PostgreSQL`);
      await loadCameras();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu camera');
    } finally {
      setSavingSlot(null);
    }
  }

  async function toggleCamera(camera: CameraConfigView) {
    setActionSlot(camera.slot);
    setNotice(null);
    setError(null);

    try {
      if (camera.online) {
        await stopScadaCamera(camera.slot);
        setNotice(`Đã dừng Camera ${camera.slot + 1}`);
      } else {
        await startScadaCamera(camera.slot);
        setNotice(`Đã start Camera ${camera.slot + 1}`);
      }
      await loadCameras();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Không thể đổi trạng thái Camera ${camera.slot + 1}`
      );
    } finally {
      setActionSlot(null);
    }
  }

  return (
    <div className={styles.page} data-theme="dark">
      <div className={styles.header}>
        <div>
          <div className={styles.title}>
            <Camera size={16} style={{ marginRight: 8 }} />
            CAMERA MANAGEMENT
          </div>

          <div className={styles.subtitle}>
            Cấu hình 5 camera được đọc và lưu trong PostgreSQL offline
          </div>
        </div>

        <button className={styles.btn} onClick={loadCameras} disabled={loading}>
          <RefreshCw size={14} />
          {loading ? 'Đang tải' : 'Refresh'}
        </button>
      </div>

      {(error || notice) && (
        <div
          className={styles.card}
          style={{
            marginBottom: 18,
            color: error ? '#f87171' : '#22c55e',
          }}
        >
          {error || notice}
        </div>
      )}

      <div className={styles.stats}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Configured" value={stats.configured} />
        <StatCard label="Online" value={stats.online} />
        <StatCard label="Errors" value={stats.errors} />
      </div>

      <div className={styles.list}>
        {cameras.map((camera) => (
          <div key={camera.slot} className={styles.item}>
            <div className={styles.left} style={{ flex: 1 }}>
              <div className={styles.titleRow}>
                <Camera size={14} />
                <span>{camera.label}</span>
                <span className={styles.status}>Slot #{camera.slot}</span>
              </div>

              <div className={styles.metaRow}>
                <input
                  className={styles.input}
                  value={camera.url}
                  onChange={(event) =>
                    updateUrl(camera.slot, event.target.value)
                  }
                  placeholder="rtsp://admin:password@192.168.1.10:554/stream1"
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div className={styles.statusRow}>
                <span
                  className={`${styles.status} ${
                    camera.online ? styles.online : styles.offline
                  }`}
                >
                  {camera.online ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {camera.online ? 'ONLINE' : 'OFFLINE'}
                </span>

                <span className={styles.status}>
                  <Activity size={12} />
                  {camera.configured ? 'ĐÃ CẤU HÌNH' : 'CHƯA CẤU HÌNH'}
                </span>

                {camera.latency_ms !== undefined && (
                  <span className={styles.status}>
                    {camera.latency_ms} ms
                  </span>
                )}

                {camera.width && camera.height && (
                  <span className={styles.status}>
                    {camera.width}x{camera.height}
                  </span>
                )}

                {camera.configured && !camera.online && (
                  <span className={`${styles.status} ${styles.btnDanger}`}>
                    <AlertTriangle size={12} />
                    {camera.message}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => saveCamera(camera.slot)}
                disabled={savingSlot === camera.slot}
              >
                <Save size={14} />
                {savingSlot === camera.slot ? 'Saving' : 'Save'}
              </button>

              <button
                className={`${styles.btn} ${
                  camera.online ? styles.btnDanger : styles.btnPrimary
                }`}
                onClick={() => toggleCamera(camera)}
                disabled={!camera.url.trim() || actionSlot === camera.slot}
              >
                {camera.online ? <Square size={14} /> : <Play size={14} />}
                {actionSlot === camera.slot
                  ? 'Working'
                  : camera.online
                    ? 'Stop'
                    : 'Start'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{value}</div>
    </div>
  );
}
