import { useState, useEffect } from "react";
import {
  Plus,
  FileDown,
  Receipt,
  DollarSign,
  Scale,
  FileText,
  X,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "./page.module.css";

interface Invoice {
  id: string;
  customerName: string;
  date: string;
  weightKg: number;
  grade: "A" | "B" | "C";
  unitPrice: number;
  totalAmount: number;
  status: "paid" | "pending";
}

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "HD-2026-001",
    customerName: "Công ty Cổ phần Nông sản Việt",
    date: "2026-06-20",
    weightKg: 1200,
    grade: "A",
    unitPrice: 95000,
    totalAmount: 114000000,
    status: "paid",
  },
  {
    id: "HD-2026-002",
    customerName: "Hợp tác xã Durian Mekong",
    date: "2026-06-22",
    weightKg: 850,
    grade: "B",
    unitPrice: 75000,
    totalAmount: 63750000,
    status: "paid",
  },
  {
    id: "HD-2026-003",
    customerName: "Vựa trái cây Thanh Bình",
    date: "2026-06-23",
    weightKg: 1500,
    grade: "C",
    unitPrice: 50000,
    totalAmount: 75000000,
    status: "pending",
  },
  {
    id: "HD-2026-004",
    customerName: "Công ty TNHH Xuất nhập khẩu GreenFarm",
    date: "2026-06-24",
    weightKg: 980,
    grade: "A",
    unitPrice: 95000,
    totalAmount: 93100000,
    status: "paid",
  },
  {
    id: "HD-2026-005",
    customerName: "Siêu thị Nông sản Sạch",
    date: "2026-06-25",
    weightKg: 420,
    grade: "B",
    unitPrice: 75000,
    totalAmount: 31500000,
    status: "pending",
  },
];

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function AccountingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem("sfds:accounting:invoices");
    return saved ? JSON.parse(saved) : DEFAULT_INVOICES;
  });
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    weightKg: "",
    grade: "A" as "A" | "B" | "C",
    unitPrice: "",
    status: "paid" as "paid" | "pending",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("sfds:accounting:invoices", JSON.stringify(invoices));
  }, [invoices]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.weightKg || !form.unitPrice) {
      alert("Vui lòng điền đầy đủ các thông tin cần thiết.");
      return;
    }

    const weight = parseFloat(form.weightKg);
    const price = parseInt(form.unitPrice);
    const total = weight * price;

    const newInvoice: Invoice = {
      id: `HD-2026-0${invoices.length + 1}`,
      customerName: form.customerName,
      date: new Date().toISOString().split("T")[0],
      weightKg: weight,
      grade: form.grade,
      unitPrice: price,
      totalAmount: total,
      status: form.status,
    };

    setInvoices([newInvoice, ...invoices]);
    setShowModal(false);
    setForm({
      customerName: "",
      weightKg: "",
      grade: "A",
      unitPrice: "",
      status: "paid",
    });
    showToast("Tạo hóa đơn thành công!");
  };

  const handleDelete = (id: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa hóa đơn ${id}?`)) {
      setInvoices(invoices.filter((inv) => inv.id !== id));
      showToast("Đã xóa hóa đơn.");
    }
  };

  const handleExportCSV = () => {
    // Generate simple CSV content
    const headers = "Mã hóa đơn,Khách hàng,Ngày,Khối lượng (Kg),Phân loại,Đơn giá (VNĐ),Tổng tiền (VNĐ),Trạng thái\n";
    const rows = invoices
      .map(
        (inv) =>
          `"${inv.id}","${inv.customerName}","${inv.date}",${inv.weightKg},"${inv.grade}",${inv.unitPrice},${inv.totalAmount},"${
            inv.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"
          }"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao_cao_ke_toan_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã xuất báo cáo CSV thành công!");
  };

  const handleExportPDF = (inv: Invoice) => {
    showToast(`Đang chuẩn bị in hóa đơn ${inv.id}...`);
    // Simulated print action
    setTimeout(() => {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`
          <html>
          <head>
            <title>Hóa đơn ${inv.id}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #333; }
              .header { text-align: center; margin-bottom: 40px; }
              .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
              .meta-table, .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              .details-table th, .details-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              .details-table th { background: #f9f9f9; }
              .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">HÓA ĐƠN BÁN HÀNG SẦU RIÊNG</div>
              <div>Mã số: ${inv.id}</div>
              <div>Ngày tạo: ${inv.date}</div>
            </div>
            <table class="meta-table">
              <tr><td><strong>Đơn vị bán hàng:</strong> DurianPro Smart Agriculture</td></tr>
              <tr><td><strong>Khách hàng:</strong> ${inv.customerName}</td></tr>
            </table>
            <table class="details-table" style="margin-top: 30px;">
              <thead>
                <tr>
                  <th>Sản phẩm / Phân loại</th>
                  <th>Khối lượng (Kg)</th>
                  <th>Đơn giá (VNĐ)</th>
                  <th>Thành tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sầu riêng xuất khẩu - Loại ${inv.grade}</td>
                  <td>${inv.weightKg.toLocaleString()}</td>
                  <td>${inv.unitPrice.toLocaleString()}</td>
                  <td>${inv.totalAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <div class="total">Tổng cộng: ${inv.totalAmount.toLocaleString()} VNĐ</div>
            <div style="margin-top: 50px; text-align: right; font-style: italic;">Người lập hóa đơn (Đã ký)</div>
            <script>window.print();</script>
          </body>
          </html>
        `);
        w.document.close();
      }
    }, 800);
  };

  // Calculations
  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = invoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalWeight = invoices.reduce((acc, curr) => acc + curr.weightKg, 0);
  const avgPrice = totalWeight > 0 ? Math.round(totalRevenue / totalWeight) : 0;
  const pendingAmount = invoices
    .filter((i) => i.status === "pending")
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Grade stats
  const gradeStats = ["A", "B", "C"].map((grade) => {
    const list = invoices.filter((i) => i.grade === grade);
    const revenue = list.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const weight = list.reduce((acc, curr) => acc + curr.weightKg, 0);
    return { name: `Loại ${grade}`, value: revenue, weight };
  });

  // Time stats (by day/invoice)
  const timeData = [...invoices]
    .reverse()
    .map((inv) => ({
      name: inv.id.split("-").pop(),
      revenue: inv.totalAmount / 1000000, // in Millions
      weight: inv.weightKg,
    }));

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Tài chính & Hóa đơn</h1>
          <p className={styles.pageSub}>
            Xem thống kê doanh thu bán sầu riêng và xuất hóa đơn giao dịch.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className={styles.actionBtn} onClick={handleExportCSV}>
            <FileDown size={15} /> Xuất báo cáo CSV
          </button>
          <button className={styles.actionBtn} style={{ background: "var(--accent)", color: "#000" }} onClick={() => setShowModal(true)}>
            <Plus size={15} /> Tạo hóa đơn mới
          </button>
        </div>
      </div>

      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statMeta}>
            <span className={styles.statLabel}>Tổng doanh thu</span>
            <span className={styles.statValue}>{totalRevenue.toLocaleString()} đ</span>
          </div>
          <div className={`${styles.statIcon} ${styles.greenIcon}`}>
            <DollarSign size={20} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statMeta}>
            <span className={styles.statLabel}>Sản lượng bán ra</span>
            <span className={styles.statValue}>{totalWeight.toLocaleString()} Kg</span>
          </div>
          <div className={`${styles.statIcon} ${styles.blueIcon}`}>
            <Scale size={20} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statMeta}>
            <span className={styles.statLabel}>Giá bán TB / Kg</span>
            <span className={styles.statValue}>{avgPrice.toLocaleString()} đ</span>
          </div>
          <div className={`${styles.statIcon} ${styles.amberIcon}`}>
            <TrendingUp size={20} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statMeta}>
            <span className={styles.statLabel}>Khoản chờ thu</span>
            <span className={styles.statValue}>{pendingAmount.toLocaleString()} đ</span>
          </div>
          <div className={`${styles.statIcon} ${styles.redIcon}`}>
            <Receipt size={20} />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {/* Bar chart for revenue timeline */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Biểu đồ doanh thu giao dịch (Triệu VNĐ)</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={timeData}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart for grade revenue */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Doanh thu theo phân loại</h3>
          <div style={{ width: "100%", height: 200, display: "flex", justifyContent: "center" }}>
            <ResponsiveContainer width="80%" height="100%">
              <PieChart>
                <Pie
                  data={gradeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {gradeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => `${val.toLocaleString()} đ`}
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: "11px", marginTop: "12px" }}>
            {gradeStats.map((stat, idx) => (
              <div key={stat.name} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: COLORS[idx % COLORS.length],
                  }}
                />
                <span style={{ color: "var(--text-muted)" }}>{stat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Danh sách hóa đơn bán hàng</h3>
          <div style={{ position: "relative", width: "240px" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              className={styles.input}
              style={{ paddingLeft: "34px", height: "36px" }}
              placeholder="Tìm khách hàng, số HĐ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Số hóa đơn</th>
                <th>Khách hàng</th>
                <th>Ngày tạo</th>
                <th>Khối lượng</th>
                <th>Phân loại</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className={styles.invoiceId}>{inv.id}</td>
                  <td className={styles.customer}>{inv.customerName}</td>
                  <td>{inv.date}</td>
                  <td>{inv.weightKg.toLocaleString()} Kg</td>
                  <td>
                    <span
                      style={{
                        fontFamily: "Sora",
                        fontWeight: 700,
                        color:
                          inv.grade === "A" ? "#10b981" : inv.grade === "B" ? "#3b82f6" : "#f59e0b",
                      }}
                    >
                      Loại {inv.grade}
                    </span>
                  </td>
                  <td>{inv.unitPrice.toLocaleString()} đ</td>
                  <td style={{ fontWeight: 700 }}>{inv.totalAmount.toLocaleString()} đ</td>
                  <td>
                    <span className={`${styles.badge} ${styles[inv.status]}`}>
                      {inv.status === "paid" ? "Đã trả" : "Chờ thu"}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <button
                      className={styles.actionIconBtn}
                      onClick={() => handleExportPDF(inv)}
                      title="In hóa đơn"
                    >
                      <FileText size={13} />
                    </button>
                    <button
                      className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDelete(inv.id)}
                      title="Xóa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Không tìm thấy hóa đơn phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice creation modal */}
      {showModal && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Tạo hóa đơn sầu riêng mới</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className={styles.formBody}>
                <div className={styles.field}>
                  <label>Tên khách hàng / Đơn vị mua</label>
                  <input
                    className={styles.input}
                    required
                    placeholder="VD: Vựa sầu riêng miền Tây"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Khối lượng (Kg)</label>
                    <input
                      className={styles.input}
                      required
                      type="number"
                      placeholder="VD: 500"
                      value={form.weightKg}
                      onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Phân loại sầu riêng</label>
                    <select
                      className={styles.input}
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value as "A" | "B" | "C" })}
                    >
                      <option value="A">Loại A (Đẹp / xuất khẩu)</option>
                      <option value="B">Loại B (Chất lượng khá)</option>
                      <option value="C">Loại C (Chợ / chế biến)</option>
                    </select>
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Đơn giá mỗi Kg (VNĐ)</label>
                    <input
                      className={styles.input}
                      required
                      type="number"
                      placeholder="VD: 95000"
                      value={form.unitPrice}
                      onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Trạng thái thanh toán</label>
                    <select
                      className={styles.input}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as "paid" | "pending" })}
                    >
                      <option value="paid">Đã thanh toán ngay</option>
                      <option value="pending">Ghi nợ (Chờ thu)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Tạo hóa đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
