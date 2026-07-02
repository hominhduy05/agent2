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
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Camera Management Center</h1>
          <p className="text-slate-500">
            Trạng thái 5 camera đọc từ PostgreSQL offline
          </p>
        </div>

        <div className="rounded-xl bg-white px-5 py-3 shadow">
          <div className="text-xs text-slate-500">Cập nhật lần cuối</div>
          <div className="font-semibold">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Đang tải...'}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-5 gap-4">
        <StatCard title="Tổng Camera" value={stats.total} icon={<Camera size={20} />} />
        <StatCard title="Online" value={stats.online} icon={<Wifi size={20} />} color="green" />
        <StatCard title="Offline" value={stats.offline} icon={<WifiOff size={20} />} color="gray" />
        <StatCard title="Đang nhận diện" value={stats.detecting} icon={<Search size={20} />} color="blue" />
        <StatCard title="Lỗi" value={stats.errors} icon={<AlertTriangle size={20} />} color="red" />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedRoom(null)}
          className={`rounded-xl px-4 py-2 font-medium ${
            selectedRoom === null ? 'bg-blue-600 text-white' : 'bg-white'
          }`}
        >
          Tất cả
        </button>

        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`rounded-xl px-4 py-2 font-medium ${
              selectedRoom === room.id ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {visibleRooms.map((room) => (
          <div key={room.id} className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{room.name}</h2>
                <div className="text-sm text-slate-500">
                  {room.cameras.filter((camera) => camera.online).length}/
                  {room.cameras.length} camera online
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-green-600">
                <Activity size={16} />
                DB LIVE
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
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

function CameraCard({ camera }: { camera: CameraView }) {
  const status = !camera.configured
    ? 'chưa cấu hình'
    : camera.online
      ? 'online'
      : 'offline';

  const statusColor = camera.online
    ? 'bg-green-500'
    : camera.configured
      ? 'bg-red-500'
      : 'bg-slate-400';

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="relative aspect-video bg-slate-900">
        <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
          {camera.configured ? 'RTSP Camera' : 'Chưa cấu hình'}
        </div>

        <div className="absolute right-2 top-2">
          <div className={`h-3 w-3 rounded-full ${statusColor}`} />
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="font-semibold">{camera.label}</div>

        <div className="text-sm text-slate-600">
          Trạng thái:
          <span className="ml-2 font-semibold">{status}</span>
        </div>

        <div className="text-sm text-slate-600">
          Độ trễ:
          <span className="ml-2 font-semibold">
            {camera.latency_ms !== undefined ? `${camera.latency_ms} ms` : '-'}
          </span>
        </div>

        <div className="text-sm text-slate-600">
          Kích thước:
          <span className="ml-2 font-semibold">
            {camera.width && camera.height
              ? `${camera.width}x${camera.height}`
              : '-'}
          </span>
        </div>

        <div className="truncate text-sm text-slate-600">
          URL:
          <span className="ml-2">{camera.url || '-'}</span>
        </div>

        {camera.configured && !camera.online && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {camera.message}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'slate',
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'blue' | 'gray' | 'slate';
}) {
  const colors = {
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    gray: 'text-slate-600 bg-slate-50',
    slate: 'text-slate-700 bg-slate-50',
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
