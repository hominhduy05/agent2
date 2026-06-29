'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  Search,
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

      online: cameras.filter(
        (c) => c.isActive && !c.error
      ).length,

      offline: cameras.filter(
        (c) => !c.isActive
      ).length,

      detecting: cameras.filter(
        (c) => c.isDetecting
      ).length,

      errors: cameras.filter(
        (c) => !!c.error
      ).length,
    };
  }, [cameras, tick]);

  const visibleRooms =
    selectedRoom === null
      ? rooms
      : rooms.filter((r) => r.id === selectedRoom);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Camera Management Center
          </h1>

          <p className="text-slate-500">
            Quản lý toàn bộ camera SCADA
          </p>
        </div>

        <div className="rounded-xl bg-white px-5 py-3 shadow">
          <div className="text-xs text-slate-500">
            Last Update
          </div>

          <div className="font-semibold">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPI */}

      <div className="mb-6 grid grid-cols-5 gap-4">
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

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedRoom(null)}
          className={`rounded-xl px-4 py-2 font-medium ${
            selectedRoom === null
              ? 'bg-blue-600 text-white'
              : 'bg-white'
          }`}
        >
          Tất cả
        </button>

        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`rounded-xl px-4 py-2 font-medium ${
              selectedRoom === room.id
                ? 'bg-blue-600 text-white'
                : 'bg-white'
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
            className="rounded-2xl bg-white p-5 shadow"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {room.name}
                </h2>

                <div className="text-sm text-slate-500">
                  {
                    room.cameras.filter(
                      (c) => c.isActive
                    ).length
                  }
                  /{room.cameras.length} camera hoạt động
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-green-600">
                <Activity size={16} />
                LIVE
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {room.cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraCard({ camera }: any) {
  const status = !camera.isActive
    ? 'offline'
    : camera.error
      ? 'error'
      : camera.isDetecting
        ? 'detecting'
        : 'online';

  const statusColor =
    status === 'online'
      ? 'bg-green-500'
      : status === 'detecting'
        ? 'bg-blue-500'
        : status === 'error'
          ? 'bg-red-500'
          : 'bg-slate-400';

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {/* Preview */}

      <div className="relative aspect-video bg-slate-900">
        {camera.videoRef?.current ? (
          <video
            ref={camera.videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            No Signal
          </div>
        )}

        <div className="absolute right-2 top-2">
          <div
            className={`h-3 w-3 rounded-full ${statusColor}`}
          />
        </div>
      </div>

      {/* Info */}

      <div className="space-y-2 p-4">
        <div className="font-semibold">
          {camera.label}
        </div>

        <div className="text-sm text-slate-600">
          Trạng thái:
          <span className="ml-2 font-semibold capitalize">
            {status}
          </span>
        </div>

        <div className="text-sm text-slate-600">
          Frames:
          <span className="ml-2 font-semibold">
            {camera.frameCount}
          </span>
        </div>

        <div className="text-sm text-slate-600">
          Detect:
          <span className="ml-2 font-semibold">
            {camera.result?.detections?.length || 0}
          </span>
        </div>

        <div className="text-sm text-slate-600 truncate">
          Device:
          <span className="ml-2">
            {camera.deviceLabel || '-'}
          </span>
        </div>

        {camera.error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {camera.error}
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
}: any) {
  const colors: any = {
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
          <div className="text-sm text-slate-500">
            {title}
          </div>

          <div className="mt-2 text-3xl font-bold">
            {value}
          </div>
        </div>

        <div
          className={`rounded-xl p-3 ${
            colors[color]
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}