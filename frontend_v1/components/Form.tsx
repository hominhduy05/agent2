'use client';

import { useState } from 'react';

export default function LoginForm({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      method="POST"
      action="/api/login"
      className="space-y-5"
      onSubmit={() => setPending(true)}
    >
      {children}

      <button
        type="submit"
        disabled={pending}
        className={`h-12 w-full font-semibold text-white transition
          ${
            pending
              ? 'cursor-not-allowed bg-cyan-800'
              : 'bg-cyan-600 hover:bg-cyan-500'
          }`}
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Đang đăng nhập...
          </span>
        ) : (
          'Đăng nhập'
        )}
      </button>
    </form>
  );
}
