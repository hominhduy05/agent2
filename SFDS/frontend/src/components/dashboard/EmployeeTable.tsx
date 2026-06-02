"use client";

import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Employee } from "@/lib/types";
import styles from "./EmployeeTable.module.css";

interface Props {
  employees: Employee[];
  currentUserId?: number;
  onEdit?: (emp: Employee) => void;
  onDelete?: (emp: Employee) => void;
}

export default function EmployeeTable({ employees, currentUserId, onEdit, onDelete }: Props) {
  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Danh sách nhân viên</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tên đăng nhập</th>
              <th>Họ tên</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className={styles.username}>{emp.username}</td>
                <td>{emp.full_name}</td>
                <td>
                  <span className={`${styles.badge} ${emp.role === "admin" ? styles.admin : styles.inspector}`}>
                    {emp.role === "admin" ? "Quản trị" : "Kiểm tra"}
                  </span>
                </td>
                <td>
                  <span className={`${styles.status} ${emp.is_active ? styles.active : styles.inactive}`}>
                    {emp.is_active ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </td>
                <td className={styles.muted}>
                  {format(parseISO(emp.created_at), "dd/MM/yyyy", { locale: vi })}
                </td>
                <td>
                  {currentUserId !== emp.id && onEdit && (
                    <button className={styles.actionBtn} onClick={() => onEdit(emp)}>
                      Sửa
                    </button>
                  )}
                  {currentUserId !== emp.id && onDelete && (
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => onDelete(emp)}
                    >
                      Xoá
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
