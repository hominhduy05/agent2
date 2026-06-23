import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle, Activity, TrendingUp, Target,
  RefreshCw, ArrowRight, Leaf, BarChart3, Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import KPICard from "@/components/dashboard/KPICard";
import TrendLineChart from "@/components/dashboard/TrendLineChart";
import QualityDonut from "@/components/dashboard/QualityDonut";
import RecentSessions from "@/components/dashboard/RecentSessions";
import { useAuth } from "@/components/dashboard/AuthProvider";
import {
  getSummaryReport, listSessions, listKPIs, listEmployees,
} from "@/lib/api";
import { SummaryReport, InspectionSession, KPITarget, Employee } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [sessions, setSessions] = useState<InspectionSession[]>([]);
  const [kpis, setKpis] = useState<KPITarget[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const [rep, sess, kpiList, empList] = await Promise.all([
        getSummaryReport(period).catch(() => null),
        listSessions({ limit: 10 }).catch(() => []),
        listKPIs().catch(() => []),
        listEmployees().catch(() => []),
      ]);
      const safeEmpList = Array.isArray(empList)
        ? empList
        : (empList as any)?.value ?? [];
      setReport(rep);
      setSessions(Array.isArray(sess) ? sess : []);
      setKpis(Array.isArray(kpiList) ? kpiList : []);
      setEmployees(safeEmpList);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  const dailyKPI = kpis.find((k) => k.metric_name === "daily_inspections");
  const kpiProgress = report && dailyKPI
    ? Math.min((report.total_inspected / dailyKPI.target_value) * 100, 100)
    : undefined;

  const today = new Date().toISOString().slice(0, 10);
  const empStats = employees.map((emp) => {
    const empSessions = sessions.filter(
      (s) => s.employee_id === emp.id && s.timestamp.startsWith(today)
    );
    const total = empSessions.reduce((acc, s) => acc + s.total_inspected, 0);
    return { ...emp, todayTotal: total };
  });

  const kpiColor =
    kpiProgress === undefined ? "green"
    : kpiProgress >= 80 ? "green"
    : kpiProgress >= 50 ? "amber"
    : "red";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  const greetingLabel =
    new Date().toLocaleDateString("vi-VN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

  const greetingIcon = () => {
    const h = new Date().getHours();
    if (h < 12) return "🌤️";
    if (h < 18) return "☀️";
    return "🌙";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header skeleton */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ width: 240, height: 28, background: "var(--bg-hover)", borderRadius: 8, marginBottom: 6, animation: "pulse 1.5s infinite" }} />
            <div style={{ width: 300, height: 16, background: "var(--bg-hover)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
          </div>
        </div>
        {/* KPI Cards skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 120, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
        {/* Chart skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: "16px" }}>
          <div style={{ height: 300, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
          <div style={{ height: 300, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
        </div>
        {/* Bottom skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "16px" }}>
          <div style={{ height: 260, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
          <div style={{ height: 260, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Greeting Header ─────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Avatar */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--accent-faint)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              fontFamily: "Sora, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              flexShrink: 0,
            }}
          >
            {user?.full_name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div>
            <h1
              style={{
                fontFamily: "Sora, sans-serif",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                marginBottom: "2px",
              }}
            >
              {greeting()}, {user?.full_name?.split(" ")[0] ?? "Người dùng"}
              <span style={{ fontSize: "1rem", marginLeft: 6 }}>{greetingIcon()}</span>
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontFamily: "Outfit, sans-serif", textTransform: "capitalize" }}>
              {greetingLabel}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Period filter */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              padding: "3px",
              gap: "2px",
            }}
          >
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 9,
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  fontFamily: "Outfit, sans-serif",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  ...(period === p
                    ? { background: "var(--accent)", color: "#07090a" }
                    : { background: "transparent", color: "var(--text-muted)" }
                  ),
                }}
              >
                {p === "daily" ? "Hôm nay" : p === "weekly" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: 38,
              padding: "0 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              fontWeight: 500,
              fontFamily: "Outfit, sans-serif",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <RefreshCw size={13} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
            {refreshing ? "Đang cập nhật..." : "Làm mới"}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <KPICard
          label="Tổng kiểm tra"
          value={report?.total_inspected.toLocaleString() ?? "0"}
          sub={`Kỳ: ${period === "daily" ? "hôm nay" : period === "weekly" ? "tuần này" : "tháng này"}`}
          icon={<Activity size={20} />}
          color="green"
        />
        <KPICard
          label="Tỷ lệ đạt CL"
          value={report ? `${report.quality_rate}%` : "—"}
          sub={report ? `${report.mature_count} chín · ${report.immature_count} chưa chín` : ""}
          icon={<CheckCircle size={20} />}
          color="amber"
        />
        <KPICard
          label="TB Confidence"
          value={report ? `${(report.avg_confidence * 100).toFixed(1)}%` : "—"}
          sub="Độ chính xác trung bình mô hình"
          icon={<TrendingUp size={20} />}
          color="green"
        />
        <KPICard
          label="KPI Hoàn thành"
          value={kpiProgress !== undefined ? `${kpiProgress.toFixed(0)}%` : "—"}
          sub={dailyKPI ? `Mục tiêu: ${dailyKPI.target_value.toLocaleString()} lần/ngày` : ""}
          icon={<Target size={20} />}
          color={kpiColor as "amber" | "green" | "red" | "blue"}
          progress={kpiProgress}
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: "16px", alignItems: "start" }}>
        {/* Trend chart */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  Xu hướng kiểm tra
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "Outfit, sans-serif" }}>
                  Số lượng theo ngày trong kỳ
                </p>
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {[
                { label: "Tổng", color: "var(--accent)" },
                { label: "Chín", color: "var(--success)" },
                { label: "Hư", color: "var(--error)" },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "Outfit, sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <TrendLineChart data={report?.daily_breakdown ?? []} title="" />
        </div>

        {/* Quality donut */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--amber-dim)",
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                Phân bố chất lượng
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "Outfit, sans-serif" }}>
                Chín / Chưa chín / Hư hỏng
              </p>
            </div>
          </div>
          <QualityDonut
            mature={report?.mature_count ?? 0}
            immature={report?.immature_count ?? 0}
            defective={report?.defective_count ?? 0}
            title=""
          />
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "16px", alignItems: "start" }}>
        {/* Employee productivity */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={18} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  Năng suất hôm nay
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "Outfit, sans-serif" }}>
                  Theo từng nhân viên
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/employees"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--accent)",
                fontFamily: "Outfit, sans-serif",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            >
              Tất cả <ArrowRight size={11} />
            </Link>
          </div>

          {empStats.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--bg-hover)",
                  marginBottom: "12px",
                }}
              >
                <Leaf size={20} style={{ color: "var(--text-faint)" }} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Chưa có dữ liệu nhân viên.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {empStats.map((emp) => {
                const prog = dailyKPI
                  ? Math.min((emp.todayTotal / dailyKPI.target_value) * 100, 100)
                  : 0;
                return (
                  <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "var(--accent-faint)",
                        border: "1px solid var(--border)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "Sora, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        flexShrink: 0,
                      }}
                    >
                      {emp.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <p
                          style={{
                            color: "var(--text)",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {emp.full_name}
                        </p>
                        <p style={{ color: "var(--text)", fontSize: "0.875rem", fontWeight: 700, flexShrink: 0, marginLeft: "8px" }}>
                          {emp.todayTotal}
                          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.75rem", marginLeft: 2 }}>lần</span>
                        </p>
                      </div>
                      <div style={{ height: 6, borderRadius: "50%", background: "var(--border)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: "50%",
                            background: prog >= 80 ? "var(--accent)" : prog >= 50 ? "var(--amber)" : "var(--error)",
                            width: `${prog}%`,
                            transition: "width 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={18} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  Session gần đây
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "Outfit, sans-serif" }}>
                  Các lần kiểm tra mới nhất
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/history"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--accent)",
                fontFamily: "Outfit, sans-serif",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            >
              Xem tất cả <ArrowRight size={11} />
            </Link>
          </div>
          <RecentSessions sessions={sessions.slice(0, 7)} />
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
