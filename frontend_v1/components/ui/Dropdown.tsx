'use client';
import type React from 'react';
import { useEffect, useRef } from 'react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  style,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.dropdown-toggle')
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!isOpen) return null;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 40,
    right: 0,
    marginTop: 8,
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-strong)',
    boxShadow: 'var(--shadow-lg)',
    ...style,
  };

  return (
    <div ref={dropdownRef} className={className} style={baseStyle}>
      {children}
    </div>
  );
};
