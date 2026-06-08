"use client";

import { memo } from "react";
import { Check, ChevronDown, Copy, Sparkles } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    b64: string;
  }[];
}

interface Props {
  messages: ChatMessageData[];
  streamingContent: string | null;
  isLoading: boolean;
  onSuggestion: (text: string) => void;
  onScrollToBottom: () => void;
  isAtBottom: boolean;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function PureChatMessages({
  messages,
  streamingContent,
  isLoading,
  onSuggestion,
  onScrollToBottom,
  isAtBottom,
  onCopy,
  copiedId,
}: Props) {
  const isEmpty = messages.length === 0 && streamingContent === null;

  return (
    <div className="cm-wrapper">
      {isEmpty ? (
        <div className="cm-greeting">
          <div className="cm-greeting-kicker">Hello there!</div>
          <h2 className="cm-greeting-title">How can I help you today?</h2>
        </div>
      ) : (
        <div className="cm-list">
          {messages.map((msg) => (
            <div key={msg.id} className={`cm-msg cm-msg--${msg.role}`}>
              {msg.role === "assistant" ? (
                <>
                  <div className="cm-avatar cm-avatar--bot"><Sparkles size={14} /></div>
                  <div className="cm-content">
                    <div className="cm-bubble cm-bubble--assistant">
                      <MarkdownContent content={msg.content} />
                    </div>
                    <div className="cm-actions">
                      <button
                        className={`cm-action-btn${copiedId === msg.id ? " copied" : ""}`}
                        onClick={() => onCopy(msg.content, msg.id)}
                        title="Copy"
                      >
                        {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="cm-content cm-content--user">
                  {msg.attachments?.length ? (
                    <div className="cm-attachments">
                      {msg.attachments.map((attachment) => (
                        <img
                          key={attachment.id}
                          className="cm-image-attachment"
                          src={attachment.url}
                          alt={attachment.name}
                        />
                      ))}
                    </div>
                  ) : null}
                  {msg.content ? (
                    <div className="cm-bubble cm-bubble--user">{msg.content}</div>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {streamingContent !== null && (
            <div className="cm-msg cm-msg--assistant">
              <div className="cm-avatar cm-avatar--bot"><Sparkles size={14} /></div>
              <div className="cm-content">
                <div className={`cm-bubble cm-bubble--assistant${streamingContent === "" ? " cm-thinking" : " cm-streaming"}`}>
                  {streamingContent === "" ? (
                    <span className="cm-dots">
                      <span /><span /><span />
                    </span>
                  ) : <MarkdownContent content={streamingContent} />}
                </div>
              </div>
            </div>
          )}

          {isLoading && streamingContent === null && (
            <div className="cm-msg cm-msg--assistant">
              <div className="cm-avatar cm-avatar--bot"><Sparkles size={14} /></div>
              <div className="cm-content">
                <div className="cm-bubble cm-bubble--assistant cm-thinking">
                  <span className="cm-dots"><span /><span /><span /></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isAtBottom && messages.length > 0 && (
        <button className="cm-scroll-btn" onClick={onScrollToBottom} title="Scroll to bottom">
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}

export const ChatMessages = memo(PureChatMessages);
