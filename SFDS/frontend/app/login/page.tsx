"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/dashboard/AuthProvider";
import styles from "./page.module.css";
import logoImg from "@/assets/images/logo.png";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Mock API loading delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock credentials
    const accounts = [
      { username: "admin", password: "admin123", role: "admin", full_name: "Quản trị viên" },
      { username: "inspector", password: "inspector123", role: "inspector", full_name: "Giám sát viên" },
      { username: "operator", password: "operator123", role: "operator", full_name: "Nhân viên vận hành" },
    ];

    const match = accounts.find(
      (a) => a.username === username.trim() && a.password === password
    );

    if (match) {
      login("mock-jwt-token-123456", {
        id: match.username === "admin" ? 1 : match.username === "inspector" ? 2 : 3,
        username: match.username,
        full_name: match.full_name,
        role: match.role,
      });
      router.push("/scada");
    } else {
      setError("Tên đăng nhập hoặc mật khẩu không chính xác.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Brand panel (Left) */}
      <div className={styles.left}>
        <div className={styles.brand}>
          <div style={{ width: 48, height: 48, overflow: "hidden", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src={logoImg} alt="Logo" width={80} height={80} style={{ minWidth: "165%", minHeight: "165%", objectFit: "cover" }} />
          </div>
          <span className={styles.brandName} style={{ marginLeft: "10px" }}>DurianPro</span>
        </div>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Hệ Thống Phân Loại & Đảm Bảo Chất Lượng Sầu Riêng</h1>
          <p className={styles.heroSub}>
            Tiêu chuẩn hóa quy trình kiểm định chất lượng, tối ưu hóa năng suất đóng gói và đồng nhất tiêu chuẩn xuất khẩu nông sản.
          </p>
        </div>
        <ul className={styles.featureList}>
          <li className={styles.featureItem}>
            <svg className={styles.featureCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <span className={styles.featureTitle}>Phân Loại Đạt Chuẩn & Đồng Nhất</span>
              <span className={styles.featureDesc}>Hỗ trợ kiểm định chất lượng tự động, giúp đồng bộ hóa tiêu chuẩn phân cấp xuất khẩu.</span>
            </div>
          </li>
          <li className={styles.featureItem}>
            <svg className={styles.featureCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <span className={styles.featureTitle}>Báo Cáo Hiệu Suất Vận Hành</span>
              <span className={styles.featureDesc}>Cung cấp số liệu tổng quan về công suất dây chuyền, hỗ trợ đưa ra quyết định quản trị kịp thời.</span>
            </div>
          </li>
        </ul>
        <p className={styles.leftFooter}>© 2026 DurianPro. Tất cả quyền được bảo lưu.</p>
      </div>

      {/* Login Form Panel (Right) */}
      <div className={styles.right}>
        <div className={styles.formWrap}>
          <div className={styles.formHead}>
            <h2 className={styles.formTitle}>Đăng nhập</h2>
            <p className={styles.formSub}>Hệ thống quản lý sản xuất nội bộ</p>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>Tên đăng nhập</label>
              <input
                id="username"
                type="text"
                className={styles.input}
                placeholder="Nhập tên tài khoản (ví dụ: admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Mật khẩu</label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`${styles.input} ${styles.passwordInput}`}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.togglePw}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <>
                  <svg className={`${styles.spinning}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16"/>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          <p className={styles.hint}>
            Tài khoản dùng thử: <kbd>admin</kbd> / <kbd>admin123</kbd>
          </p>
        </div>
      </div>
    </div>
  );
}
