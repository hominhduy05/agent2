import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/dashboard/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";

interface ProtectedAdminLayoutProps {
  children: React.ReactNode;
  wrapWebcamStats?: boolean;
}

export default function ProtectedAdminLayout({
  children,
  wrapWebcamStats = false,
}: ProtectedAdminLayoutProps) {
  const { user, isLoading, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated || isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Đang tải...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
