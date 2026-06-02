"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, AlertCircle, Bot, User, WifiOff } from "lucide-react";
import { streamDirectChatMessage } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const HINTS = [
  "Check backend and SFDS health",
  "Diagnose a camera feed issue",
  "Prepare an incident report outline",
  "Explain why LM Studio might be offline",
];

export default function ChatAssistant() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleSend = (text?: string) => {
    const userMsg = text || message.trim();
    if (!userMsg || loading) return;

    setMessage("");
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMsg, timestamp: new Date().toISOString() },
    ];
    setMessages(newMessages);
    setLoading(true);
    setError(null);
    setStreamingContent("");

    let fullContent = "";

    const cleanup = streamDirectChatMessage(
      userMsg,
      sessionId,
      undefined,
      (token) => {
        fullContent += token;
        setStreamingContent((prev) => (prev ?? "") + token);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      (content, sid) => {
        setStreamingContent(null);
        setLoading(false);
        setSessionId(sid);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content, timestamp: new Date().toISOString() },
        ]);
      }
    );

    return cleanup;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <Bot size={18} style={{ color: "var(--accent)" }} />
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)" }}>
            Operations Assistant
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            Troubleshooting and inspection support
          </div>
        </div>
        <div className="chat-agent-badge" style={{ marginLeft: "auto" }}>
          <span className="dot" />
          {loading ? "Streaming" : "Ready"}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !streamingContent && (
          <div className="chat-empty">
            <MessageSquare size={44} className="chat-empty-icon" />
            <div className="chat-empty-title">Start a conversation</div>
            <p className="chat-empty-desc">
              Ask about system operation, troubleshooting, inspection results, or report preparation.
            </p>
            <div className="chat-hints">
              {HINTS.map((h) => (
                <button key={h} className="chat-hint-btn" onClick={() => handleSend(h)}>
                  <Send size={12} />
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble-wrap ${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
            <div className="chat-meta">
              {m.role === "user" ? <User size={10} /> : <Bot size={10} />}
              <span style={{ marginLeft: 4 }}>{formatTime(m.timestamp)}</span>
            </div>
          </div>
        ))}

        {/* Streaming */}
        {streamingContent !== null && (
          <div className="chat-bubble-wrap assistant">
            <div className={`chat-bubble${streamingContent === "" ? "" : " streaming-cursor"}`}>
              {streamingContent}
            </div>
            <div className="chat-meta">
              <Bot size={10} />
              <span style={{ marginLeft: 4 }}>streaming...</span>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && streamingContent === null && (
          <div className="chat-bubble-wrap assistant">
            <div className="chat-bubble">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="spinner spinner-sm" />
                <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
                  Routing to agent...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="chat-bubble-wrap assistant">
            <div className="error-alert" style={{ maxWidth: 400 }}>
              <WifiOff size={16} />
              <div>
                <div className="error-alert-title">Connection error</div>
                <div className="error-alert-msg">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about operation, inspection, or troubleshooting..."
          disabled={loading}
          rows={1}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleSend()}
          disabled={loading || !message.trim()}
          style={{ height: 44, padding: "0 var(--sp-4)", flexShrink: 0 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
