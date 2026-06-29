// lib/sidebar-role.tsx

import React from 'react';

import {
  UserCircleIcon,
  AnalyserIcon,
  AlertIcon,
  CameraManagerIcon,
  PieChartIcon,
  BellIcon,
} from '@/icons';

import { UserRole } from './auth-users';
import { HistoryIcon, Scan } from 'lucide-react';

export type SidebarItem = {
  name: string;
  path?: string;
  icon: React.ReactNode;
  subItems?: {
    name: string;
    path: string;
  }[];
};

export const SIDEBAR_BY_ROLE: Record<UserRole, SidebarItem[]> = {
  ADMIN: [
    {
      name: 'SCADA',
      icon: <PieChartIcon />,
      subItems: [
        {
          name: 'Dashboard',
          path: '/scada/dashboard',
        },
        {
          name: 'Monitoring',
          path: '/scada/monitor',
        },
      ],
    },

    {
      name: 'Detect',
      icon: <Scan />,
      path: '/detect',
    },

    {
      name: 'Dataset',
      icon: <AnalyserIcon />,
      path: '/dataset',
    },

    {
      name: 'Analytics',
      icon: <AnalyserIcon />,
      path: '/analytics',
    },

    {
      name: 'Camera Manager',
      icon: <CameraManagerIcon />,
      path: '/camera-manager',
    },

    {
      name: 'Statistics',
      icon: <PieChartIcon />,
      subItems: [
        {
          name: 'System',
          path: '/statistics/system',
        },
        {
          name: 'Fruit',
          path: '/statistics/fruits',
        },
      ],
    },

    {
      name: 'Detection History',
      icon: <HistoryIcon />,
      path: '/detection-history',
    },
  ],
  // ==========================================
  // OWNER = ADMIN HỆ THỐNG
  // ==========================================
  OWNER: [
    {
      name: 'Analytics',
      icon: <AnalyserIcon />,
      path: '/analytics',
    },

    {
      name: 'Statistics',
      icon: <PieChartIcon />,
      subItems: [
        {
          name: 'System',
          path: '/statistics/system',
        },
        {
          name: 'Fruit',
          path: '/statistics/fruits',
        },
      ],
    },

    {
      name: 'Detection History',
      icon: <AlertIcon />,
      path: '/detection-history',
    },
  ],

  // ==========================================
  // MANAGER
  // ==========================================
  MANAGER: [
    {
      name: 'SCADA',
      icon: <PieChartIcon />,
      subItems: [
        {
          name: 'Dashboard',
          path: '/scada/dashboard',
        },
        {
          name: 'Monitoring',
          path: '/scada/monitor',
        },
      ],
    },

    {
      name: 'Analytics',
      icon: <AnalyserIcon />,
      path: '/analytics',
    },

    {
      name: 'Camera Manager',
      icon: <CameraManagerIcon />,
      path: '/camera-manager',
    },

    {
      name: 'Statistics',
      icon: <PieChartIcon />,
      subItems: [
        {
          name: 'System Overview',
          path: '/statistics/system',
        },
        {
          name: 'Fruit Statistics',
          path: '/statistics/fruits',
        },
      ],
    },

    {
      name: 'Detection History',
      icon: <AlertIcon />,
      path: '/detection-history',
    },
  ],

  // ==========================================
  // ACCOUNTANT
  // ==========================================
  ACCOUNTANT: [
    {
      name: 'Dashboard',
      icon: <PieChartIcon />,
      path: '/scada/dashboard',
    },

    {
      name: 'Fruit Statistics',
      icon: <AnalyserIcon />,
      path: '/statistics/fruits',
    },

    {
      name: 'Detection History',
      icon: <AlertIcon />,
      path: '/detection-history',
    },
  ],

  // ==========================================
  // EMPLOYEE
  // ==========================================
  EMPLOYEE: [
    {
      name: 'Dashboard',
      icon: <PieChartIcon />,
      path: '/scada/dashboard',
    },

    {
      name: 'Detection History',
      icon: <AlertIcon />,
      path: '/detection-history',
    },
  ],
};
