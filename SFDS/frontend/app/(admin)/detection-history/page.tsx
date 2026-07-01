'use client';

import React, { useMemo, useState } from 'react';
import { 
  Search, 
  Calendar, 
  Layers, 
  Sliders, 
  Cpu, 
  Activity, 
  Percent, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

// Mock detection history items representing durians
interface DetectionHistoryItem {
  id: string;
  timestamp: string;
  slotIndex: number;
  cameraName: string;
  imageWidth: number;
  imageHeight: number;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    class_name: string;
    track_id?: number | null;
  }>;
  device: string;
  model_format: string;
  avgConfidence: number;
}

// Bounding box colors matching detection labels
const CLASS_COLORS: Record<string, string> = {
  "Xanh": "#3b82f6",       // Blue (unripe)
  "Sượng": "#f59e0b",      // Amber (uneven)
  "Chín": "#10b981",       // Green (ripe)
  "Sâu rầy": "#ef4444",    // Red (pest)
  "Hư": "#dc2626",         // Dark red (damaged)
  "A": "#10b981",
  "B": "#059669",
  "C": "#d97706",
  "D": "#ef4444",
};

const CLASS_BADGE_COLORS: Record<string, 'primary' | 'warning' | 'success' | 'error' | 'info' | 'light' | 'dark'> = {
  "Xanh": "info",
  "Sượng": "warning",
  "Chín": "success",
  "Sâu rầy": "error",
  "Hư": "error",
  "A": "success",
  "B": "success",
  "C": "warning",
  "D": "error",
};

const MOCK_HISTORY_DATA: DetectionHistoryItem[] = [
  {
    id: "DET-20260629-001",
    timestamp: "2026-06-29T14:15:30+07:00",
    slotIndex: 0,
    cameraName: "Camera Buồng 1 (Lối vào A)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 91,
    detections: [
      { x1: 120, y1: 150, x2: 280, y2: 320, confidence: 0.94, class_name: "Chín", track_id: 101 },
      { x1: 340, y1: 180, x2: 490, y2: 350, confidence: 0.88, class_name: "Sượng", track_id: 102 }
    ]
  },
  {
    id: "DET-20260629-002",
    timestamp: "2026-06-29T13:40:22+07:00",
    slotIndex: 1,
    cameraName: "Camera Buồng 1 (Lối vào B)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 93,
    detections: [
      { x1: 200, y1: 100, x2: 450, y2: 380, confidence: 0.93, class_name: "Chín", track_id: 103 }
    ]
  },
  {
    id: "DET-20260629-003",
    timestamp: "2026-06-29T12:10:05+07:00",
    slotIndex: 2,
    cameraName: "Camera Buồng 2 (Kiểm định 1)",
    imageWidth: 640,
    imageHeight: 480,
    device: "CPU - Server Local",
    model_format: "YOLOv8s ONNX",
    avgConfidence: 96,
    detections: [
      { x1: 150, y1: 120, x2: 380, y2: 390, confidence: 0.96, class_name: "Xanh", track_id: 104 }
    ]
  },
  {
    id: "DET-20260629-004",
    timestamp: "2026-06-29T10:05:44+07:00",
    slotIndex: 0,
    cameraName: "Camera Buồng 1 (Lối vào A)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 81,
    detections: [
      { x1: 100, y1: 140, x2: 260, y2: 300, confidence: 0.88, class_name: "Sâu rầy", track_id: 105 },
      { x1: 300, y1: 160, x2: 520, y2: 400, confidence: 0.74, class_name: "Hư", track_id: 106 }
    ]
  },
  {
    id: "DET-20260628-001",
    timestamp: "2026-06-28T17:30:15+07:00",
    slotIndex: 3,
    cameraName: "Camera Buồng 2 (Kiểm định 2)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 82,
    detections: [
      { x1: 180, y1: 130, x2: 420, y2: 370, confidence: 0.82, class_name: "Sượng", track_id: 98 }
    ]
  },
  {
    id: "DET-20260628-002",
    timestamp: "2026-06-28T16:15:00+07:00",
    slotIndex: 1,
    cameraName: "Camera Buồng 1 (Lối vào B)",
    imageWidth: 640,
    imageHeight: 480,
    device: "CPU - Server Local",
    model_format: "YOLOv8s ONNX",
    avgConfidence: 93,
    detections: [
      { x1: 80, y1: 100, x2: 280, y2: 310, confidence: 0.95, class_name: "Chín", track_id: 99 },
      { x1: 320, y1: 120, x2: 560, y2: 390, confidence: 0.91, class_name: "Xanh", track_id: 100 }
    ]
  },
  {
    id: "DET-20260628-003",
    timestamp: "2026-06-28T11:20:45+07:00",
    slotIndex: 4,
    cameraName: "Camera Buồng 3 (Đóng gói)",
    imageWidth: 640,
    imageHeight: 480,
    device: "NVIDIA Jetson Orin Nano",
    model_format: "YOLOv8s TensorRT",
    avgConfidence: 89,
    detections: [
      { x1: 140, y1: 160, x2: 400, y2: 410, confidence: 0.89, class_name: "Chín", track_id: 95 }
    ]
  }
];

export default function DetectionHistoryPage() {
  // States
  const [search, setSearch] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('ALL');
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
      const matchesDate = (() => {
        if (selectedDateRange === 'ALL') return true;
        const recordDate = new Date(item.timestamp).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (selectedDateRange === 'TODAY') return recordDate === today;
        if (selectedDateRange === 'YESTERDAY') return recordDate === yesterday;
        return true;
      })();

      // 5. Confidence filter
      const matchesConfidence = item.avgConfidence >= minConfidence;

      return matchesSearch && matchesCamera && matchesClass && matchesDate && matchesConfidence;
    });
  }, [search, selectedCamera, selectedClass, selectedDateRange, minConfidence]);

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
    <div className="space-y-6 animate-fade-in p-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            <Activity className="h-6 w-6 text-[var(--accent)]" />
            Lịch Sử Nhận Diện
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Tra cứu và xem lại kết quả phân loại sầu riêng thời gian thực từ các camera.
          </p>
        </div>
        <Badge variant="light" color="success" className="py-1 px-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-dim)] mr-2 inline-block"></span>
          Đang kết nối
        </Badge>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl border bg-[var(--scada-panel)] border-[var(--scada-border)] backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tổng số lượt quét</span>
            <h3 className="text-2xl font-bold text-[var(--text)] mt-1">{metrics.totalScans}</h3>
            <p className="text-xs text-[var(--accent)] mt-1 flex items-center gap-1">
              <span>↑ 12%</span>
              <span className="text-gray-500">so với hôm qua</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-[var(--accent)] border border-brand-500/20">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl border bg-[var(--scada-panel)] border-[var(--scada-border)] backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tỉ lệ quả chín</span>
            <h3 className="text-2xl font-bold text-[var(--text)] mt-1">{metrics.ripeRate}%</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Chất lượng thu hoạch tốt
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)]/10 flex items-center justify-center text-[var(--accent)] border border-success-500/20">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl border bg-[var(--scada-panel)] border-[var(--scada-border)] backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Quả sâu hại / Hư</span>
            <h3 className="text-2xl font-bold text-error-500 mt-1">{metrics.defectiveCount} quả</h3>
            <p className="text-xs text-gray-500 mt-1">
              Cần phân loại loại bỏ
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-error-500/10 flex items-center justify-center text-error-500 border border-error-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl border bg-[var(--scada-panel)] border-[var(--scada-border)] backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Độ tin cậy TB</span>
            <h3 className="text-2xl font-bold text-[var(--text)] mt-1">{metrics.avgConf}%</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Mức chính xác mô hình AI
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="p-6 rounded-2xl border bg-[var(--scada-panel)] border-[var(--scada-border)] backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--scada-border)] pb-3 text-[var(--text)] font-medium">
          <Sliders className="h-4 w-4 text-[var(--accent)]" />
          <span>Bộ lọc nâng cao</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Camera Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Tìm theo ID / Tên Camera</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập từ khóa..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="
w-full px-3 py-2.5 text-sm rounded-lg
bg-[var(--bg-input)]
border border-[var(--border)]
text-[var(--text)]
focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder:pl-6
"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            </div>
          </div>

          {/* Camera Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Lọc theo Camera</label>
            <select
              value={selectedCamera}
              onChange={e => { setSelectedCamera(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--scada-border)] text-[var(--text)] focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Tất cả camera</option>
              {cameraOptions.filter(c => c !== 'ALL').map(cam => (
                <option key={cam} value={cam}>{cam}</option>
              ))}
            </select>
          </div>

          {/* Class Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Phân loại AI</label>
            <select
              value={selectedClass}
              onChange={e => { setSelectedClass(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--scada-border)] text-[var(--text)] focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Tất cả phân loại</option>
              {classOptions.filter(c => c !== 'ALL').map(cl => (
                <option key={cl} value={cl}>{cl}</option>
              ))}
            </select>
          </div>

          {/* Date Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Thời gian quét</label>
            <div className="relative">
              <select
                value={selectedDateRange}
                onChange={e => { setSelectedDateRange(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--scada-border)] text-[var(--text)] focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
              >
                <option value="ALL">Tất cả thời gian</option>
                <option value="TODAY">Hôm nay</option>
                <option value="YESTERDAY">Hôm qua</option>
              </select>
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Confidence Threshold Slider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[var(--scada-border)]/40">
          <div className="flex items-center gap-4 w-full max-w-lg">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase whitespace-nowrap">Độ tin cậy tối thiểu:</span>
            <input 
              type="range" 
              min="10" 
              max="95" 
              value={minConfidence} 
              onChange={e => { setMinConfidence(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-500" 
            />
            <span className="text-sm font-bold text-[var(--accent)] w-10 text-right">{minConfidence}%</span>
          </div>
          <div className="flex justify-end gap-2 text-xs text-gray-500">
            Tìm thấy <strong className="text-[var(--text)]">{filteredData.length}</strong> kết quả nhận diện
          </div>
        </div>
      </div>

      {/* TABLE AND GRID AREA */}
      <div className="rounded-2xl border border-[var(--scada-border)] bg-[var(--scada-panel)] backdrop-blur-xl overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Layers className="h-12 w-12 text-gray-700 mx-auto" />
            <h4 className="text-[var(--text)] font-semibold">Không tìm thấy dữ liệu nhận diện</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Không tìm thấy kết quả nào phù hợp với bộ lọc đã chọn. Vui lòng thay đổi cấu hình bộ lọc hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--scada-border)] bg-[var(--bg-input)]/30 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="px-6 py-4">Mã quét (ID)</th>
                    <th className="px-6 py-4">Xem trước</th>
                    <th className="px-6 py-4">Thời gian</th>
                    <th className="px-6 py-4">Nguồn Camera</th>
                    <th className="px-6 py-4">Kết quả phát hiện (AI)</th>
                    <th className="px-6 py-4 text-center">Độ tin cậy TB</th>
                    <th className="px-6 py-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-sm text-gray-300">
                  {paginatedData.map((item) => {
                    // Count unique detection types
                    const classCounts = item.detections.reduce((acc, d) => {
                      acc[d.class_name] = (acc[d.class_name] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* ID */}
                        <td className="px-6 py-4 font-mono text-xs text-brand-400 font-semibold">
                          {item.id}
                        </td>

                        {/* Preview vector thumbnail */}
                        <td className="px-6 py-4">
                          <div className="w-16 h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--scada-border)] overflow-hidden relative flex items-center justify-center">
                            {/* SVG Mockup of spiky durian with overlay boxes */}
                            <svg className="w-full h-full p-1" viewBox="0 0 640 480">
                              <defs>
                                <radialGradient id="durian-grad" cx="50%" cy="50%" r="50%">
                                  <stop offset="0%" stopColor="#eab308" />
                                  <stop offset="70%" stopColor="#84cc16" />
                                  <stop offset="100%" stopColor="#4d7c0f" />
                                </radialGradient>
                              </defs>
                              {/* Spiky Durian Base shape */}
                              <path 
                                d="M 320 80 Q 480 120 480 240 Q 480 380 320 400 Q 160 380 160 240 Q 160 120 320 80 Z" 
                                fill="url(#durian-grad)"
                                stroke="#3f6212"
                                strokeWidth="8"
                              />
                              {/* Draw spiky texture lines */}
                              <path d="M 320 80 L 320 400 M 240 140 L 250 360 M 400 140 L 390 360" stroke="#365314" strokeWidth="3" opacity="0.3" strokeDasharray="5,5" />
                              
                              {/* Mock Box overlays */}
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
                                    opacity="0.9"
                                  />
                                );
                              })}
                            </svg>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="px-6 py-4 text-xs">
                          {formatDate(item.timestamp)}
                        </td>

                        {/* Camera */}
                        <td className="px-6 py-4 font-medium text-[var(--text)]">
                          <div className="flex flex-col">
                            <span>{item.cameraName}</span>
                            <span className="text-xs text-gray-500">Slot {item.slotIndex + 1}</span>
                          </div>
                        </td>

                        {/* Bounding Box Badges */}
                        <td className="px-6 py-4">
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
                        </td>

                        {/* Accuracy */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-[var(--text)] text-xs">{item.avgConfidence}%</span>
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.avgConfidence >= 90 ? 'bg-[var(--accent-dim)]' :
                                  item.avgConfidence >= 80 ? 'bg-brand-500' : 'bg-warning-500'
                                }`} 
                                style={{ width: `${item.avgConfidence}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Details CTA */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800/80 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-brand-500/10 hover:border-brand-500/20 border border-transparent transition-all"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION FOOTER */}
            <div className="px-6 py-4 border-t border-[var(--scada-border)] bg-[var(--bg-elevated)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-[var(--text-muted)]">
  Hiển thị dòng{' '}
  <strong className="text-[var(--text)]">
    {(currentPage - 1) * itemsPerPage + 1}
  </strong>{' '}
  đến{' '}
  <strong className="text-[var(--text)]">
    {Math.min(currentPage * itemsPerPage, filteredData.length)}
  </strong>{' '}
  trong tổng số{' '}
  <strong className="text-[var(--text)]">{filteredData.length}</strong> kết quả
</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="!py-1.5 !px-2.5"
                  startIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Trước
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNo => (
                  <button
                    key={pageNo}
                    onClick={() => setCurrentPage(pageNo)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      currentPage === pageNo
                        ? 'bg-brand-500 text-white'
                        : 'text-brand-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {pageNo}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="!py-1.5 !px-2.5"
                  endIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Sau
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DETAIL DRAWER / MODAL */}
      <Modal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        className="max-w-4xl p-6 border border-[var(--scada-border)] shadow-2xl overflow-hidden"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--scada-border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[var(--text)]" style={{ fontFamily: 'Sora, sans-serif' }}>
                    Chi tiết nhận diện: {selectedItem.id}
                  </h3>
                  <Badge color={selectedItem.avgConfidence >= 90 ? 'success' : 'primary'} variant="light">
                    Độ tin cậy: {selectedItem.avgConfidence}%
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Được ghi nhận tại {formatDate(selectedItem.timestamp)}
                </p>
              </div>
            </div>

            {/* Modal Content Columns */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Left Column: Interactive Image Rendering */}
              <div className="md:col-span-3 flex flex-col items-center justify-center bg-[var(--bg-input)] border border-[var(--scada-border)] rounded-2xl p-4 min-h-[300px] relative">
                {/* SVG Illustration Durian with spiky nodes + interactive overlay */}
                <div className="w-full max-w-[420px] aspect-[4/3] relative flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 640 480">
                    <defs>
                      <radialGradient id="durian-grad-large" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="40%" stopColor="#eab308" />
                        <stop offset="80%" stopColor="#84cc16" />
                        <stop offset="100%" stopColor="#3f6212" />
                      </radialGradient>
                    </defs>

                    {/* Spiky Durian Base shape */}
                    <path 
                      d="M 320 60 Q 520 100 520 240 Q 520 400 320 420 Q 120 400 120 240 Q 120 100 320 60 Z" 
                      fill="url(#durian-grad-large)"
                      stroke="#274007"
                      strokeWidth="12"
                    />

                    {/* Spikes texture (Polygons) */}
                    <path d="M 320 60 L 320 420 M 220 120 L 220 380 M 420 120 L 420 380" stroke="#3f6212" strokeWidth="4" opacity="0.3" strokeDasharray="8,8" />
                    
                    {/* Bounding box graphics overlay */}
                    {selectedItem.detections.map((det, index) => {
                      const color = CLASS_COLORS[det.class_name] || '#ffffff';
                      const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
                      const labelY = Math.max(22, det.y1 - 8);
                      
                      return (
                        <g key={index} className="cursor-pointer group">
                          {/* Outer glow box */}
                          <rect
                            x={det.x1}
                            y={det.y1}
                            width={det.x2 - det.x1}
                            height={det.y2 - det.y1}
                            fill="none"
                            stroke={color}
                            strokeWidth="4"
                            rx="8"
                            className="group-hover:stroke-[6px] transition-all"
                          />
                          {/* Label background */}
                          <rect
                            x={det.x1}
                            y={labelY - 20}
                            width={110}
                            height={22}
                            fill={color}
                            rx="4"
                          />
                          {/* Text label */}
                          <text
                            x={det.x1 + 6}
                            y={labelY - 4}
                            fill="#000"
                            fontSize={12}
                            fontWeight={800}
                            fontFamily="sans-serif"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Giao diện minh họa mô phỏng AI Bounding Box</span>
              </div>

              {/* Right Column: Metadata & Detailed boxes table */}
              <div className="md:col-span-2 space-y-6">
                {/* System Specs */}
                <div className="space-y-3 bg-[var(--bg-input)]/40 p-4 border border-[var(--scada-border)] rounded-xl">
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Thông số hệ thống
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">Nguồn Camera:</span>
                      <strong className="text-[var(--text)]">{selectedItem.cameraName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Kích thước ảnh:</span>
                      <strong className="text-[var(--text)]">{selectedItem.imageWidth}x{selectedItem.imageHeight} px</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Thiết bị biên:</span>
                      <strong className="text-[var(--text)]">{selectedItem.device}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Định dạng Model:</span>
                      <strong className="text-[var(--text)]">{selectedItem.model_format}</strong>
                    </div>
                  </div>
                </div>

                {/* Box Details list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Danh sách phát hiện ({selectedItem.detections.length})
                  </h4>
                  <div className="divide-y divide-gray-800 border border-[var(--scada-border)] rounded-xl overflow-hidden bg-[var(--bg-input)]/20">
                    {selectedItem.detections.map((det, index) => (
                      <div key={index} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.01]">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: CLASS_COLORS[det.class_name] || '#fff' }}
                          />
                          <div>
                            <span className="font-semibold text-[var(--text)]">{det.class_name}</span>
                            <span className="text-gray-500 block">Track ID: #{det.track_id || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-brand-400">{(det.confidence * 100).toFixed(1)}%</span>
                          <span className="text-gray-600 block">[{det.x1}, {det.y1}, {det.x2}, {det.y2}]</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-[var(--scada-border)] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItem(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}