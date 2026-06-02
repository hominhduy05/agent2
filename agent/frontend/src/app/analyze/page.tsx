"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ScanFace, LayoutDashboard, AlertTriangle,
  ImageIcon, FileText
} from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import AnalysisPanel from "@/components/AnalysisPanel";
import ReportGenerator from "@/components/ReportGenerator";
import { AppShell, PageHeader, Badge } from "@/components";
import { analyzeImage, analyzeDashboard, analyzeError, analyzeCameraFrame } from "@/lib/api";

type Tab = "general" | "dashboard" | "error";
type Result = { analysis: string; analysis_type: string; suggestions: string[] } | null;

const TABS: Record<Tab, { icon: typeof ScanFace; label: string }> = {
  general: { icon: ScanFace, label: "General" },
  dashboard: { icon: LayoutDashboard, label: "Dashboard" },
  error: { icon: AlertTriangle, label: "Error" },
};

const PROMPTS: Record<Tab, string> = {
  general: "Analyze this image in detail for the SCADA/IoT system.",
  dashboard: "Extract all metrics, values, gauges, and indicators from this dashboard image.",
  error: "Analyze this error image. Identify the probable root cause and recommend specific remediation steps.",
};

export default function AnalyzePage() {
  const [tab, setTab] = useState<Tab>("general");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && TABS[t]) setTab(t);
  }, []);

  const handleImageSelected = useCallback((_file: File, url: string) => {
    setPreview(url);
    setResult(null);
    setError(null);
  }, []);

  const handleCameraCapture = useCallback((b64: string) => {
    setPreview(`data:image/jpeg;base64,${b64}`);
    setResult(null);
    setError(null);
    setLoading(true);
    analyzeCameraFrame(b64, PROMPTS.general)
      .then(setResult)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Analysis failed"))
      .finally(() => setLoading(false));
  }, []);

  const effectivePrompt = prompt.trim() || PROMPTS[tab];

  const handleAnalyze = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], "image.jpg", { type: "image/jpeg" });
      let r: Result;
      if (tab === "dashboard") r = await analyzeDashboard(file, effectivePrompt);
      else if (tab === "error") r = await analyzeError(file, effectivePrompt);
      else r = await analyzeImage(file, effectivePrompt, "general");
      setResult(r);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      if (msg.includes("1234") || msg.includes("Connection")) setError("LM Studio offline — ensure it is running on port 1234.");
      else if (msg.includes("Failed to fetch")) setError("Backend API offline — check the server.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Analysis Workbench"
        subtitle="Inspect camera frames, dashboards, and fault screenshots from a focused operator workspace."
      />

      <div className="tabs">
        {(Object.keys(TABS) as Tab[]).map((t) => {
          const { icon: Icon, label } = TABS[t];
          return (
            <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => { setTab(t); setResult(null); setError(null); }}>
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="analyze-layout">
        {/* Input side */}
        <div className="card">
          <div className="card-header">
            <ImageIcon size={15} />
            Image Input
          </div>
          <div className="card-body">
            <ImageUploader onImageSelected={handleImageSelected} onCameraCapture={handleCameraCapture} showCamera />
            <div style={{ marginTop: "var(--sp-4)" }}>
              <div className="form-group">
                <label className="form-label">Custom Prompt (optional)</label>
                <textarea
                  className="form-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={PROMPTS[tab]}
                  rows={2}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!preview || loading}
                style={{ width: "100%", marginTop: "var(--sp-3)" }}
              >
                {loading ? (
                  <><div className="spinner spinner-sm" /> Analyzing...</>
                ) : (
                  <><ScanFace size={16} /> Analyze</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result side */}
        <div className="card">
          <div className="card-header">
            Analysis Result
            {result && <Badge variant="blue">{result.analysis_type || tab}</Badge>}
          </div>
          <div className="card-body">
            <AnalysisPanel result={result} loading={loading} error={error} />
          </div>
          {result && (
            <div className="report-action-panel">
              <div className="report-action-heading">
                <FileText size={15} />
                Generate Report
              </div>
              <ReportGenerator analysisContent={result.analysis} analysisType={result.analysis_type} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
