"use client";

import { useSidebar } from "@/components/context/SidebarContext";
import AppHeader from "@/components/layout/Header";
import AppSidebar from "@/components/layout/Sidebar";
import Backdrop from "@/components/layout/Backdrop";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[280px]"
    : "lg:ml-[80px]";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar: forest dark */}
      <AppSidebar />
      <Backdrop />
      {/* Content area: adapts to light/dark theme */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
        style={{ background: "var(--bg)" }}
      >
        <AppHeader />
        <div style={{
          padding: "20px 24px",
          maxWidth: "1440px",
          margin: "0 auto",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
