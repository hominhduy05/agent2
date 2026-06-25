import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./app/login/page";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AdminLayout from "./components/layout/AdminLayout";

// Dashboard sub-pages
import DashboardPage from "./app/dashboard/page";
import DashboardHistoryPage from "./app/dashboard/history/page";
import DashboardEmployeesPage from "./app/dashboard/employees/page";
import DashboardReportsPage from "./app/dashboard/reports/page";
import DashboardSettingsPage from "./app/dashboard/settings/page";
import DashboardAccountingPage from "./app/dashboard/accounting/page";

// Other section pages
import DatasetPage from "./app/dataset/page";
import HomePage from "./app/page";
import MesLayout from "./app/mes/layout";
import ScadaLayout from "./app/scada/layout";

function DashboardLayout() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="history" element={<DashboardHistoryPage />} />
          <Route path="employees" element={<DashboardEmployeesPage />} />
          <Route path="reports" element={<DashboardReportsPage />} />
          <Route path="settings" element={<DashboardSettingsPage />} />
          <Route path="accounting" element={<DashboardAccountingPage />} />
        </Routes>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function DatasetLayout() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <DatasetPage />
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard/*" element={<DashboardLayout />} />
      <Route path="/scada/*" element={<ScadaLayout />} />
      <Route path="/mes/*" element={<MesLayout />} />
      <Route path="/dataset" element={<DatasetLayout />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard-old" element={<HomePage />} />
    </Routes>
  );
}
