import React from 'react';
import { CLASS_COLORS, DetectionHistoryItem } from '../types';

interface DurianVectorPreviewProps {
  item: DetectionHistoryItem;
  className?: string;
}

export const DurianVectorPreview: React.FC<DurianVectorPreviewProps> = ({ 
  item, 
  className = '' 
}) => {
  return (
    <div className={`w-full h-full relative flex items-center justify-center ${className}`}>
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
        {item.detections.map((det, index) => {
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
  );
};
