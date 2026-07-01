'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  Search,
  CameraOff,
} from 'lucide-react';

import { getScadaManager } from '@/lib/scada-manager';

export default function CameraManagerPage() {
  const [tick, setTick] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);

  const manager = getScadaManager();

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((v) => v + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const rooms = useMemo(() => {
    const result = [];

    for (let i = 0; i < manager.cameras.length; i += 5) {
      result.push({
        id: i / 5,
        name: `Buồng ${i / 5 + 1}`,
        cameras: manager.cameras.slice(i, i + 5),
      });
    }

    return result;
  }, [manager.cameras, tick]);

  const cameras = manager.cameras;

  const stats = useMemo(() => {
    return {
      total: cameras.length,

      online: cameras.filter((c) => c.isActive && !c.error).length,

      offline: cameras.filter((c) => !c.isActive).length,

      detecting: cameras.filter((c) => c.isDetecting).length,

      errors: cameras.filter((c) => !!c.error).length,
    };
  }, [cameras, tick]);

  const visibleRooms =
    selectedRoom === null ? rooms : rooms.filter((r) => r.id === selectedRoom);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      {/* Header */}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Camera Control Center
          </h1>

          <p className="text-sm text-[var(--text-muted)]">
            Real-time SCADA monitoring system
          </p>
        </div>

        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-2">
          <div className="text-xs text-[var(--text-muted)]">System Time</div>
          <div className="font-semibold">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* KPI */}

      <div className="mb-5 flex flex-wrap gap-2">
        <StatCard
          title="Tổng Camera"
          value={stats.total}
          icon={<Camera size={20} />}
        />

        <StatCard
          title="Online"
          value={stats.online}
          icon={<Wifi size={20} />}
          color="green"
        />

        <StatCard
          title="Offline"
          value={stats.offline}
          icon={<WifiOff size={20} />}
          color="gray"
        />

        <StatCard
          title="Detecting"
          value={stats.detecting}
          icon={<Search size={20} />}
          color="blue"
        />

        <StatCard
          title="Lỗi"
          value={stats.errors}
          icon={<AlertTriangle size={20} />}
          color="red"
        />
      </div>

      {/* Room Selector */}

      <div className="mb-5 flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedRoom(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition
${
  selectedRoom === null
    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-elevated)]'
}`}
        >
          Tất cả
        </button>

        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`rounded-xl px-4 py-2 font-medium border transition
      ${
        selectedRoom === room.id
          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
          : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg-elevated)]'
      }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Rooms */}

      <div className="space-y-6">
        {visibleRooms.map((room) => (
          <div
            key={room.id}
            className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{room.name}</h2>

                  <div className="text-sm text-[var(--text-muted)]">
                    {room.cameras.filter((c) => c.isActive).length}/
                    {room.cameras.length} active cameras
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-[var(--success)]">
                  <Activity size={14} />
                  LIVE
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-green-600">
                <Activity size={16} />
                LIVE
              </div>
            </div>

            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {room.cameras.map((camera) => (
                <CameraCard key={camera.id} camera={camera} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraCard({ camera }: any) {
  const manager = getScadaManager();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    manager.setRefs(camera.id, videoRef, canvasRef);
  }, [camera.id, manager]);

  const status = !camera.isActive
    ? 'offline'
    : camera.error
      ? 'error'
      : camera.isDetecting
        ? 'detecting'
        : 'online';

  const statusConfig = {
    online: {
      label: 'ONLINE',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30',
    },
    detecting: {
      label: 'AI DETECT',
      dot: 'bg-sky-500',
      badge: 'bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/30',
    },
    error: {
      label: 'ERROR',
      dot: 'bg-red-500',
      badge: 'bg-red-500/15 text-red-500 ring-1 ring-red-500/30',
    },
    offline: {
      label: 'OFFLINE',
      dot: 'bg-slate-500',
      badge: 'bg-slate-500/15 text-slate-500 ring-1 ring-slate-500/30',
    },
  }[status];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* ================= VIDEO ================= */}

      <div className="relative h-46 overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* overlay khi offline */}

        {!camera.isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm">
            <CameraOff size={35} className="mb-2 text-slate-500" />

            <div className="text-md font-semibold text-slate-300">
              No Signal
            </div>
          </div>
        )}

        {/* gradient */}

        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* camera name */}

        <div className="absolute left-4 top-4">
          <div className="rounded-lg bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {camera.label}
          </div>
        </div>

        {/* status */}

        <div
          className={`absolute right-4 top-4 flex items-center gap-2 text-[11px] font-semibold backdrop-blur`}
        >
          <span className={`h-2 w-2 rounded-full ${statusConfig.dot}`} />
        </div>

        {/* frame */}

        <div className="absolute text-center bottom-1 left-4 rounded-lg bg-black/45 px-3 py-0.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-wider text-slate-300">
            Frames
          </div>

          <div className="text-lg font-bold text-white">
            {camera.frameCount}
          </div>
        </div>

        {/* detect */}

        <div className="absolute text-center bottom-1 right-4 rounded-lg bg-black/45 px-3 py-0.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-wider text-slate-300">
            Objects
          </div>

          <div className="text-lg font-bold text-white">
            {camera.result?.detections?.length ?? 0}
          </div>
        </div>
      </div>

      {/* ================= INFO ================= */}

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
            <div className="text-[10.8px] uppercase tracking-wide text-[var(--text-muted)]">
              AI Status
            </div>

            <div
              className={`mt-2 text-center inline-flex rounded-full px-1.5 py-1 text-xs font-semibold ${statusConfig.badge}`}
            >
              {status.toUpperCase()}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
            <div className="text-[10.8px] uppercase tracking-wide text-[var(--text-muted)]">
              Camera ID
            </div>

            <div className="mt-2 text-lg font-bold">#{camera.id}</div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
          <div className="mb-2 text-[10.8px] uppercase tracking-wide text-[var(--text-muted)]">
            Device
          </div>

          <div
            className="truncate text-sm font-medium"
            title={camera.deviceLabel}
          >
            {camera.deviceLabel || '--'}
          </div>
        </div>
      </div>

      {camera.error && (
        <div className="border-t border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />

            <div className="text-sm text-red-400">{camera.error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color = 'slate' }: any) {
  const colors: any = {
    green: 'text-[var(--success)] bg-[var(--success-dim)]',
    red: 'text-[var(--error)] bg-[var(--error-dim)]',
    blue: 'text-[var(--accent)] bg-[var(--accent-dim)]',
    gray: 'text-[var(--text-muted)] bg-[var(--bg-elevated)]',
    slate: 'text-[var(--text)] bg-[var(--bg-elevated)]',
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
            {title}
          </div>

          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>

        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
