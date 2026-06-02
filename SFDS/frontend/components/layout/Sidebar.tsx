import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/context/SidebarContext";
import {
  UserCircleIcon,
  FolderIcon,
} from "@/icons/index";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

const navItems: NavItem[] = [
  {
    icon: <UserCircleIcon />,
    name: "SCADA",
    path: "/scada",
  },
  {
    icon: <FolderIcon />,
    name: "Dataset",
    path: "/dataset",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const isActive = useCallback(
    (path: string) => {
      return pathname.startsWith(path);
    },
    [pathname]
  );

  const showExpanded = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0
        transition-all duration-300 ease-in-out z-50
        ${showExpanded ? "w-[280px]" : isHovered ? "w-[280px]" : "w-[80px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
      }}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle ambient glow at top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.15), transparent)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link href="/scada">
          {showExpanded ? (
            <div className="flex items-center gap-2.5">
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, var(--accent) 0%, #15803d 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#07090a",
                boxShadow: "0 0 16px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.4)",
                fontWeight: 700, fontSize: 16,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" fill="currentColor"/>
                  <path d="M21 9H15V22H9V9H3L12 2L21 9Z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", letterSpacing: "-0.01em", fontFamily: "Outfit, sans-serif" }}>DurianPro</span>
                <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 500, lineHeight: 1, marginTop: 2, opacity: 0.7 }}>Smart Agriculture</p>
              </div>
            </div>
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent) 0%, #15803d 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#07090a",
              boxShadow: "0 0 16px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.4)",
              fontWeight: 700, fontSize: 16,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" fill="currentColor"/>
                <path d="M21 9H15V22H9V9H3L12 2L21 9Z" fill="currentColor"/>
              </svg>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1">
              {navItems.map((nav) => (
                <li key={nav.name}>
                  <Link
                    href={nav.path!}
                    className={`menu-item group ${
                      isActive(nav.path!) ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span
                      className={
                        isActive(nav.path!)
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                      }
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{nav.name}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        {showExpanded ? <SidebarWidget /> : null}
      </div>

      {/* Version tag */}
      {showExpanded && (
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center", letterSpacing: "0.05em" }}>
            DurianPro v1.0 · YOLOv8
          </p>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
