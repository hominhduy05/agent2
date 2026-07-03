'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  getScadaCameraHealth,
  getScadaCameras,
  ScadaCameraHealthItem,
} from '@/lib/api';

type CameraView = {
  id: number;
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

function buildEmptyCameras(): CameraView[] {
  return Array.from({ length: CAMERA_COUNT }, (_, slot) => ({
    id: slot,
    label: `Camera ${slot + 1}`,
    url: '',
    configured: false,
    online: false,
    message: 'not_loaded',
  }));
}

export default function CameraManagerPage() {
  const [cameras, setCameras] = useState<CameraView[]>(() =>
    buildEmptyCameras()
  );
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCameras() {
      try {
        const [config, health] = await Promise.all([
          getScadaCameras(),
          getScadaCameraHealth(1500),
        ]);

        if (cancelled) return;

        setCameras(
          Array.from({ length: CAMERA_COUNT }, (_, slot) => {
            const configItem = config.cameras[String(slot)] as
              | { url?: string; online?: boolean }
              | undefined;
            const healthItem = health.cameras[
              String(slot)
            ] as ScadaCameraHealthItem | undefined;

            return {
              id: slot,
              label: `Camera ${slot + 1}`,
              url: healthItem?.url ?? configItem?.url ?? '',
              configured:
                healthItem?.configured ?? Boolean(configItem?.url ?? ''),
              online: healthItem?.online ?? Boolean(configItem?.online),
              message: healthItem?.message ?? 'unknown',
              width: healthItem?.width,
              height: healthItem?.height,
              latency_ms: healthItem?.latency_ms,
            };
          })
        );
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Không thể tải trạng thái camera'
        );
      }
    }

    loadCameras();
    const timer = setInterval(loadCameras, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const rooms = useMemo(() => {
    const result = [];

    for (let index = 0; index < cameras.length; index += CAMERA_COUNT) {
      result.push({
        id: index / CAMERA_COUNT,
        name: `Buồng ${index / CAMERA_COUNT + 1}`,
        cameras: cameras.slice(index, index + CAMERA_COUNT),
      });
    }

    return result;
  }, [cameras]);

  const stats = useMemo(() => {
    return {
      total: cameras.length,
      online: cameras.filter((camera) => camera.online).length,
      offline: cameras.filter((camera) => !camera.online).length,
      detecting: 0,
      errors: cameras.filter(
        (camera) => camera.configured && !camera.online
      ).length,
    };
  }, [cameras]);

  const visibleRooms =
    selectedRoom === null
      ? rooms
      : rooms.filter((room) => room.id === selectedRoom);

 return (
  <div className="min-h-screen p-6"
    style={{ background: 'var(--bg)', color: 'var(--text)' }}
  >
    {/* HEADER */}
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Camera Management Center
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Trạng thái 5 camera đọc từ PostgreSQL offline
        </p>
      </div>

      <div
        className="rounded-2xl px-5 py-3 shadow-sm border"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Cập nhật lần cuối
        </div>
        <div className="font-semibold">
          {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Đang tải...'}
        </div>
      </div>
    </div>

    {/* ERROR */}
    {error && (
      <div
        className="mb-6 rounded-xl px-4 py-3 text-sm"
        style={{
          background: 'var(--error-dim)',
          color: 'var(--error)',
          border: '1px solid var(--error)',
        }}
      >
        {error}
      </div>
    )}

    {/* STATS */}
    <div className="mb-6 grid grid-cols-5 gap-4">
      <StatCard title="Tổng Camera" value={stats.total} icon={<Camera size={18} />} />
      <StatCard title="Online" value={stats.online} icon={<Wifi size={18} />} color="success" />
      <StatCard title="Offline" value={stats.offline} icon={<WifiOff size={18} />} color="muted" />
      <StatCard title="Đang nhận diện" value={stats.detecting} icon={<Search size={18} />} color="accent" />
      <StatCard title="Lỗi" value={stats.errors} icon={<AlertTriangle size={18} />} color="error" />
    </div>

    {/* ROOM FILTER */}
    <div className="mb-6 flex flex-wrap gap-3">
      <button
        onClick={() => setSelectedRoom(null)}
        className="rounded-xl px-4 py-2 font-medium transition"
        style={{
          background: selectedRoom === null ? 'var(--accent)' : 'var(--surface)',
          color: selectedRoom === null ? '#fff' : 'var(--text)',
          border: '1px solid var(--border)',
        }}
      >
        Tất cả
      </button>

      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => setSelectedRoom(room.id)}
          className="rounded-xl px-4 py-2 font-medium transition"
          style={{
            background:
              selectedRoom === room.id ? 'var(--accent)' : 'var(--surface)',
            color: selectedRoom === room.id ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {room.name}
        </button>
      ))}
    </div>

    {/* ROOMS */}
    <div className="space-y-6">
      {visibleRooms.map((room) => {

        const roomStatus = getRoomStatus(room.cameras);
        
        return (
        <div
          key={room.id}
          className="rounded-2xl p-5 shadow-sm"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {/* ROOM HEADER */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{room.name}</h2>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {room.cameras.filter((c) => c.online).length}/
                {room.cameras.length} camera online
              </div>
            </div>

            {/* <div
              className="flex items-center gap-2 rounded-full px-3 py-1"
              style={{
                background: 'var(--success-dim)',
                color: 'var(--success)',
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              LIVE
            </div> */}
            <LiveBadge status={roomStatus} />
          </div>

          {/* GRID */}
          <div className="grid grid-cols-5 gap-4">
            {room.cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} />
            ))}
          </div>
        </div>
      )
      }
      
      )}
    </div>
  </div>
);
}

function CameraCard({ camera }: { camera: CameraView }) {
  const status =
    !camera.configured
      ? 'chưa cấu hình'
      : camera.online
        ? 'online'
        : 'offline';

  const statusColor = camera.online
    ? 'var(--success)'
    : camera.configured
      ? 'var(--error)'
      : 'var(--text-muted)';

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* VIDEO */}
      <div className="relative aspect-video" style={{ background: 'var(--camera-bg)' }}>
        <div className="flex h-full items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {camera.configured ? 'RTSP STREAM' : 'Chưa cấu hình'}
        </div>

        <div className="absolute right-2 top-2">
          <span
            className="h-3 w-3 rounded-full block"
            style={{ background: statusColor }}
          />
        </div>
      </div>

      {/* INFO */}
      <div className="space-y-2 p-4">
        <div className="font-semibold">{camera.label}</div>

        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Trạng thái:
          <span className="ml-2 font-semibold" style={{ color: statusColor }}>
            {status}
          </span>
        </div>

        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Độ trễ:
          <span className="ml-2 font-semibold">
            {camera.latency_ms ? `${camera.latency_ms} ms` : '-'}
          </span>
        </div>

        <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
          URL:
          <span className="ml-2">{camera.url || '-'}</span>
        </div>

        {camera.configured && !camera.online && (
          <div
            className="rounded-lg p-2 text-xs"
            style={{
              background: 'var(--error-dim)',
              color: 'var(--error)',
            }}
          >
            {camera.message}
          </div>
        )}
      </div>
    </div>
  );
}


function getCameraStatus(camera: CameraView) {
  if (!camera.configured) return 'idle';
  if (!camera.online) return 'offline';

  if (camera.latency_ms && camera.latency_ms > 2000) return 'error';

  return 'live';
}
function getRoomStatus(cameras: CameraView[]) {
  const statuses = cameras.map(getCameraStatus);

  if (statuses.includes('live')) return 'live';
  if (statuses.includes('offline')) return 'offline';
  if (statuses.includes('error')) return 'error';

  return 'offline';
}
function LiveBadge({ status }: { status: string }) {
  const base =
    'flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide transition-all duration-300';

  const config: Record<
    string,
    {
      label: string;
      style: React.CSSProperties;
      dot: string;
    }
  > = {
    live: {
      label: 'LIVE',
      dot: 'bg-emerald-400',
      style: {
        background: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        color: '#34d399',
        boxShadow: '0 0 18px rgba(16, 185, 129, 0.25)',
      },
    },
    online: {
      label: 'ONLINE',
      dot: 'bg-sky-400',
      style: {
        background: 'rgba(59, 130, 246, 0.10)',
        borderColor: 'rgba(59, 130, 246, 0.30)',
        color: '#60a5fa',
      },
    },
    idle: {
      label: 'IDLE',
      dot: 'bg-slate-400',
      style: {
        background: 'rgba(148, 163, 184, 0.10)',
        borderColor: 'rgba(148, 163, 184, 0.25)',
        color: '#94a3b8',
      },
    },
    error: {
      label: 'ERROR',
      dot: 'bg-amber-400',
      style: {
        background: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        color: '#fbbf24',
        boxShadow: '0 0 18px rgba(245, 158, 11, 0.20)',
      },
    },
    offline: {
      label: 'OFFLINE',
      dot: 'bg-red-500',
      style: {
        background: 'rgba(239, 68, 68, 0.10)',
        borderColor: 'rgba(239, 68, 68, 0.30)',
        color: '#f87171',
      },
    },
  };

  const s = config[status] || config.idle;

  const isLive = status === 'live';

  return (
    <div className={`${base}`} style={s.style}>
      {/* DOT + SOFT PULSE (better than animate-ping) */}
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`absolute h-full w-full rounded-full ${s.dot} animate-pulse opacity-70`}
        />
        <span className={`relative h-2.5 w-2.5 rounded-full ${s.dot}`} />
      </span>

      <span>{s.label}</span>

      {/* LIVE BADGE EXTRA SIGNAL */}
      {isLive && (
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-300 animate-ping opacity-60" />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'muted',
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'success' | 'error' | 'accent' | 'muted';
}) {
  const map = {
    success: { bg: 'var(--success-dim)', fg: 'var(--success)' },
    error: { bg: 'var(--error-dim)', fg: 'var(--error)' },
    accent: { bg: 'var(--accent-dim)', fg: 'var(--accent)' },
    muted: { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' },
  }[color];

  return (
    <div
      className="rounded-2xl p-5 shadow-sm border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {title}
          </div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            background: map.bg,
            color: map.fg,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
