'use client';
import type React from 'react';
import { useEffect, useRef } from 'react';

interface DropdownItemProps {
  onItemClick?: () => void;
  children: React.ReactNode;
  className?: string;
  tag?: 'a' | 'button' | 'div';
  href?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  onItemClick,
  children,
  className = '',
  tag: Tag = 'div',
  href,
}) => {
  return (
    <Tag
      href={href}
      onClick={onItemClick}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </Tag>
  );
};
