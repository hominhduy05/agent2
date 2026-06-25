import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, History, BarChart3,
  Settings, LogOut, ChevronLeft, Menu, AlertTriangle, Receipt,
} from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthProvider";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/dashboard",           label: "Tổng quan",          icon: LayoutDashboard },
  { href: "/dashboard/history",   label: "Lịch sử kiểm tra", icon: History },
  { href: "/dashboard/employees", label: "Nhân viên",          icon: Users },
  { href: "/dashboard/reports",   label: "Báo cáo",           icon: BarChart3 },
  { href: "/dashboard/accounting",label: "Kế toán",            icon: Receipt },
  { href: "/dashboard/settings",   label: "Cài đặt KPI",       icon: Settings },
];

const SCADA_NAV = [
  { href: "/scada",               label: "SCADA Dashboard", icon: LayoutDashboard },
  { href: "/scada/alarms",        label: "Alarms",          icon: AlertTriangle },
  { href: "/scada/settings",      label: "Cài đặt",         icon: Settings },
];

const MES_NAV = [
  { href: "/mes",                 label: "MES Dashboard",  icon: BarChart3 },
  { href: "/mes/oee",            label: "OEE",            icon: BarChart3 },
  { href: "/mes/quality",        label: "Chất lượng",      icon: BarChart3 },
  { href: "/mes/shifts",         label: "Ca sản xuất",    icon: BarChart3 },
  { href: "/mes/traceability",   label: "Truy xuất",      icon: BarChart3 },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
  }

  const initials = user?.full_name
    ? user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      {/* Header */}
      <div className={styles.header}>
        {!collapsed && (
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <AlertTriangle size={16} strokeWidth={2.5} />
            </div>
            <span className={styles.logoText}>DurianPro</span>
          </div>
        )}
        <button
          className={styles.toggleBtn}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.filter(({ href }) => {
          if (!user) return false;
          const role = user.role;
          if (role === "owner" || role === "admin") return true;
          if (role === "manager") return true;
          if (role === "accountant") {
            return href !== "/dashboard/employees" && href !== "/dashboard/settings";
          }
          if (role === "inspector") {
            return href !== "/dashboard/employees" && href !== "/dashboard/reports" && href !== "/dashboard/settings" && href !== "/dashboard/accounting";
          }
          return true;
        }).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              to={href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* SCADA section */}
        {(!collapsed && SCADA_NAV.some(({ href }) => {
          if (!user) return false;
          const role = user.role;
          if (role === "owner" || role === "admin" || role === "manager" || role === "inspector") return true;
          if (role === "accountant") return false;
          return true;
        })) && <div className={styles.sectionLabel}>SCADA — Level 2</div>}
        {SCADA_NAV.filter(({ href }) => {
          if (!user) return false;
          const role = user.role;
          if (role === "owner" || role === "admin" || role === "manager" || role === "inspector") return true;
          if (role === "accountant") return false;
          return true;
        }).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/scada" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              to={href}
              className={`${styles.navItem} ${active ? styles.active : ""} ${styles.level2}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* MES section */}
        {(!collapsed && MES_NAV.some(({ href }) => {
          if (!user) return false;
          const role = user.role;
          if (role === "owner" || role === "admin" || role === "manager" || role === "accountant") return true;
          if (role === "inspector") return false;
          return true;
        })) && <div className={styles.sectionLabel}>MES — Level 3</div>}
        {MES_NAV.filter(({ href }) => {
          if (!user) return false;
          const role = user.role;
          if (role === "owner" || role === "admin" || role === "manager" || role === "accountant") return true;
          if (role === "inspector") return false;
          return true;
        }).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/mes" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              to={href}
              className={`${styles.navItem} ${active ? styles.active : ""} ${styles.level3}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className={styles.userSection}>
          {!collapsed ? (
            <div className={styles.userInfo}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{user.full_name}</span>
                <span className={styles.userRole}>
                  {user.role === "owner" ? "Owner (bên mình)" :
                   user.role === "admin" ? "Admin (bên họ)" :
                   user.role === "manager" ? "Quản lý" :
                   user.role === "accountant" ? "Kế toán" :
                   "Nhân viên"}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.avatarCollapsed}>{initials}</div>
          )}
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut size={16} strokeWidth={2} />
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
