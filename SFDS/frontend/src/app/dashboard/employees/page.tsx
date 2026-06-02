"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { listEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/api";
import { Employee } from "@/lib/types";
import { useAuth } from "@/components/dashboard/AuthProvider";
import styles from "./page.module.css";

interface FormState {
  username: string;
  password: string;
  full_name: string;
  role: "inspector" | "admin";
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>({ username: "", password: "", full_name: "", role: "inspector" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const isAdmin = user?.role === "admin";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listEmployees();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      setError("Không thể tải danh sách.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ username: "", password: "", full_name: "", role: "inspector" });
    setShowModal(true);
    setError("");
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({ username: emp.username, password: "", full_name: emp.full_name, role: emp.role });
    setShowModal(true);
    setError("");
  }

  async function handleSave() {
    if (!form.username || !form.full_name) { setError("Điền đầy đủ tên đăng nhập và họ tên."); return; }
    if (!editing && !form.password) { setError("Mật khẩu bắt buộc khi tạo mới."); return; }
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { username: form.username, full_name: form.full_name, role: form.role };
      if (form.password) payload.password = form.password;
      if (editing) await updateEmployee(editing.id, payload);
      else await createEmployee({ username: form.username, password: form.password, full_name: form.full_name, role: form.role });
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi khi lưu.");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try { await deleteEmployee(deleteTarget.id); setDeleteTarget(null); load(); }
    catch { setError("Xoá thất bại."); }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nhân viên</h1>
          <p className={styles.pageSub}>{employees.length} tài khoản</p>
        </div>
        {isAdmin && (
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={15} /> Thêm nhân viên
          </button>
        )}
      </div>

      {error && !showModal && !deleteTarget && (
        <div className={styles.errorBanner}>{error}</div>
      )}

      {loading ? (
        <div className={styles.loadingRow}><div className={styles.spinner} /></div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  {isAdmin && <th></th>}
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
                      <span className={`${styles.dot} ${emp.is_active ? styles.active : styles.inactive}`}>
                        {emp.is_active ? "Hoạt động" : "Vô hiệu"}
                      </span>
                    </td>
                    <td className={styles.muted}>
                      {new Date(emp.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    {isAdmin && (
                      <td className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => openEdit(emp)} title="Sửa">
                          <Pencil size={13} />
                        </button>
                        {user?.id !== emp.id && (
                          <button className={styles.delBtn} onClick={() => setDeleteTarget(emp)} title="Xoá">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editing ? "Sửa nhân viên" : "Thêm nhân viên"}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={17} /></button>
            </div>
            {error && <div className={styles.errorBanner}>{error}</div>}
            <div className={styles.formBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Tên đăng nhập</label>
                  <input className={styles.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" disabled={!!editing} />
                </div>
                <div className={styles.field}>
                  <label>Họ tên</label>
                  <input className={styles.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Mật khẩu {editing ? "(bỏ trống nếu không đổi)" : ""}</label>
                  <input className={styles.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Không đổi" : "Nhập mật khẩu"} />
                </div>
                <div className={styles.field}>
                  <label>Vai trò</label>
                  <select className={styles.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "inspector" })}>
                    <option value="inspector">Kiểm tra</option>
                    <option value="admin">Quản trị</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Huỷ</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className={styles.overlay}>
          <div className={styles.confirmModal}>
            <h3>Xoá nhân viên</h3>
            <p>Xoá <strong>{deleteTarget.full_name}</strong> ({deleteTarget.username})? Không thể hoàn tác.</p>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Huỷ</button>
              <button className={styles.confirmDelBtn} onClick={handleDelete}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
