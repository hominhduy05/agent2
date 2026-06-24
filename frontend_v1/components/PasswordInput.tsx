'use client';

import { useState } from 'react';

import {
  Eye,
  EyeOff,
} from 'lucide-react';

type Props = {
  defaultValue?: string;
};

export default function PasswordInput({
  defaultValue = '',
}: Props) {
  const [show, setShow] =
    useState(false);

  return (
    <div className="relative">
      <input
        name="password"
        type={
          show
            ? 'text'
            : 'password'
        }
        autoComplete="current-password"
        defaultValue={defaultValue}
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
          transition-all
          duration-200
          focus:border-cyan-500
          focus:shadow-[0_0_0_1px_rgba(6,182,212,.4)]
        "
        required
      />

      <button
        type="button"
        aria-label={
          show
            ? 'Ẩn mật khẩu'
            : 'Hiện mật khẩu'
        }
        onClick={() =>
          setShow((v) => !v)
        }
        className="
          absolute
          right-3
          top-1/2
          flex
          h-8
          w-8
          -translate-y-1/2
          items-center
          justify-center
          rounded-md
          text-slate-400
          transition-all
          duration-200
          hover:bg-slate-800
          hover:text-cyan-400
          focus:outline-none
          focus:ring-2
          focus:ring-cyan-500/40
        "
      >
        {show ? (
          <EyeOff size={18} />
        ) : (
          <Eye size={18} />
        )}
      </button>
    </div>
  );
}