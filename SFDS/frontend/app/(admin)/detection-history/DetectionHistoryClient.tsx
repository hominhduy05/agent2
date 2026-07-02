'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Eye, Layers } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import {
  AuditDetectionEvent,
  AuditSummary,
  getAuditSummary,
  listAuditDetections,
} from '@/lib/api';

import {
  CLASS_BADGE_COLORS,
  CLASS_COLORS,
  DetectionHistoryItem,
} from './types';
import { DetectionHistoryMetrics } from './components/DetectionHistoryMetrics';
import { DetectionHistoryFilters } from './components/DetectionHistoryFilters';
import { DetectionDetailModal } from './components/DetectionDetailModal';

export default function DetectionHistoryClient() {
  const [historyData, setHistoryData] = useState<DetectionHistoryItem[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<DetectionHistoryItem | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    let cancelled = false;

    async function loadAuditData() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const [events, nextSummary] = await Promise.all([
          listAuditDetections({ limit: 200 }),
          getAuditSummary(24),
        ]);
        if (cancelled) return;
        setHistoryData(events.items.map(toHistoryItem));
        setSummary(nextSummary);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Khong the tai lich su nhan dien'
        );
        setHistoryData([]);
        setSummary(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadAuditData();

    return () => {
      cancelled = true;
    };
  }, []);

  const cameraOptions = useMemo(() => {
    const list = Array.from(new Set(historyData.map((d) => d.cameraName)));
    return ['ALL', ...list];
  }, [historyData]);

  const classOptions = useMemo(() => {
    const list = Array.from(
      new Set(historyData.flatMap((item) => item.detections.map((det) => det.class_name)))
    ).filter(Boolean);
    return ['ALL', ...list];
  }, [historyData]);

  const filteredData = useMemo(() => {
    return historyData.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.cameraName.toLowerCase().includes(search.toLowerCase());
      const matchesCamera =
        selectedCamera === 'ALL' || item.cameraName === selectedCamera;
      const matchesClass =
        selectedClass === 'ALL' ||
        item.detections.some((d) => d.class_name === selectedClass);
      const matchesDate =
        !selectedDate ||
        (() => {
          const recordDate = new Date(item.timestamp);
          const year = recordDate.getFullYear();
          const month = String(recordDate.getMonth() + 1).padStart(2, '0');
          const day = String(recordDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}` === selectedDate;
        })();
      const matchesConfidence = item.avgConfidence >= minConfidence;

      return matchesSearch && matchesCamera && matchesClass && matchesDate && matchesConfidence;
    });
  }, [historyData, search, selectedCamera, selectedClass, selectedDate, minConfidence]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const metrics = useMemo(() => {
    const totalScans = summary?.total_detections ?? historyData.length;
    const allDetections = historyData.flatMap((item) => item.detections);
    const gradeCounts = summary?.grade_counts ?? {};
    const ripeCount =
      (gradeCounts.A ?? 0) +
      (gradeCounts.mature ?? 0) +
      allDetections.filter((det) => det.class_name === 'Chin').length;
    const defectiveCount =
      (gradeCounts.D ?? 0) +
      (gradeCounts.defective ?? 0) +
      allDetections.filter((det) => ['Hu', 'Sau ray'].includes(det.class_name)).length;
    const avgConf = summary
      ? Math.round(summary.avg_confidence * 100)
      : Math.round(
          historyData.reduce((sum, item) => sum + item.avgConfidence, 0) /
            (historyData.length || 1)
        );

    return {
      totalScans,
      ripeRate:
        allDetections.length > 0
          ? Math.round((ripeCount / allDetections.length) * 100)
          : 0,
      defectiveCount,
      avgConf,
    };
  }, [historyData, summary]);

  const formatDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-3 sm:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            <Activity className="h-6 w-6 text-brand-500" />
            Lich Su Nhan Dien
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Du lieu audit duoc doc tu PostgreSQL offline tren factory server.
          </p>
        </div>
      </div>

      <DetectionHistoryMetrics metrics={metrics} />

      <DetectionHistoryFilters
        search={search}
        setSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        selectedCamera={selectedCamera}
        setSelectedCamera={(v) => { setSelectedCamera(v); setCurrentPage(1); }}
        selectedClass={selectedClass}
        setSelectedClass={(v) => { setSelectedClass(v); setCurrentPage(1); }}
        selectedDate={selectedDate}
        setSelectedDate={(v) => { setSelectedDate(v); setCurrentPage(1); }}
        minConfidence={minConfidence}
        setMinConfidence={(v) => { setMinConfidence(v); setCurrentPage(1); }}
        cameraOptions={cameraOptions}
        classOptions={classOptions}
        filteredCount={filteredData.length}
      />

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 backdrop-blur-xl overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Layers className="h-12 w-12 text-gray-400 dark:text-gray-700 mx-auto" />
            <h4 className="text-gray-900 dark:text-white font-semibold">
              {isLoading ? 'Dang tai lich su nhan dien' : 'Khong tim thay du lieu nhan dien'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {loadError || 'Chua co audit event nao phu hop voi bo loc hien tai.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="text-left border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <TableCell isHeader className="px-6 py-4">Ma quet</TableCell>
                    <TableCell isHeader className="px-6 py-4">Xem truoc</TableCell>
                    <TableCell isHeader className="px-6 py-4">Thoi gian</TableCell>
                    <TableCell isHeader className="px-6 py-4">Nguon camera</TableCell>
                    <TableCell isHeader className="px-6 py-4">Ket qua AI</TableCell>
                    <TableCell isHeader className="px-6 py-4 text-center">Tin cay TB</TableCell>
                    <TableCell isHeader className="px-6 py-4 text-right">Chi tiet</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200/60 dark:divide-gray-800/60 text-sm text-gray-600 dark:text-gray-300">
                  {paginatedData.map((item) => {
                    const classCounts = item.detections.reduce(
                      (acc, detection) => {
                        acc[detection.class_name] = (acc[detection.class_name] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>
                    );

                    return (
                      <TableRow key={item.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors group whitespace-nowrap">
                        <TableCell className="px-6 py-4 font-mono text-xs text-brand-500 dark:text-brand-400 font-semibold">
                          {item.id}
                        </TableCell>

                        <TableCell className="px-6 py-4">
                          <div className="w-16 h-12 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 overflow-hidden relative flex items-center justify-center">
                            <svg className="w-full h-full p-1" viewBox={`0 0 ${item.imageWidth} ${item.imageHeight}`}>
                              <defs>
                                <radialGradient id={`durian-grad-${item.id}`} cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor="#eab308" />
                                  <stop offset="70%" stopColor="#84cc16" />
                                  <stop offset="100%" stopColor="#4d7c0f" />
                                </radialGradient>
                              </defs>
                              <path
                                d={`M ${item.imageWidth / 2} ${item.imageHeight * 0.16} Q ${item.imageWidth * 0.75} ${item.imageHeight * 0.25} ${item.imageWidth * 0.75} ${item.imageHeight * 0.5} Q ${item.imageWidth * 0.75} ${item.imageHeight * 0.8} ${item.imageWidth / 2} ${item.imageHeight * 0.84} Q ${item.imageWidth * 0.25} ${item.imageHeight * 0.8} ${item.imageWidth * 0.25} ${item.imageHeight * 0.5} Q ${item.imageWidth * 0.25} ${item.imageHeight * 0.25} ${item.imageWidth / 2} ${item.imageHeight * 0.16} Z`}
                                fill={`url(#durian-grad-${item.id})`}
                                stroke="#3f6212"
                                strokeWidth="8"
                              />
                              {item.detections.map((det, index) => {
                                const color = CLASS_COLORS[det.class_name] || '#fff';
                                return (
                                  <rect
                                    key={`${item.id}-${index}`}
                                    x={det.x1}
                                    y={det.y1}
                                    width={det.x2 - det.x1}
                                    height={det.y2 - det.y1}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="14"
                                    rx="8"
                                  />
                                );
                              })}
                            </svg>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-4 text-xs">
                          {formatDate(item.timestamp)}
                        </TableCell>

                        <TableCell className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{item.cameraName}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Slot {item.slotIndex + 1}</span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                            {Object.entries(classCounts).map(([className, count]) => (
                              <Badge
                                key={className}
                                color={CLASS_BADGE_COLORS[className] || 'primary'}
                                variant="light"
                                className="text-xs px-2 py-0.5"
                              >
                                {className} {count > 1 ? `x${count}` : ''}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-gray-900 dark:text-white text-xs">{item.avgConfidence}%</span>
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.avgConfidence >= 90
                                    ? 'bg-success-500'
                                    : item.avgConfidence >= 80
                                      ? 'bg-brand-500'
                                      : 'bg-warning-500'
                                }`}
                                style={{ width: `${item.avgConfidence}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-brand-500/10 hover:border-brand-500/20 border border-transparent transition-all"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredData.length}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}
      </div>

      <DetectionDetailModal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </div>
  );
}

function toHistoryItem(event: AuditDetectionEvent): DetectionHistoryItem {
  const detections = (event.detections || []).map((det) => ({
    x1: Number(det.x1 ?? 0),
    y1: Number(det.y1 ?? 0),
    x2: Number(det.x2 ?? 0),
    y2: Number(det.y2 ?? 0),
    confidence: Number(det.confidence ?? event.confidence ?? 0),
    class_name: det.class_name || event.final_grade || event.class_name || 'unknown',
    track_id: det.track_id ?? event.track_id ?? null,
  }));

  const avgConfidence =
    detections.length > 0
      ? Math.round(
          (detections.reduce((sum, det) => sum + det.confidence, 0) /
            detections.length) *
            100
        )
      : Math.round(Number(event.confidence ?? 0) * 100);

  return {
    id: event.event_id || `DET-${event.id}`,
    timestamp: event.timestamp || new Date().toISOString(),
    slotIndex: event.camera_slot ?? 0,
    cameraName:
      event.camera_slot !== null && event.camera_slot !== undefined
        ? `Camera Slot ${event.camera_slot + 1}`
        : 'Camera khong xac dinh',
    imageWidth: event.image_width ?? 640,
    imageHeight: event.image_height ?? 480,
    detections,
    device: 'SFDS Factory Server',
    model_format: event.source || 'scada',
    avgConfidence,
  };
}
