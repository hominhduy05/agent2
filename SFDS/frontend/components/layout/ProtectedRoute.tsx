"use client";

import { useAuth } from "@/components/dashboard/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !user) {
      router.push("/login");
    }
  }, [user, isHydrated, router]);

  if (!isHydrated || !user) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--text-muted)",
        fontFamily: "var(--font-outfit)",
        fontSize: "14px",
      }}>
        Đang tải...
      </div>
    );
  }

  return <>{children}</>;
}
