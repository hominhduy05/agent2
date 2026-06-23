import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Loader, Lock, Leaf, Sprout, BarChart3, ShieldCheck } from "lucide-react";
import { login, getToken } from "@/lib/api";
import { useAuth } from "@/components/dashboard/AuthProvider";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login: doLogin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken() && user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await login(username.trim(), password);
      doLogin(data.access_token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — agriculture branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between relative overflow-hidden bg-[#0d2010] p-10">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="leaf-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M40 10 Q60 30 40 50 Q20 30 40 10Z" fill="white" opacity="0.3"/>
                <circle cx="40" cy="60" r="3" fill="white" opacity="0.2"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
          </svg>
        </div>

        {/* Top logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" fill="currentColor"/>
              <path d="M21 9H15V22H9V9H3L12 2L21 9Z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <span className="font-bold text-white text-2xl tracking-tight font-sora">DurianPro</span>
            <p className="text-brand-400/60 text-xs font-normal">Smart Agriculture</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative">
          {/* Decorative fruit icon */}
          <div className="mb-8 inline-flex">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-brand-500/20 border border-brand-500/20 flex items-center justify-center">
                <Leaf size={36} className="text-brand-300" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-harvest-400/80 border-2 border-[#0d2010] flex items-center justify-center">
                <Sprout size={12} className="text-[#0d2010]" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight mb-4 font-sora">
            Quản lý năng suất<br />
            kiểm tra sầu riêng
          </h1>
          <p className="text-sm text-brand-200/70 leading-relaxed max-w-sm mb-8">
            Hệ thống AI phân tích chất lượng sầu riêng kết hợp dashboard theo dõi KPI cho doanh nghiệp nông nghiệp thông minh.
          </p>

          {/* Feature list */}
          <ul className="mt-6 space-y-3">
            {[
              { icon: <BarChart3 size={16} />, title: "Dashboard KPI", desc: "Theo dõi năng suất thời gian thực" },
              { icon: <ShieldCheck size={16} />, title: "Phát hiện YOLOv8", desc: "Chính xác, tốc độ nhanh" },
              { icon: <Leaf size={16} />, title: "Truy xuất nguồn gốc", desc: "MES theo chuẩn Level 3" },
            ].map((f) => (
              <li key={f.title} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex-shrink-0 border border-brand-500/20">
                  {f.icon}
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{f.title}</span>
                  <span className="text-sm text-brand-200/60 ml-1.5">— {f.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between">
          <p className="text-xs text-brand-400/40">
            YOLOv8 · FastAPI · Next.js
          </p>
          <p className="text-xs text-brand-400/40">
            DurianPro v1.0
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col justify-center flex-1 lg:w-1/2 w-full px-6 py-12 sm:px-10 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md mx-auto">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
              <Leaf size={18} />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-xl tracking-tight font-sora">DurianPro</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-4">
              <Lock size={12} />
              Đăng nhập hệ thống
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1 font-sora">
              Chào mừng trở lại
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Đăng nhập để truy cập dashboard nông nghiệp thông minh
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-error-500/30 bg-error-50/50 dark:border-error-500/30 dark:bg-error-500/10 p-4">
              <AlertTriangle className="text-error-500 flex-shrink-0" size={18} />
              <p className="text-sm font-medium text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                disabled={loading}
                className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 pr-12 text-sm text-gray-900 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-brand-500/40"
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Default credentials hint */}
          <div className="mt-6 p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-1.5">Tài khoản mặc định</p>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">admin</span>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">admin123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
