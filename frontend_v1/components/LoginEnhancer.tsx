'use client';

import { useEffect } from 'react';

export default function LoginEnhancer() {
  useEffect(() => {
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[name="email"]'
    );

    const rememberInput = document.querySelector<HTMLInputElement>(
      'input[name="remember"]'
    );

    const form = document.querySelector<HTMLFormElement>('form');

    const savedEmail = localStorage.getItem('remember_email');

    if (savedEmail && emailInput && emailInput.value === '') {
      emailInput.value = savedEmail;

      if (rememberInput) {
        rememberInput.checked = true;
      }
    }

    if (!form) return;

    const handleSubmit = () => {
      if (rememberInput?.checked && emailInput?.value) {
        localStorage.setItem('remember_email', emailInput.value);
      } else {
        localStorage.removeItem('remember_email');
      }
    };

    form.addEventListener('submit', handleSubmit);

    return () => {
      form.removeEventListener('submit', handleSubmit);
    };
  }, []);

  return null;
}
