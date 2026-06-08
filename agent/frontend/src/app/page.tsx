"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, FileText,
  ScanFace, LayoutDashboard, AlertTriangle, Bot, FileBarChart, MessageSquare
} from "lucide-react";
import { AppShell, StatusPill } from "@/components";
import { getHealth, getSFDSHealth, SFDSHealthData } from "@/lib/api";

const METRICS = [
  { icon: ScanFace, label: "Vision Analysis", value: "Active", sub: "Image & camera analysis", color: "" },
  { icon: LayoutDashboard, label: "Dashboard Reader", value: "Ready", sub: "Metrics extraction", color: "" },
  { icon: AlertTriangle, label: "Error Diagnosis", value: "Available", sub: "Root cause detection", color: "" },
  { icon: FileBarChart, label: "Reports", value: "On-demand", sub: "PDF · DOCX · HTML", color: "" },
];

const ACTIONS = [
  { href: "/analyze", icon: ScanFace, iconClass: "", title: "Analyze Image", desc: "Upload or capture an image for AI-powered SCADA analysis." },
  { href: "/analyze?tab=dashboard", icon: LayoutDashboard, iconClass: "accent-bg", title: "Dashboard Reader", desc: "Extract metrics from dashboard screenshots." },
  { href: "/analyze?tab=error", icon: AlertTriangle, iconClass: "amber-bg", title: "Error Diagnosis", desc: "Analyze errors and get remediation steps." },
  { href: "/reports", icon: FileBarChart, iconClass: "green-bg", title: "Reports", desc: "View and download generated reports." },
  { href: "/chat", icon: MessageSquare, iconClass: "", title: "Chat Assistant", desc: "AI-powered operations support via multi-agent." },
];

interface HealthData {
  status: string;
  model: string;
  lm_studio_url: string;
  sfds_url: string;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const [sfds, setSfds] = useState<SFDSHealthData | null>(null);
  const [sfdsErr, setSfdsErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getHealth().then((d) => { setHealth(d); setHealthErr(false); }).catch(() => setHealthErr(true)),
      getSFDSHealth().then((d) => { setSfds(d); setSfdsErr(false); }).catch(() => setSfdsErr(true)),
    ]).finally(() => setLoading(false));
  }, []);

  const backendStatus = health ? "online" : healthErr ? "offline" : "offline";
  const lmStatus = health?.lm_studio_url ? "online" : "offline";
  const sfdsOnline = sfds?.sfds_status === "online" || sfds?.status === "ok" || sfds?.data?.status === "ok";
  const sfdsStatus = sfdsOnline ? "online" : sfdsErr ? "offline" : "offline";
  const sfdsValue = sfdsStatus === "online"
    ? (typeof sfds?.cameras === "number" ? `${sfds.cameras} cameras` : "Connected")
    : "Offline";

  return (
    <AppShell>
      <div className="status-strip">
        <StatusPill status={backendStatus} label="Backend API" value={backendStatus === "online" ? "Connected" : "Offline"} />
        <StatusPill status={lmStatus} label="LM Studio" value={lmStatus === "online" ? (health?.model?.split("/").pop() ?? "Connected") : "Offline"} />
        <StatusPill status={sfdsStatus} label="SFDS" value={sfdsValue} />
      </div>

      <div className="metric-grid">
        {METRICS.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className={`metric-card ${color}`}>
            <div className="metric-card-header">
              <Icon size={18} className="metric-card-icon" />
            </div>
            <div className="metric-card-label">{label}</div>
            <div className="metric-card-value">{value}</div>
            <div className="metric-card-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "var(--sp-8)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink)" }}>Quick Actions</h2>
        </div>
        <div className="action-grid">
          {ACTIONS.map(({ href, icon: Icon, iconClass, title, desc }) => (
            <Link key={href} href={href} className="action-card">
              <div className={`action-icon ${iconClass}`}>
                <Icon size={20} />
              </div>
              <div className="action-body">
                <div className="action-title">{title}</div>
                <div className="action-desc">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <Bot size={16} />
          Multi-Agent System
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--sp-4)" }}>
            {[
              { name: "Vision Agent", role: "SCADA/IoT image analysis", tools: "analyze_image, extract_dashboard_metrics, diagnose_error" },
              { name: "Chat Agent", role: "Operations assistant", tools: "SFDS tools, chat history, status lookup" },
              { name: "Report Agent", role: "Report generation", tools: "generate_report (PDF/DOCX/HTML)" },
            ].map((agent) => (
              <div key={agent.name} style={{ padding: "var(--sp-4)", background: "var(--bg)", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
                  <Bot size={14} style={{ color: "var(--accent)" }} />
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{agent.name}</span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginBottom: "var(--sp-1)" }}>{agent.role}</div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-muted)", wordBreak: "break-all" }}>{agent.tools}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
