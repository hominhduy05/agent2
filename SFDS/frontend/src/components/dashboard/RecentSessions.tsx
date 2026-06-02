"use client";

import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { InspectionSession } from "@/lib/types";

interface Props {
  sessions: InspectionSession[];
}

export default function RecentSessions({ sessions }: Props) {
  return (
    <div className="overflow-x-auto">
      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Chưa có session nào.</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Thời gian", "Nhân viên", "Tổng", "Chín", "Chưa chín", "Hư", "Thiết bị"].map((h) => (
                <th
                  key={h}
                  style={{
                    paddingBottom: "12px",
                    paddingRight: "16px",
                    textAlign: h === "Tổng" || h === "Chín" || h === "Chưa chín" || h === "Hư" ? "center" : "left",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--text-muted)",
                    fontFamily: "Outfit, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                style={{
                  borderBottom: "1px solid var(--border-soft)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
              >
                <td style={{ padding: "12px 16px 12px 0", color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  {format(parseISO(s.timestamp), "dd/MM HH:mm", { locale: vi })}
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text)", fontSize: "0.875rem", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {s.employee_name || `ID ${s.employee_id}`}
                </td>
                <td style={{ padding: "12px", textAlign: "center", color: "var(--text)", fontSize: "0.875rem", fontWeight: 700 }}>
                  {s.total_inspected}
                </td>
                <td style={{ padding: "12px", textAlign: "center", color: "var(--success)", fontSize: "0.875rem", fontWeight: 600 }}>
                  {s.mature_count}
                </td>
                <td style={{ padding: "12px", textAlign: "center", color: "var(--amber)", fontSize: "0.875rem", fontWeight: 600 }}>
                  {s.immature_count}
                </td>
                <td style={{ padding: "12px", textAlign: "center", color: "var(--error)", fontSize: "0.875rem", fontWeight: 600 }}>
                  {s.defective_count}
                </td>
                <td style={{ padding: "12px 0 12px 16px", color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  {s.device}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
