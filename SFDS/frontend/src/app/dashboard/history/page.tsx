"use client";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Search, RefreshCw, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { listSessions, listEmployees } from "@/lib/api";
import { InspectionSession, Employee } from "@/lib/types";
import styles from "./page.module.css";

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [sessions, setSessions] = useState<InspectionSession[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: number, empId?: number) => {
    setLoading(true);
    try {
      const params: Parameters<typeof listSessions>[0] = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (empId) params.employee_id = empId;
      const data = await listSessions(params);
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([listEmployees().catch(() => [])]).then(([emps]) => setEmployees(emps));
    fetchData(0);
  }, [fetchData]);

  function applyFilter() {
    setPage(0);
    fetchData(0, employeeFilter || undefined);
  }

  function clearFilter() {
    setEmployeeFilter("");
    fetchData(0);
  }

  const hasFilter = employeeFilter !== "";

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Lịch sử kiểm tra</h1>
          <p className={styles.pageSub}>
            {sessions.length > 0
              ? `${sessions.length} bản ghi · Trang ${page + 1}`
              : "Không có bản ghi nào"}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchData(page, employeeFilter || undefined)}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <SlidersHorizontal size={15} className={styles.filterIcon} />
          <select
            className={styles.select}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Tất cả nhân viên</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <button className={styles.applyBtn} onClick={applyFilter}>Lọc</button>
          {hasFilter && (
            <button className={styles.clearBtn} onClick={clearFilter}>Xoá lọc</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Nhân viên</th>
                <th>Tổng</th>
                <th>Chín</th>
                <th>Chưa chín</th>
                <th>Hư</th>
                <th>TB Conf</th>
                <th>Thiết bị</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className={styles.loadingCell}>
                    <div className={styles.spinner} />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>
                    Không có bản ghi nào phù hợp.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td className={styles.timeCell}>
                      {format(parseISO(s.timestamp), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </td>
                    <td className={styles.empCell}>{s.employee_name || `ID ${s.employee_id}`}</td>
                    <td className={styles.bold}>{s.total_inspected.toLocaleString()}</td>
                    <td className={styles.green}>{s.mature_count}</td>
                    <td className={styles.amber}>{s.immature_count}</td>
                    <td className={styles.red}>{s.defective_count}</td>
                    <td className={styles.muted}>{(s.avg_confidence * 100).toFixed(1)}%</td>
                    <td className={styles.muted}>{s.device}</td>
                    <td className={styles.notes}>{s.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          className={styles.pageBtn}
          onClick={() => { if (page > 0) { setPage(page - 1); fetchData(page - 1, employeeFilter || undefined); } }}
          disabled={page === 0}
        >
          <ChevronLeft size={15} /> Trước
        </button>
        <span className={styles.pageInfo}>Trang {page + 1}</span>
        <button
          className={styles.pageBtn}
          onClick={() => { setPage(page + 1); fetchData(page + 1, employeeFilter || undefined); }}
          disabled={sessions.length < PAGE_SIZE}
        >
          Sau <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
