import React from 'react';
import { Search, Calendar, Sliders } from 'lucide-react';
import Select from '@/components/ui/Select';

interface FiltersProps {
  search: string;
  setSearch: (v: string) => void;
  selectedCamera: string;
  setSelectedCamera: (v: string) => void;
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  minConfidence: number;
  setMinConfidence: (v: number) => void;
  cameraOptions: string[];
  classOptions: string[];
  filteredCount: number;
}

export const DetectionHistoryFilters: React.FC<FiltersProps> = ({
  search,
  setSearch,
  selectedCamera,
  setSelectedCamera,
  selectedClass,
  setSelectedClass,
  selectedDate,
  setSelectedDate,
  minConfidence,
  setMinConfidence,
  cameraOptions,
  classOptions,
  filteredCount,
}) => {
  return (
    <div className="p-6 rounded-2xl border bg-white dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 backdrop-blur-xl space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 text-gray-900 dark:text-white font-medium">
        <Sliders className="h-4 w-4 text-brand-500" />
        <span>Bộ lọc nâng cao</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Camera Search */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tìm theo ID / Tên Camera</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Nhập từ khóa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500 transition-colors"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          </div>
        </div>

        {/* Camera Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Lọc theo Camera</label>
          <Select
            value={selectedCamera}
            onChange={e => setSelectedCamera(e.target.value)}
          >
            <option value="ALL">Tất cả camera</option>
            {cameraOptions.filter(c => c !== 'ALL').map(cam => (
              <option key={cam} value={cam}>{cam}</option>
            ))}
          </Select>
        </div>

        {/* Class Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Phân loại AI</label>
          <Select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="ALL">Tất cả phân loại</option>
            {classOptions.filter(c => c !== 'ALL').map(cl => (
              <option key={cl} value={cl}>{cl}</option>
            ))}
          </Select>
        </div>

        {/* Date Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Thời gian quét</label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
            />
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Confidence Threshold Slider */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-800/40">
        <div className="flex items-center gap-4 w-full max-w-lg">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Độ tin cậy tối thiểu:</span>
          <input 
            type="range" 
            min="10" 
            max="95" 
            value={minConfidence} 
            onChange={e => setMinConfidence(Number(e.target.value))}
            className="w-full h-1 bg-gray-250 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-500" 
          />
          <span className="text-sm font-bold text-brand-500 w-10 text-right">{minConfidence}%</span>
        </div>
        <div className="flex justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
          Tìm thấy <strong className="text-gray-900 dark:text-white">{filteredCount}</strong> kết quả nhận diện
        </div>
      </div>
    </div>
  );
};
