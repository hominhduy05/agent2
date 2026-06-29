import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className = '',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-950/20 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <span className="text-xs text-gray-500">
        Hiển thị dòng <strong className="text-gray-900 dark:text-white">{startItem}</strong> đến{' '}
        <strong className="text-gray-900 dark:text-white">{endItem}</strong> trong tổng số{' '}
        <strong className="text-gray-900 dark:text-white">{totalItems}</strong> kết quả
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="!py-1.5 !px-2.5"
          startIcon={<ChevronLeft className="h-4 w-4" />}
        >
          Trước
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNo) => (
          <button
            key={pageNo}
            onClick={() => onPageChange(pageNo)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
              currentPage === pageNo
                ? 'bg-brand-500 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {pageNo}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="!py-1.5 !px-2.5"
          endIcon={<ChevronRight className="h-4 w-4" />}
        >
          Sau
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
