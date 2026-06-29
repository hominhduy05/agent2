'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useSidebar } from '@/components/context/SidebarContext';
import { ThemeToggleButton } from '@/components/common/ThemeToggle';

import styles from './Header.module.css';

export default function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [open, setOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const ref = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error();
        }

        return res.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  const avatar = user?.name?.charAt(0)?.toUpperCase() || 'U';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) return;

    console.log('Search:', debouncedQuery);
  }, [debouncedQuery]);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const handleToggle = useCallback(() => {
    if (isDesktop) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  }, [isDesktop, toggleSidebar, toggleMobileSidebar]);

  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setOpen(false);

    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });

      router.replace('/login');

      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);

      window.location.href = '/api/logout';
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <button
            className={styles.toggleBtn}
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

          <div className={styles.searchWrap}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <ThemeToggleButton />

          <div className={styles.profile} ref={ref}>
            <button className={styles.trigger} onClick={() => setOpen(!open)}>
              <span className={styles.avatar}>{avatar}</span>

              <div className={styles.info}>
                <span className={styles.name}>{user?.name || 'Guest'}</span>

                <span className={styles.sub}>{user?.email || ''}</span>
              </div>

              <span className={styles.arrow}>▾</span>
            </button>

            {open && (
              <div className={styles.menu}>
                <div className={styles.section}>
                  <button className={styles.item}>Profile</button>

                  <button className={styles.item}>Settings</button>
                </div>

                <div className={styles.divider} />

                {/* JS */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`${styles.item} ${styles.danger}`}
                >
                  Log out
                </button>

                {/* No JS */}
                <noscript>
                  <form action="/api/logout" method="POST">
                    <button
                      type="submit"
                      className={`${styles.item} ${styles.danger}`}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      Log out
                    </button>
                  </form>
                </noscript>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
