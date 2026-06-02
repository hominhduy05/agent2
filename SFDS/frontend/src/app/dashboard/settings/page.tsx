"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { listKPIs, updateKPI } from "@/lib/api";
import { KPITarget } from "@/lib/types";
import { useAuth } from "@/components/dashboard/AuthProvider";
import styles from "./page.module.css";

const PERIOD_LABELS: Record<string, string> = {
  daily: "Ngày", weekly: "Tuần", monthly: "Tháng",
};

const UNIT_LABELS: Record<string, string> = {
  count: "Số lần", percent: "Phần trăm", hours: "Giờ",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPITarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const isAdmin = user?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const data = await listKPIs();
      setKpis(data);
      const init: Record<string, number> = {};
      data.forEach((k: KPITarget) => { init[k.metric_name] = k.target_value; });
      setEdited(init);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleChange(name: string, value: number) {
    setEdited((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(kpi: KPITarget) {
    const newVal = edited[kpi.metric_name];
    if (newVal === undefined) return;
    setSaving(kpi.metric_name);
    setMessage(null);
    try {
      const updated = await updateKPI({
        metric_name: kpi.metric_name,
        target_value: newVal,
        display_name: kpi.display_name,
        period: kpi.period,
        unit: kpi.unit,
      });
      setKpis((prev) => prev.map((k) =>
        k.metric_name === updated.metric_name ? { ...k, target_value: updated.target_value } : k
      ));
      setMessage({ type: "success", text: `Đã lưu: ${kpi.display_name}` });
    } catch {
      setMessage({ type: "error", text: "Lưu thất bại. Cần quyền quản trị." });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingRow}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cài đặt KPI</h1>
          <p className={styles.pageSub}>Đặt mục tiêu năng suất cho nhân viên kiểm tra sầu riêng.</p>
        </div>
        <button className={styles.refreshBtn} onClick={load}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {message && (
        <div className={`${styles.toast} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {!isAdmin && (
        <div className={styles.readOnlyNote}>
          Bạn đang ở chế độ xem. Cần quyền Quản trị để chỉnh sửa KPI.
        </div>
      )}

      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const currentVal = edited[kpi.metric_name] ?? kpi.target_value;
          const changed = currentVal !== kpi.target_value;
          return (
            <div key={kpi.id} className={styles.kpiCard}>
              <div className={styles.kpiHead}>
                <div>
                  <h3 className={styles.kpiName}>{kpi.display_name}</h3>
                  <div className={styles.kpiMeta}>
                    <span className={styles.badge}>{PERIOD_LABELS[kpi.period] ?? kpi.period}</span>
                    <span className={styles.unitBadge}>{UNIT_LABELS[kpi.unit] ?? kpi.unit}</span>
                    <code className={styles.metricCode}>{kpi.metric_name}</code>
                  </div>
                </div>
              </div>

              <div className={styles.kpiBody}>
                <label className={styles.inputLabel}>
                  Mục tiêu
                  <div className={styles.inputWrap}>
                    <input
                      type="number"
                      className={styles.input}
                      value={currentVal}
                      onChange={(e) => handleChange(kpi.metric_name, parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                      min={0}
                      step={kpi.unit === "percent" ? 0.1 : 1}
                    />
                    {kpi.unit === "percent" && <span className={styles.unitSuffix}>%</span>}
                  </div>
                </label>
              </div>

              <div className={styles.kpiFoot}>
                <span className={styles.currentVal}>
                  Hiện tại: <strong>{kpi.target_value.toLocaleString()}{kpi.unit === "percent" ? "%" : ""}</strong>
                </span>
                {isAdmin && (
                  <button
                    className={`${styles.saveBtn} ${!changed ? styles.saveBtnDisabled : ""}`}
                    onClick={() => handleSave(kpi)}
                    disabled={saving !== null || !changed}
                  >
                    {saving === kpi.metric_name ? (
                      <><div className={styles.miniSpinner} /> Đang lưu...</>
                    ) : (
                      <><Save size={13} /> Lưu</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
