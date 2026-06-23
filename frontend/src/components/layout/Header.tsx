"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/components/dashboard/AuthProvider";
import { Dropdown } from "@/components/ui/Dropdown";
import { ThemeToggleButton } from "@/components/common/ThemeToggle";
import { BellIcon } from "@/icons/index";
import styles from "./Header.module.css";

const AppHeader: React.FC = () => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Left: Toggle + Search */}
        <div className={styles.left}>
          <button
            className={styles.toggleBtn}
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <div className={styles.searchWrap}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z" fill="currentColor" />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Tìm kiếm dữ liệu, báo cáo..."
                className={styles.searchInput}
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className={styles.right}>
          <div className={styles.rightActions}>
            <ThemeToggleButton />

            {/* Notification */}
            <div className={styles.notifWrap}>
              <button
                className={styles.iconBtn}
                onClick={() => { setIsNotifOpen(!isNotifOpen); setIsUserOpen(false); }}
                aria-label="Thông báo"
              >
                <span className={styles.notifDot} />
                <BellIcon />
              </button>
              <Dropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                style={{ right: 0, marginTop: 16, width: 320 }}
              >
                <div className={styles.dropdownHeader}>
                  <h5 className={styles.dropdownTitle}>Thông báo</h5>
                  <span className={styles.dropdownAction}>Đánh dấu đã đọc</span>
                </div>
                <p className={styles.dropdownEmpty}>Chưa có thông báo nào</p>
              </Dropdown>
            </div>
          </div>

          {/* User dropdown */}
          <div className={styles.userWrap}>
            <button
              className={styles.userBtn}
              onClick={(e) => { e.stopPropagation(); setIsUserOpen(!isUserOpen); setIsNotifOpen(false); }}
            >
              <span className={styles.userAvatar}>
                {user?.full_name?.charAt(0).toUpperCase() ?? "U"}
              </span>
              <span className={styles.userName}>{user?.full_name ?? "Người dùng"}</span>
              <svg className={`${styles.chevron} ${isUserOpen ? styles.chevronOpen : ""}`} width="18" height="20" viewBox="0 0 18 20" fill="none">
                <path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <Dropdown
              isOpen={isUserOpen}
              onClose={() => setIsUserOpen(false)}
              style={{ right: 0, marginTop: 12, width: 220 }}
            >
              <div className={styles.userInfo}>
                <span className={styles.userInfoName}>{user?.full_name ?? "Người dùng"}</span>
                <span className={styles.userInfoRole}>{user?.role ?? "admin"}</span>
              </div>
              <div className={styles.dropdownDivider} />
              <button
                className={styles.logoutBtn}
                onClick={() => { logout(); setIsUserOpen(false); }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Đăng xuất
              </button>
            </Dropdown>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
