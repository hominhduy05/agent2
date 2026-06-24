import LoginForm from '@/components/Form';
import LoginEnhancer from '@/components/LoginEnhancer';
import PasswordInput from '@/components/PasswordInput';

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    email?: string;
    password?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  const error = params?.error;
  const email = params?.email;
  const password = params?.password;

  return (
    <>
      <LoginEnhancer />

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />

        <div className="absolute left-0 top-0 h-96 w-96 bg-cyan-500/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 bg-blue-500/10 blur-[140px]" />

        <div className="relative z-10 w-full max-w-md border border-slate-800 bg-slate-900/80 backdrop-blur-xl">
          <div className="border-b border-slate-800 p-8">
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              SYSTEM ONLINE
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              Đăng nhập
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Hệ thống giám sát Camera AI & SCADA
            </p>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-5 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                Sai tài khoản hoặc mật khẩu
              </div>
            )}

            <LoginForm>
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Tài khoản
                </label>

                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue={email ?? ''}
                  placeholder="Nhập tài khoản"
                  className="h-12 w-full border border-slate-700 bg-[#020617] px-4 text-white outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Mật khẩu
                </label>

                <PasswordInput
                  defaultValue={
                    password ??
                    'AICamera@2026'
                  }
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-400">
                <input
                  type="checkbox"
                  name="remember"
                  className="accent-cyan-500"
                />
                Ghi nhớ đăng nhập
              </label>
            </LoginForm>
          </div>

          <div className="border-t border-slate-800 px-8 py-4 text-xs text-slate-500">
            SCADA Monitoring System v1.0
          </div>
        </div>
      </div>
    </>
  );
}