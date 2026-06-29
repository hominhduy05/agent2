import React from 'react';
import { Cpu } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { CLASS_COLORS, DetectionHistoryItem } from '../types';
import { DurianVectorPreview } from './DurianVectorPreview';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DetectionHistoryItem | null;
}

export const DetectionDetailModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  if (!item) return null;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
    >
      <div className="space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                Chi tiết nhận diện: {item.id}
              </h3>
              <Badge color={item.avgConfidence >= 90 ? 'success' : 'primary'} variant="light">
                Độ tin cậy: {item.avgConfidence}%
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Được ghi nhận tại {formatDate(item.timestamp)}
            </p>
          </div>
        </div>

        {/* Modal Content Columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left Column: Interactive Image Rendering */}
          <div className="md:col-span-3 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 min-h-[300px] relative">
            <div className="w-full max-w-[420px] aspect-[4/3] relative flex items-center justify-center">
              <DurianVectorPreview item={item} />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Giao diện minh họa mô phỏng AI Bounding Box</span>
          </div>

          {/* Right Column: Metadata & Detailed boxes table */}
          <div className="md:col-span-2 space-y-6">
            {/* System Specs */}
            <div className="space-y-3 bg-gray-50/50 dark:bg-gray-950/40 p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
              <h4 className="text-xs font-bold text-gray-505 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-brand-500" />
                Thông số hệ thống
              </h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <span className="text-gray-500 block">Nguồn Camera:</span>
                  <strong className="text-gray-900 dark:text-white">{item.cameraName}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Kích thước ảnh:</span>
                  <strong className="text-gray-900 dark:text-white">{item.imageWidth}x{item.imageHeight} px</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Thiết bị biên:</span>
                  <strong className="text-gray-900 dark:text-white">{item.device}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Định dạng Model:</span>
                  <strong className="text-gray-900 dark:text-white">{item.model_format}</strong>
                </div>
              </div>
            </div>

            {/* Box Details list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-505 dark:text-gray-400 uppercase tracking-wider">
                Danh sách phát hiện ({item.detections.length})
              </h4>
              <div className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/20 dark:bg-gray-950/20">
                {item.detections.map((det, index) => (
                  <div key={index} className="p-3 flex items-center justify-between text-xs hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full inline-block" 
                        style={{ backgroundColor: CLASS_COLORS[det.class_name] || '#fff' }}
                      />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">{det.class_name}</span>
                        <span className="text-gray-500 dark:text-gray-400 block">Track ID: #{det.track_id || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-brand-400">{(det.confidence * 100).toFixed(1)}%</span>
                      <span className="text-gray-500 dark:text-gray-500 block">[{det.x1}, {det.y1}, {det.x2}, {det.y2}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
