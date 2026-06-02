"use client";

import { useState, useCallback } from "react";
import { Lightbulb, AlertCircle } from "lucide-react";

interface AnalysisPanelProps {
  result: {
    analysis: string;
    analysis_type: string;
    suggestions: string[];
  } | null;
  loading: boolean;
  error: string | null;
}

export default function AnalysisPanel({ result, loading, error }: AnalysisPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (result?.analysis) {
      navigator.clipboard.writeText(result.analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Analyzing with LLM... this may take a moment</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-alert">
        <AlertCircle size={16} />
        <div>
          <div className="error-alert-title">Analysis failed</div>
          <div className="error-alert-msg">{error}</div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className={`badge badge-${typeColor(result.analysis_type)}`}>
          {result.analysis_type.toUpperCase()}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={copyToClipboard}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="result-box">{result.analysis}</div>

      {result.suggestions.length > 0 && (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--sp-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Lightbulb size={14} style={{ color: "var(--warn)" }} />
            Suggestions
          </div>
          {result.suggestions.map((s, i) => (
            <div key={i} className="suggestion-card">{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function typeColor(t: string): string {
  const map: Record<string, string> = {
    dashboard: "blue", error: "red", camera: "green", general: "gray",
  };
  return map[t] ?? "gray";
}
