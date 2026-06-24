'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/context/SidebarContext';
import { UserCircleIcon, FolderIcon, AnalyserIcon, AlertIcon, DetectIcon, CameraManagerIcon } from '@/icons/index';
import SidebarWidget from './SidebarWidget';
import { SIDEBAR_BY_ROLE, SidebarItem } from '@/lib/sidebar-config';

// type NavItem = {
//   name: string;
//   icon: React.ReactNode;
//   path?: string;
//   subItems?: { name: string; path: string }[];
// };


const AppSidebar: React.FC = () => {
  const {
  isExpanded,
  isMobileOpen,
  isHovered,
  setIsHovered,
  setIsMobileOpen,
} = useSidebar();
const sidebarRef = useRef<HTMLElement>(null);

const [navItems, setNavItems] =
  useState<SidebarItem[]>([]);

  const [user, setUser] =
  useState<any>(null);

useEffect(() => {
  fetch('/api/me')
    .then(r => r.json())
    .then(user => {
      setUser(user);

      switch (user.role) {
        case 'ADMIN':
          setNavItems(
            SIDEBAR_BY_ROLE.ADMIN
          );
          break;
        case 'OWNER':
          setNavItems(
            SIDEBAR_BY_ROLE.OWNER
          );
          break;

        case 'MANAGER':
          setNavItems(
            SIDEBAR_BY_ROLE.MANAGER
          );
          break;

        case 'ACCOUNTANT':
          setNavItems(
            SIDEBAR_BY_ROLE.ACCOUNTANT
          );
          break;

        default:
          setNavItems(
            SIDEBAR_BY_ROLE.EMPLOYEE
          );
      }
    });
}, []);


const [openDropdown, setOpenDropdown] = useState<string | null>(null);
const toggleDropdown = (name: string) => {
  setOpenDropdown((prev) => (prev === name ? null : name));
};

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      sidebarRef.current &&
      !sidebarRef.current.contains(event.target as Node)
    ) {
      setIsHovered(false);
      setIsMobileOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [setIsHovered, setIsMobileOpen]);

const handleCloseSidebar = () => {
  setIsHovered(false);
  setIsMobileOpen(false);
};
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
    ref={sidebarRef}
      className={`fixed top-0 left-0 h-screen mt-16 flex flex-col lg:mt-0 px-5
        transition-all duration-300 ease-in-out z-50
        ${showExpanded ? 'w-[280px]' : isHovered ? 'w-[280px]' : 'w-[80px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle ambient glow at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background:
            'linear-gradient(90deg, transparent, rgba(74,222,128,0.15), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div
        className={`py-8 flex ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}
      >
        <Link href="/scada">
          {showExpanded ? (
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background:
                    'linear-gradient(135deg, var(--accent) 0%, #15803d 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#07090a',
                  boxShadow:
                    '0 0 16px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.4)',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z"
                    fill="currentColor"
                  />
                  <path d="M21 9H15V22H9V9H3L12 2L21 9Z" fill="currentColor" />
                </svg>
              </div>
              <div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    color: 'var(--text)',
                    letterSpacing: '-0.01em',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  DurianPro
                </span>
                <p
                  style={{
                    fontSize: 10,
                    color: 'var(--accent)',
                    fontWeight: 500,
                    lineHeight: 1,
                    marginTop: 2,
                    opacity: 0.7,
                  }}
                >
                  Smart Agriculture
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  'linear-gradient(135deg, var(--accent) 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#07090a',
                boxShadow:
                  '0 0 16px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.4)',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z"
                  fill="currentColor"
                />
                <path d="M21 9H15V22H9V9H3L12 2L21 9Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-col flex-1 overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-5">
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1">
              {navItems.map((nav) => {
  const hasSub = !!nav.subItems;
  const isOpen = openDropdown === nav.name;

  return (
    <li key={nav.name}>
      <div>
        <Link
          href={nav.path || '#'}
          onClick={(e) => {
  if (hasSub) {
    e.preventDefault();
    toggleDropdown(nav.name);
    return;
  }

  handleCloseSidebar();
}}
          className={`menu-item group ${
            isActive(nav.path!) ? 'menu-item-active' : 'menu-item-inactive'
          }`}
        >
          <span
            className={
              isActive(nav.path!)
                ? 'menu-item-icon-active'
                : 'menu-item-icon-inactive'
            }
          >
            {nav.icon}
          </span>

          {(isExpanded || isHovered || isMobileOpen) && (
            <>
              <span className="menu-item-text">{nav.name}</span>

              {hasSub && (
                <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              )}
            </>
          )}
        </Link>

        {/* Dropdown */}
        {hasSub && isOpen && (isExpanded || isHovered || isMobileOpen) && (
          <ul className="ml-8 mt-1 flex flex-col gap-1">
            {nav.subItems!.map((sub) => (
              <li key={sub.name}>
                <Link
                  href={sub.path}
                  onClick={handleCloseSidebar}
                  className={`text-sm px-3 py-2 rounded-md block transition
                    ${
                      pathname.startsWith(sub.path)
  ? 'text-blue-500 font-semibold'
  : 'text-slate-500 hover:text-blue-400 transition-colors'
                    }`}
                >
                  {sub.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
})}
            </ul>
          </div>
        </nav>

        <div className="mt-auto mb-6">
          {showExpanded ? <SidebarWidget /> : null}
        </div>
      </div>

      {/* Version tag */}
      {showExpanded && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: 'var(--text-faint)',
              textAlign: 'center',
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            DurianPro v1.0 · YOLOv8
          </p>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
