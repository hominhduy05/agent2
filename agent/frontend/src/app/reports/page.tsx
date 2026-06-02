"use client";

import { useState, useEffect } from "react";
import { Download, RefreshCw, FileText, Search } from "lucide-react";
import { AppShell, PageHeader, Badge, EmptyState, ErrorAlert } from "@/components";
import { listReports, downloadReport } from "@/lib/api";

interface Report {
  report_id: string;
  title: string;
  analysis_type: string;
  format: string;
  created_at: string;
  size_bytes?: number;
}

const TYPE_COLORS: Record<string, "blue" | "green" | "amber" | "red" | "gray"> = {
  dashboard: "blue", error: "red", camera: "green", general: "gray",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReports();
      setReports(data.reports);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter((r) =>
    !filter || r.analysis_type.includes(filter) || r.title.toLowerCase().includes(filter.toLowerCase())
  );

  const fmtSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const fmtDate = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000);
    return isNaN(d.getTime()) ? ts : d.toLocaleString("vi-VN");
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        subtitle="Analysis reports generated from image and chat sessions"
        actions={
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        }
      />

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>Loading reports...</span>
        </div>
      )}

      {error && <ErrorAlert title="Failed to load reports" message="Could not connect to the backend." details={error} />}

      {!loading && !error && reports.length === 0 && (
        <EmptyState
          icon={<FileText size={48} />}
          title="No reports yet"
          description="Run an analysis first, then generate a report from the results."
          action={{ label: "Go to Analyze", href: "/analyze" }}
        />
      )}

      {!loading && !error && reports.length > 0 && (
        <>
          <div className="toolbar">
            <div style={{ position: "relative", flex: "0 0 240px" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
              <input
                className="form-input"
                style={{ paddingLeft: 32, fontSize: "var(--text-sm)" }}
                placeholder="Filter by type or title..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              {filtered.length} of {reports.length} reports
            </span>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Title / ID</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.report_id}-${r.format}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginTop: 2 }}>
                        {r.report_id.substring(0, 16)}...
                      </div>
                    </td>
                    <td><Badge variant={TYPE_COLORS[r.analysis_type] ?? "gray"}>{r.analysis_type}</Badge></td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg)", padding: "2px 6px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                        {r.format.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-secondary)", fontSize: "var(--text-xs)" }}>{fmtDate(r.created_at)}</td>
                    <td style={{ color: "var(--ink-secondary)", fontSize: "var(--text-xs)" }}>{fmtSize(r.size_bytes)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => downloadReport(r.report_id, r.format)}
                        title={`Download ${r.format.toUpperCase()}`}
                      >
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
