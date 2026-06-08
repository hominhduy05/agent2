"use client";

import { memo, useRef, useEffect, useState } from "react";
import { ArrowUp, Check, ChevronDown, Paperclip, Square, X } from "lucide-react";

interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  b64: string;
}

interface Props {
  input: string;
  onInput: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  models: { id: string; label: string }[];
  onFileAttach?: (file: File) => void;
  attachment?: ChatAttachment | null;
  onRemoveAttachment?: () => void;
}

function PureChatInput({
  input,
  onInput,
  onSubmit,
  onStop,
  isLoading,
  selectedModel,
  onModelChange,
  models,
  onFileAttach,
  attachment,
  onRemoveAttachment,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(Math.max(el.scrollHeight, 84), 180) + "px";
  }, [input]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (input.trim() || attachment)) onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();
    if (file && onFileAttach) {
      e.preventDefault();
      onFileAttach(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileAttach) onFileAttach(file);
    e.target.value = "";
  };

  const selectedModelLabel = models.find((m) => m.id === selectedModel)?.label ?? selectedModel;
  const canChooseModel = models.length > 1;

  return (
    <div className="ci-area">
      <div className="ci-container">
        <div className="ci-box">
          {attachment && (
            <div className="ci-attachment-preview">
              <div className="ci-attachment-thumb-wrap">
                <img className="ci-attachment-thumb" src={attachment.url} alt={attachment.name} />
              </div>
              <div className="ci-attachment-meta">
                <span className="ci-attachment-name">{attachment.name}</span>
                <span className="ci-attachment-size">{Math.ceil(attachment.size / 1024)} KB</span>
              </div>
              <button
                className="ci-attachment-remove"
                onClick={onRemoveAttachment}
                title="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="ci-textarea"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder="Ask anything..."
            rows={1}
          />

          <div className="ci-toolbar">
            {/* Left: attachment + model picker */}
            <div className="ci-toolbar-left">
              {/* File attachment */}
              <input
                ref={fileInputRef}
                type="file"
                className="ci-file-input"
                accept="image/*"
                onChange={handleFileChange}
              />
              <button
                className="ci-tool-btn"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={15} />
              </button>

              {/* Model picker */}
              <div className="ci-model-wrap" ref={modelRef}>
                <button
                  className="ci-model-btn"
                  onClick={() => canChooseModel && setModelOpen((v) => !v)}
                  title="Chat Agent model"
                >
                  <span className="ci-provider-dot" />
                  <span>{selectedModelLabel}</span>
                  {canChooseModel && <ChevronDown size={12} />}
                </button>
                {canChooseModel && modelOpen && (
                  <div className="ci-model-dropdown">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        className={`ci-model-option${selectedModel === m.id ? " active" : ""}`}
                        onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                      >
                        {m.label}
                        {selectedModel === m.id && (
                          <Check size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: send / stop */}
            <div className="ci-toolbar-right">
              {isLoading ? (
                <button className="ci-stop-btn" onClick={onStop} title="Stop">
                  <Square size={12} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="ci-send-btn"
                  onClick={onSubmit}
                  disabled={!input.trim() && !attachment}
                  title="Send message"
                >
                  <ArrowUp size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ChatInput = memo(PureChatInput);
