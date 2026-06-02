"use client";

import { useState } from "react";
import { FileText, Download, Loader } from "lucide-react";
import { generateReport, downloadReport, ReportGenerateReq } from "@/lib/api";

interface ReportGeneratorProps {
  analysisContent: string;
  analysisType: string;
}

export default function ReportGenerator({ analysisContent, analysisType }: ReportGeneratorProps) {
  const [title, setTitle] = useState("Vision Analysis Report");
  const [format, setFormat] = useState<"pdf" | "docx" | "html" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<{ id: string; formats: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const req: ReportGenerateReq = {
        title,
        content: analysisContent,
        analysis_type: analysisType,
        format,
        metadata: {
          "Model": "nvidia/nemotron-3-nano-omni",
          "Analysis Type": analysisType,
          "Generated": new Date().toLocaleString("vi-VN"),
        },
      };
      const res = await generateReport(req) as { reports: { report_id: string; format: string }[] };
      const formats = res.reports.map((r) => r.format);
      const id = res.reports[0]?.report_id ?? "";
      setGenerated({ id, formats });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--sp-3)", alignItems: "end" }}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Format</label>
          <select
            className="form-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            style={{ minWidth: 140 }}
          >
            <option value="all">All formats</option>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
            <option value="html">HTML</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-alert" style={{ marginTop: "var(--sp-3)" }}>
          <div className="error-alert-title">Generation failed</div>
          <div className="error-alert-msg">{error}</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !analysisContent}
        >
          {loading ? (
            <><Loader size={16} className="spin" /> Generating...</>
          ) : (
            <><FileText size={16} /> Generate</>
          )}
        </button>

        {generated && (
          <>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Download:</span>
            {generated.formats.map((fmt) => (
              <button
                key={fmt}
                className="btn btn-ghost btn-sm"
                onClick={() => downloadReport(generated.id, fmt)}
              >
                <Download size={13} /> {fmt.toUpperCase()}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
