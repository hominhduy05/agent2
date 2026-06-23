"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Download, RefreshCw, Users } from "lucide-react";
import {
  getSummaryReport, getEmployeeReport, listEmployees,
} from "@/lib/api";
import { SummaryReport, Employee } from "@/lib/types";
import { CLASS_COLORS } from "@/lib/types";
import styles from "./page.module.css";

const PERIOD_OPTIONS = [
  { value: "daily",   label: "Hôm nay" },
  { value: "weekly",  label: "Tuần này" },
  { value: "monthly", label: "Tháng này" },
] as const;

export default function ReportsPage() {
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empReports, setEmpReports] = useState<Record<number, Record<string, unknown>>>({});
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "employee">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, emps] = await Promise.all([
        getSummaryReport(period).catch(() => null),
        listEmployees().catch(() => []),
      ]);
      setSummary(rep);
      setEmployees(emps);

      const reports: Record<number, Record<string, unknown>> = {};
      for (const emp of emps) {
        try { reports[emp.id] = await getEmployeeReport(emp.id, period); } catch { /* skip */ }
      }
      setEmpReports(reports);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportCSV() {
    if (!summary) return;
    const headers = ["Ngày", "Tổng", "Chín", "Chưa chín", "Hư hỏng"];
    const rows = summary.daily_breakdown.map((d) => [d.date, d.total, d.mature, d.immature, d.defective]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `durian_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const donutData = summary
    ? [
        { name: "Chín",      value: summary.mature_count,   color: CLASS_COLORS.mature },
        { name: "Chưa chín", value: summary.immature_count, color: CLASS_COLORS.immature },
        { name: "Hư hỏng",  value: summary.defective_count, color: CLASS_COLORS.defective },
      ].filter((d) => d.value > 0)
    : [];

  const barData = summary?.daily_breakdown.map((d) => ({
    date: d.date.slice(5),
    "Tổng": d.total,
    "Chín": d.mature,
    "Hư": d.defective,
  })).reverse() ?? [];

  const statsCards = summary ? [
    { label: "Tổng kiểm tra", value: summary.total_inspected.toLocaleString(), color: "amber" },
    { label: "Tỷ lệ đạt CL", value: `${summary.quality_rate}%`, color: "green" },
    { label: "Số Chín", value: summary.mature_count.toLocaleString(), color: "green" },
    { label: "Số Hư", value: summary.defective_count.toLocaleString(), color: "red" },
    { label: "TB Confidence", value: `${(summary.avg_confidence * 100).toFixed(1)}%`, color: "blue" },
  ] : [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Báo cáo & Phân tích</h1>
          <p className={styles.pageSub}>Dữ liệu được cập nhật theo thời gian thực</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.select} value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button className={styles.iconBtn} onClick={fetchData} disabled={loading} title="Làm mới">
            <RefreshCw size={14} className={loading ? styles.spinning : ""} />
          </button>
          {summary && (
            <button className={styles.exportBtn} onClick={exportCSV}>
              <Download size={14} /> Xuất CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === "overview" ? styles.activeTab : ""}`} onClick={() => setActiveTab("overview")}>
          Tổng quan
        </button>
        <button className={`${styles.tab} ${activeTab === "employee" ? styles.activeTab : ""}`} onClick={() => setActiveTab("employee")}>
          <Users size={14} /> Theo nhân viên
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          {/* Stats */}
          {summary && (
            <div className={styles.statsRow}>
              {statsCards.map((s) => (
                <div key={s.label} className={`${styles.statCard} ${styles[s.color]}`}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className={styles.chartsRow}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Số lượng kiểm tra theo ngày</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "Outfit" }} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "Outfit" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "Outfit", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontFamily: "Outfit", fontSize: 12, color: "var(--text-muted)" }} />
                  <Bar dataKey="Tổng" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chín" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Hư" fill="var(--error)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Phân bố chất lượng</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, ""]}
                    contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "Outfit", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "Outfit", fontSize: 12, color: "var(--text-muted)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detail table */}
          {summary && summary.daily_breakdown.length > 0 && (
            <div className={styles.tableCard}>
              <h3 className={styles.chartTitle}>Chi tiết theo ngày</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Ngày</th><th>Tổng</th><th>Chín</th><th>Chưa chín</th><th>Hư</th><th>Tỷ lệ đạt CL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.daily_breakdown].reverse().map((d) => {
                      const rate = d.total > 0 ? (((d.mature + d.immature) / d.total) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td className={styles.bold}>{d.total.toLocaleString()}</td>
                          <td className={styles.green}>{d.mature}</td>
                          <td className={styles.amber}>{d.immature}</td>
                          <td className={styles.red}>{d.defective}</td>
                          <td>{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "employee" && (
        <div className={styles.empGrid}>
          {employees.map((emp) => {
            const rep = empReports[emp.id] as {
              total_inspected?: number; quality_rate?: number;
              kpi_progress?: number; session_count?: number;
              mature_count?: number; immature_count?: number;
              defective_count?: number;
            } | null;
            const initials = emp.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={emp.id} className={styles.empCard}>
                <div className={styles.empHeader}>
                  <div className={styles.empAvatar}>{initials}</div>
                  <div>
                    <h4 className={styles.empName}>{emp.full_name}</h4>
                    <span className={styles.empRole}>
                      {emp.role === "admin" ? "Quản trị" : "Nhân viên"}
                    </span>
                  </div>
                </div>
                {rep ? (
                  <div className={styles.empStats}>
                    {[
                      { label: "Đã kiểm tra", value: rep.total_inspected?.toLocaleString() ?? "—" },
                      { label: "Chín", value: rep.mature_count?.toLocaleString() ?? "—", color: "green" },
                      { label: "Chưa chín", value: rep.immature_count?.toLocaleString() ?? "—", color: "amber" },
                      { label: "Hư", value: rep.defective_count?.toLocaleString() ?? "—", color: "red" },
                      { label: "Đạt CL", value: `${rep.quality_rate?.toFixed(1) ?? "—"}%` },
                      { label: "Session", value: String(rep.session_count ?? "—") },
                    ].map((item) => (
                      <div key={item.label} className={styles.empStatRow}>
                        <span>{item.label}</span>
                        <strong className={item.color ? styles[item.color] : ""}>{item.value}</strong>
                      </div>
                    ))}
                    {rep.kpi_progress !== null && rep.kpi_progress !== undefined && (
                      <div className={styles.kpiRow}>
                        <span>KPI</span>
                        <div className={styles.kpiBar}>
                          <div className={styles.kpiFill} style={{ width: `${Math.min(rep.kpi_progress, 100)}%` }} />
                        </div>
                        <span className={styles.kpiPct}>{rep.kpi_progress.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={styles.noData}>Không có dữ liệu.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
