"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MessageSquare, Moon, Plus, Sun, Trash2 } from "lucide-react";

export function ChatSidebar({
  currentChatId,
  sessions,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  isOpen = true,
}: {
  currentChatId: string | null;
  sessions: { id: string; title: string; updatedAt?: string }[];
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isOpen?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hoverDelete, setHoverDelete] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString("vi-VN", { month: "short", day: "numeric" });
  };

  return (
    <aside className={`cs-sidebar${isOpen ? "" : " collapsed"}`}>
      <div className="cs-header">
        <Link href="/" className="cs-brand">Vision Assistant</Link>
        <button className="cs-icon-btn" onClick={onNewChat} title="New chat">
          <Plus size={15} />
        </button>
      </div>

      <div className="cs-login-note">
        Local sessions are saved in this browser.
      </div>

      <nav className="cs-nav">
        {sessions.length === 0 ? (
          <div className="cs-empty">Your conversations will appear here once you start chatting.</div>
        ) : (
          <>
            <div className="cs-section-label">Today</div>
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`cs-item${currentChatId === s.id ? " active" : ""}`}
                onMouseEnter={() => setHoverDelete(s.id)}
                onMouseLeave={() => setHoverDelete(null)}
              >
                <button
                  className="cs-item-btn"
                  onClick={() => onSelectChat(s.id)}
                >
                  <MessageSquare size={14} />
                  <span className="cs-item-label">{s.title || "New conversation"}</span>
                  <span className="cs-item-time">{formatTime(s.updatedAt)}</span>
                </button>
                {(hoverDelete === s.id || currentChatId === s.id) && (
                  <button
                    className="cs-delete-btn"
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(s.id); }}
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="cs-footer">
        {mounted && (
          <button
            className="cs-theme-btn"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
