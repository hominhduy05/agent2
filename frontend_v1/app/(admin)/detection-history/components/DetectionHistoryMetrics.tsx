import React from 'react';
import { Layers, CheckCircle, AlertTriangle, Percent } from 'lucide-react';

interface MetricsProps {
  metrics: {
    totalScans: number;
    ripeRate: number;
    defectiveCount: number;
    avgConf: number;
  };
}

export const DetectionHistoryMetrics: React.FC<MetricsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Metric 1 */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 backdrop-blur-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tổng số lượt quét</span>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.totalScans}</h3>
          <p className="text-xs text-success-500 mt-1 flex items-center gap-1">
            <span>↑ 12%</span>
            <span className="text-gray-500 dark:text-gray-500">so với hôm qua</span>
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20">
          <Layers className="h-6 w-6" />
        </div>
      </div>

      {/* Metric 2 */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 backdrop-blur-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tỉ lệ quả chín</span>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.ripeRate}%</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Chất lượng thu hoạch tốt
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-500 border border-success-500/20">
          <CheckCircle className="h-6 w-6" />
        </div>
      </div>

      {/* Metric 3 */}
      <div className="p-5 rounded-2xl border bg-white dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 backdrop-blur-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quả sâu hại / Hư</span>
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
      <div className="p-5 rounded-2xl border bg-white dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 backdrop-blur-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Độ tin cậy TB</span>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.avgConf}%</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Mức chính xác mô hình AI
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
          <Percent className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};
