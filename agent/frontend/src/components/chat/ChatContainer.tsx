"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Globe,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { streamAgentMessage, streamDirectChatMessage } from "@/lib/api";

interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  b64: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
}

interface Session {
  id: string;
  title: string;
  updatedAt?: string;
}

interface StoredChatState {
  sessions: Session[];
  messagesBySession: Record<string, Message[]>;
  activeSessionId?: string;
}

const SUGGESTIONS = [
  "What is the current SFDS status?",
  "Diagnose a camera issue",
  "How do I troubleshoot detection errors?",
  "Generate an operations report",
];

const DEFAULT_MODEL = "nvidia/nemotron-3-nano-4b";
const CHAT_STORAGE_KEY = "vision-assistant-chat-state-v1";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function createLocalSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

function makeSessionTitle(text: string) {
  return text.slice(0, 40) + (text.length > 40 ? "..." : "");
}

function readImageAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.onload = () => {
      const url = String(reader.result || "");
      const [, b64 = ""] = url.split(",", 2);
      resolve({
        id: `${Date.now()}-${file.name || "image"}`,
        name: file.name || "pasted-image.png",
        type: file.type || "image/png",
        size: file.size,
        url,
        b64,
      });
    };
    reader.readAsDataURL(file);
  });
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [visDropOpen, setVisDropOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const models = [{ id: DEFAULT_MODEL, label: DEFAULT_MODEL }];
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const visDropRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) {
        setHasHydrated(true);
        return;
      }

      const stored = JSON.parse(raw) as Partial<StoredChatState>;
      const storedSessions = Array.isArray(stored.sessions) ? stored.sessions : [];
      const storedMessages = stored.messagesBySession && typeof stored.messagesBySession === "object"
        ? stored.messagesBySession
        : {};
      const activeId = stored.activeSessionId && storedMessages[stored.activeSessionId]
        ? stored.activeSessionId
        : storedSessions[0]?.id;

      setSessions(storedSessions);
      setMessagesBySession(storedMessages);
      setSessionId(activeId);
      setMessages(activeId ? storedMessages[activeId] || [] : []);
    } catch {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const state: StoredChatState = {
      sessions,
      messagesBySession,
      activeSessionId: sessionId,
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  }, [hasHydrated, messagesBySession, sessionId, sessions]);

  useEffect(() => {
    if (streamingContent !== null || messages.length > 0) {
      scrollToBottom("instant");
    }
  }, [streamingContent, messages, scrollToBottom]);

  useEffect(() => {
    const wrap = messagesWrapRef.current;
    if (!wrap) return;
    const onScroll = () => {
      const dist = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
      setIsAtBottom(dist < 80);
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });
    return () => wrap.removeEventListener("scroll", onScroll);
  }, []);

  // Close visibility dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (visDropRef.current && !visDropRef.current.contains(e.target as Node)) {
        setVisDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleFileAttach = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image attachments are supported in chat right now.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Image is too large. Please choose an image under 10 MB.");
      return;
    }

    try {
      setAttachment(await readImageAttachment(file));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the selected image");
    }
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmedText = text.trim();
    if ((!trimmedText && !attachment) || isLoading) return;
    setInput("");
    setError(null);

    const activeSessionId = sessionId || createLocalSessionId();
    const timestamp = new Date().toISOString();
    const outgoingAttachment = attachment;
    const outgoingText = trimmedText || (outgoingAttachment ? "Analyze this image." : "");
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: outgoingText,
      timestamp,
      attachments: outgoingAttachment ? [outgoingAttachment] : undefined,
    };
    const nextMessages = [...(messagesBySession[activeSessionId] || messages), userMsg];

    setAttachment(null);
    setSessionId(activeSessionId);
    setMessages(nextMessages);
    setMessagesBySession((prev) => ({ ...prev, [activeSessionId]: nextMessages }));
    setSessions((prev) => {
      if (prev.find((s) => s.id === activeSessionId)) {
        return prev.map((s) => s.id === activeSessionId ? { ...s, updatedAt: timestamp } : s);
      }
      return [{ id: activeSessionId, title: makeSessionTitle(outgoingText), updatedAt: timestamp }, ...prev];
    });
    setIsLoading(true);
    setStreamingContent("");

    let fullContent = "";
    const stop = outgoingAttachment
      ? streamAgentMessage(
        outgoingText,
        activeSessionId,
        outgoingAttachment.url,
        undefined,
        (token) => {
          fullContent += token;
          setStreamingContent((prev) => (prev ?? "") + token);
        },
        (err) => {
          setError(err);
          setIsLoading(false);
          setStreamingContent(null);
        },
        (content, sid) => {
          setStreamingContent(null);
          setIsLoading(false);
          setSessionId(sid);
          const doneAt = new Date().toISOString();
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content,
            timestamp: doneAt,
          };
          const completedMessages = [...nextMessages, assistantMsg];

          setMessages(completedMessages);
          setMessagesBySession((prev) => {
            const updated = { ...prev, [sid]: completedMessages };
            if (sid !== activeSessionId) delete updated[activeSessionId];
            return updated;
          });
          setSessions((prev) => {
            if (prev.find((s) => s.id === sid)) {
              return prev.map((s) => s.id === sid ? { ...s, updatedAt: doneAt } : s);
            }
            return prev.map((s) => s.id === activeSessionId ? { ...s, id: sid, updatedAt: doneAt } : s);
          });
        }
      )
      : streamDirectChatMessage(
      outgoingText,
      activeSessionId,
      undefined,
      (token) => {
        fullContent += token;
        setStreamingContent((prev) => (prev ?? "") + token);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
        setStreamingContent(null);
      },
      (content, sid) => {
        setStreamingContent(null);
        setIsLoading(false);
        setSessionId(sid);
        const doneAt = new Date().toISOString();
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content,
          timestamp: doneAt,
        };
        const completedMessages = [...nextMessages, assistantMsg];

        setMessages(completedMessages);
        setMessagesBySession((prev) => {
          const updated = { ...prev, [sid]: completedMessages };
          if (sid !== activeSessionId) delete updated[activeSessionId];
          return updated;
        });
        setSessions((prev) => {
          if (prev.find((s) => s.id === sid)) {
            return prev.map((s) => s.id === sid ? { ...s, updatedAt: doneAt } : s);
          }
          return prev.map((s) => s.id === activeSessionId ? { ...s, id: sid, updatedAt: doneAt } : s);
        });
      }
    );

    stopStreamRef.current = stop;
  }, [attachment, isLoading, messages, messagesBySession, sessionId]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleStop = () => {
    stopStreamRef.current?.();
    setIsLoading(false);
    setStreamingContent(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setInput("");
    setStreamingContent(null);
    setIsLoading(false);
    setAttachment(null);
  };

  const handleSelectChat = (id: string) => {
    setSessionId(id);
    setMessages(messagesBySession[id] || []);
    setError(null);
    setInput("");
    setStreamingContent(null);
    setIsLoading(false);
    setAttachment(null);
  };

  const handleDeleteChat = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessagesBySession((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (sessionId === id) handleNewChat();
  };

  const isEmpty = messages.length === 0 && streamingContent === null;

  return (
    <div className="ca-app">
      <ChatSidebar
        currentChatId={sessionId ?? null}
        sessions={sessions}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        isOpen={sidebarOpen}
      />

      <div className="ca-main">
        <header className="ca-header">
          <div className="ca-header-left">
            <button
              className="ca-header-icon"
              onClick={() => setSidebarOpen((open) => !open)}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            {!sidebarOpen && (
              <button className="ca-header-new" onClick={handleNewChat}>
                <Plus size={15} />
                New chat
              </button>
            )}

            <div className="ca-header-title">
              {sessionId ? `Session ${sessionId.slice(0, 8)}` : "Vision Assistant"}
            </div>
          </div>

          <div className="ca-header-actions">
            <div className="ca-vis-wrap" ref={visDropRef}>
              <button
                className={`ca-vis-btn ca-vis-btn--${visibility}`}
                onClick={() => setVisDropOpen((v) => !v)}
                title="Visibility"
              >
                {visibility === "private" ? <Lock size={14} /> : <Globe size={14} />}
                <span>{visibility === "private" ? "Private" : "Public"}</span>
                <ChevronDown size={12} />
              </button>
              {visDropOpen && (
                <div className="ca-vis-dropdown">
                  <button
                    className={`ca-vis-option${visibility === "private" ? " active" : ""}`}
                    onClick={() => { setVisibility("private"); setVisDropOpen(false); }}
                  >
                    <Lock size={15} />
                    <div>
                      <div className="ca-vis-option-title">Private</div>
                      <div className="ca-vis-option-desc">Saved only for this local session</div>
                    </div>
                  </button>
                  <button
                    className={`ca-vis-option${visibility === "public" ? " active" : ""}`}
                    onClick={() => { setVisibility("public"); setVisDropOpen(false); }}
                  >
                    <Globe size={15} />
                    <div>
                      <div className="ca-vis-option-title">Public</div>
                      <div className="ca-vis-option-desc">Shareable inside your operations room</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div className="ca-error-banner">
            {error}
            <button onClick={() => setError(null)} className="ca-error-close" title="Dismiss error">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="ca-messages-wrap" ref={messagesWrapRef}>
          <div className="ca-messages-inner">
            <ChatMessages
              messages={messages}
              streamingContent={streamingContent}
              isLoading={isLoading}
              onSuggestion={sendMessage}
              onScrollToBottom={() => scrollToBottom()}
              isAtBottom={isAtBottom}
              onCopy={handleCopy}
              copiedId={copiedId}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>

        {isEmpty && (
          <div className="ca-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="ca-suggestion-card" onClick={() => sendMessage(s)}>
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}

        <ChatInput
          input={input}
          onInput={setInput}
          onSubmit={handleSend}
          onStop={handleStop}
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          models={models}
          attachment={attachment}
          onFileAttach={handleFileAttach}
          onRemoveAttachment={() => setAttachment(null)}
        />
      </div>
    </div>
  );
}
