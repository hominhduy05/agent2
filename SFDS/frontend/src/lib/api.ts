const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("durian_token");
}

export function setToken(token: string) {
  localStorage.setItem("durian_token", token);
}

export function removeToken() {
  localStorage.removeItem("durian_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
export async function detectImage(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(`${API_BASE}/detect/`, { method: "POST", body: formData, headers });
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Lỗi đăng nhập" }));
    throw new Error(err.detail || "Đăng nhập thất bại");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me/`, {
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Không thể lấy thông tin người dùng");
  return res.json();
}

export function logout() {
  removeToken();
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------
export async function listEmployees() {
  const res = await fetch(`${API_BASE}/api/employees/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Không thể tải danh sách nhân viên");
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.value ?? data ?? []);
}

export async function createEmployee(payload: {
  username: string;
  password: string;
  full_name: string;
  role: string;
}) {
  const res = await fetch(`${API_BASE}/api/employees/`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Lỗi" }));
    throw new Error(err.detail || "Tạo nhân viên thất bại");
  }
  return res.json();
}

export async function updateEmployee(id: number, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/employees/${id}/`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Cập nhật thất bại");
  return res.json();
}

export async function deleteEmployee(id: number) {
  const res = await fetch(`${API_BASE}/api/employees/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Xoá nhân viên thất bại");
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
export async function listSessions(params?: {
  employee_id?: number;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.employee_id) qs.set("employee_id", String(params.employee_id));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`${API_BASE}/api/sessions/?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Không thể tải lịch sử kiểm tra");
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.value ?? data ?? []);
}

export async function createSession(payload: {
  employee_id: number;
  total_inspected: number;
  mature_count: number;
  immature_count: number;
  defective_count: number;
  avg_confidence: number;
  notes?: string;
}) {
  const res = await fetch(`${API_BASE}/api/sessions/`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Tạo session thất bại");
  return res.json();
}

// KPIs
// ---------------------------------------------------------------------------
export async function listKPIs() {
  const res = await fetch(`${API_BASE}/api/kpis/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Không thể tải KPI");
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.value ?? data ?? []);
}

export async function updateKPI(payload: {
  metric_name: string;
  target_value: number;
  display_name?: string;
  period?: string;
  unit?: string;
}) {
  const res = await fetch(`${API_BASE}/api/kpis/`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Cập nhật KPI thất bại");
  return res.json();
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function getSummaryReport(period = "daily", employee_id?: number) {
  const qs = new URLSearchParams({ period });
  if (employee_id) qs.set("employee_id", String(employee_id));
  const res = await fetch(`${API_BASE}/api/reports/summary/?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Không thể tải báo cáo tổng hợp");
  const data = await res.json();
  if (Array.isArray(data)) return data[0] ?? data;
  return data ?? {};
}

export async function getEmployeeReport(empId: number, period = "weekly") {
  const res = await fetch(
    `${API_BASE}/api/reports/employee/${empId}/?period=${period}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Không thể tải báo cáo nhân viên");
  return res.json();
}
