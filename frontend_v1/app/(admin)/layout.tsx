'use client';

import { useSidebar } from '@/components/context/SidebarContext';
import AppHeader from '@/components/layout/Header';
import AppSidebar from '@/components/layout/Sidebar';
import Backdrop from '@/components/layout/Backdrop';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  const isRealtimeView =
    pathname.startsWith('/scada') || pathname.startsWith('/detect');

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'lg:ml-[280px]'
      : 'lg:ml-[80px]';

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: 'var(--bg)',
      }}
    >
      {/* SIDEBAR */}
      <AppSidebar />
      <Backdrop />

      {/* MAIN WRAPPER */}
      <div
        className={`
          flex flex-col
          flex-1
          min-w-0
          h-screen
          min-h-0
          overflow-hidden
          transition-all
          duration-300
          ease-in-out
          ${mainContentMargin}
        `}
      >
        {/* HEADER (fixed height) */}
        <div className="shrink-0 h-16">
          <AppHeader />
        </div>

        {/* MAIN SCROLL AREA */}
        <main
          className={
            isRealtimeView
              ? 'flex-1 min-h-0 overflow-y-auto p-0'
              : 'flex-1 min-h-0 overflow-y-auto p-[20px_24px]'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}