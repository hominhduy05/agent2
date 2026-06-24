import { useSidebar } from "@/components/context/SidebarContext";
import React from "react";

const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  if (!isMobileOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(7, 9, 10, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      className="lg:hidden"
      onClick={toggleMobileSidebar}
    />
  );
};

export default Backdrop;
