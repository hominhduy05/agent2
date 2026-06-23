"use client";

import { useSidebar } from "@/components/context/SidebarContext";
import AppHeader from "@/components/layout/Header";
import AppSidebar from "@/components/layout/Sidebar";
import Backdrop from "@/components/layout/Backdrop";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();
  const isRealtimeView = pathname.startsWith("/scada") || pathname.startsWith("/detect");

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[280px]"
    : "lg:ml-[80px]";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
        style={{ background: "var(--bg)" }}
      >
        <AppHeader />
        <div style={{
          padding: isRealtimeView ? "8px 12px" : "20px 24px",
          maxWidth: isRealtimeView ? "none" : "1440px",
          margin: "0 auto",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
