'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('remember_email');
    const savedPassword = localStorage.getItem('remember_password');

    if (savedEmail) setEmail(savedEmail);
    if (savedPassword) setPassword(savedPassword);

    if (savedEmail || savedPassword) {
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (response.ok) {
        if (rememberMe) {
          localStorage.setItem('remember_email', email);
          localStorage.setItem('remember_password', password);
        } else {
          localStorage.removeItem('remember_email');
          localStorage.removeItem('remember_password');
        }

        router.push('/scada');
      } else {
        setError('Sai tài khoản hoặc mật khẩu');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ');
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6">
      {/* Grid */}
      <div
        className="
        absolute inset-0 opacity-30
        bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
        bg-[size:40px_40px]
      "
      />

      {/* Glow */}
      <div className="absolute left-0 top-0 h-96 w-96 bg-cyan-500/10 blur-[140px]" />
      <div className="absolute right-0 bottom-0 h-96 w-96 bg-blue-500/10 blur-[140px]" />

      <div
        className="
        relative z-10
        w-full
        max-w-md
        border
        border-slate-800
        bg-slate-900/80
        backdrop-blur-xl
      "
      >
        {/* Header */}
        <div className="border-b border-slate-800 p-8">
          <div className="flex items-center gap-2 text-xs text-cyan-400">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            SYSTEM ONLINE
          </div>

          <h1 className="mt-4 text-3xl font-bold text-white">Đăng nhập</h1>

          <p className="mt-2 text-sm text-slate-400">
            Hệ thống giám sát Camera AI & SCADA
          </p>
        </div>

        {/* Body */}
        <div className="p-8">
          {error && (
            <div className="mb-5 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Tài khoản
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập tài khoản"
                className="
                h-12
                w-full
                border
                border-slate-700
                bg-[#020617]
                px-4
                text-white
                outline-none
                transition
                focus:border-cyan-500
              "
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Mật khẩu
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="
                  h-12
                  w-full
                  border
                  border-slate-700
                  bg-[#020617]
                  px-4
                  pr-12
                  text-white
                  outline-none
                  transition
                  focus:border-cyan-500
                "
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                  absolute
                  right-4
                  top-1/2
                  -translate-y-1/2
                  text-slate-500
                "
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-cyan-500"
              />
              Ghi nhớ đăng nhập
            </label>

            <button
              type="submit"
              disabled={loading}
              className="
              h-12
              w-full
              bg-cyan-600
              font-semibold
              text-white
              transition
              hover:bg-cyan-500
              disabled:opacity-50
            "
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-8 py-4 text-xs text-slate-500">
          SCADA Monitoring System v1.0
        </div>
      </div>
    </div>
  );
}
