'use client';

import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Layers 
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';

import { 
  MOCK_HISTORY_DATA, 
  CLASS_COLORS, 
  CLASS_BADGE_COLORS, 
  DetectionHistoryItem 
} from './types';
import { DetectionHistoryMetrics } from './components/DetectionHistoryMetrics';
import { DetectionHistoryFilters } from './components/DetectionHistoryFilters';
import { DetectionDetailModal } from './components/DetectionDetailModal';

export default function DetectionHistoryClient() {
  // States
  const [search, setSearch] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(30); // 30% min
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<DetectionHistoryItem | null>(null);
  const itemsPerPage = 5;

  // Camera options derived from mock data
  const cameraOptions = useMemo(() => {
    const list = Array.from(new Set(MOCK_HISTORY_DATA.map(d => d.cameraName)));
    return ['ALL', ...list];
  }, []);

  // Class name options
  const classOptions = ['ALL', 'Chín', 'Xanh', 'Sượng', 'Sâu rầy', 'Hư'];

  // Filtered mock data
  const filteredData = useMemo(() => {
    return MOCK_HISTORY_DATA.filter(item => {
      // 1. Search filter
      const matchesSearch = item.id.toLowerCase().includes(search.toLowerCase()) || 
        item.cameraName.toLowerCase().includes(search.toLowerCase());
      
      // 2. Camera filter
      const matchesCamera = selectedCamera === 'ALL' || item.cameraName === selectedCamera;

      // 3. Class filter
      const matchesClass = selectedClass === 'ALL' || 
        item.detections.some(d => d.class_name === selectedClass);

      // 4. Date filter
      const matchesDate = !selectedDate || (() => {
        const recordDate = new Date(item.timestamp);
        const year = recordDate.getFullYear();
        const month = String(recordDate.getMonth() + 1).padStart(2, '0');
        const day = String(recordDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}` === selectedDate;
      })();

      // 5. Confidence filter
      const matchesConfidence = item.avgConfidence >= minConfidence;

      return matchesSearch && matchesCamera && matchesClass && matchesDate && matchesConfidence;
    });
  }, [search, selectedCamera, selectedClass, selectedDate, minConfidence]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Overall metrics calculation
  const metrics = useMemo(() => {
    const totalScans = MOCK_HISTORY_DATA.length;
    const allDets = MOCK_HISTORY_DATA.flatMap(d => d.detections);
    const ripeCount = allDets.filter(d => d.class_name === 'Chín').length;
    const defectiveCount = allDets.filter(d => d.class_name === 'Sâu rầy' || d.class_name === 'Hư').length;
    
    const sumConf = MOCK_HISTORY_DATA.reduce((sum, d) => sum + d.avgConfidence, 0);
    const avgConf = totalScans > 0 ? Math.round(sumConf / totalScans) : 0;

    return {
      totalScans,
      ripeRate: allDets.length > 0 ? Math.round((ripeCount / allDets.length) * 100) : 0,
      defectiveCount,
      avgConf
    };
  }, []);

  // Format date helper
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
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            <Activity className="h-6 w-6 text-brand-500" />
            Lịch Sử Nhận Diện
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tra cứu và xem lại kết quả phân loại sầu riêng thời gian thực từ các camera.
          </p>
        </div>
      </div>

      {/* METRICS PANEL */}
      <DetectionHistoryMetrics metrics={metrics} />

      {/* FILTER PANEL */}
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

      {/* TABLE AREA */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 backdrop-blur-xl overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Layers className="h-12 w-12 text-gray-400 dark:text-gray-700 mx-auto" />
            <h4 className="text-gray-900 dark:text-white font-semibold">Không tìm thấy dữ liệu nhận diện</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Không tìm thấy kết quả nào phù hợp với bộ lọc đã chọn. Vui lòng thay đổi cấu hình bộ lọc hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="text-left border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <TableCell isHeader className="px-6 py-4">Mã quét (ID)</TableCell>
                    <TableCell isHeader className="px-6 py-4">Xem trước</TableCell>
                    <TableCell isHeader className="px-6 py-4">Thời gian</TableCell>
                    <TableCell isHeader className="px-6 py-4">Nguồn Camera</TableCell>
                    <TableCell isHeader className="px-6 py-4">Kết quả phát hiện (AI)</TableCell>
                    <TableCell isHeader className="px-6 py-4 text-center">Độ tin cậy TB</TableCell>
                    <TableCell isHeader className="px-6 py-4 text-right">Chi tiết</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200/60 dark:divide-gray-800/60 text-sm text-gray-600 dark:text-gray-300">
                  {paginatedData.map((item) => {
                    const classCounts = item.detections.reduce((acc, d) => {
                      acc[d.class_name] = (acc[d.class_name] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return (
                      <TableRow key={item.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors group whitespace-nowrap">
                        {/* ID */}
                        <TableCell className="px-6 py-4 font-mono text-xs text-brand-500 dark:text-brand-400 font-semibold">
                          {item.id}
                        </TableCell>

                        {/* Preview thumbnail (SVG render) */}
                        <TableCell className="px-6 py-4">
                          <div className="w-16 h-12 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 overflow-hidden relative flex items-center justify-center">
                            <svg className="w-full h-full p-1" viewBox="0 0 640 480">
                              <defs>
                                <radialGradient id="durian-grad-thumb" cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor="#eab308" />
                                  <stop offset="70%" stopColor="#84cc16" />
                                  <stop offset="100%" stopColor="#4d7c0f" />
                                </radialGradient>
                              </defs>
                              <path 
                                d="M 320 80 Q 480 120 480 240 Q 480 380 320 400 Q 160 380 160 240 Q 160 120 320 80 Z" 
                                fill="url(#durian-grad-thumb)"
                                stroke="#3f6212"
                                strokeWidth="8"
                              />
                              {item.detections.map((det, i) => {
                                const color = CLASS_COLORS[det.class_name] || "#fff";
                                return (
                                  <rect
                                    key={i}
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

                        {/* Timestamp */}
                        <TableCell className="px-6 py-4 text-xs">
                          {formatDate(item.timestamp)}
                        </TableCell>

                        {/* Camera */}
                        <TableCell className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{item.cameraName}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Slot {item.slotIndex + 1}</span>
                          </div>
                        </TableCell>

                        {/* Badges */}
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                            {Object.entries(classCounts).map(([cls, count]) => (
                              <Badge
                                key={cls}
                                color={CLASS_BADGE_COLORS[cls] || 'primary'}
                                variant="light"
                                className="text-xs px-2 py-0.5"
                              >
                                {cls} {count > 1 ? `x${count}` : ''}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        {/* Accuracy */}
                        <TableCell className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-gray-900 dark:text-white text-xs">{item.avgConfidence}%</span>
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.avgConfidence >= 90 ? 'bg-success-500' :
                                  item.avgConfidence >= 80 ? 'bg-brand-500' : 'bg-warning-500'
                                }`} 
                                style={{ width: `${item.avgConfidence}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Action CTA */}
                        <TableCell className="px-6 py-4 text-right">
                          <button
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

            {/* PAGINATION FOOTER */}
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

      {/* DETAIL MODAL */}
      <DetectionDetailModal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </div>
  );
}
