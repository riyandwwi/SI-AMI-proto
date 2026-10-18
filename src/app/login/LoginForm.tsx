"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: initialError });
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      <div className="space-y-1">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" required className="w-full" />
      </div>
      <div className="space-y-1">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full" />
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Memproses..." : "Masuk"}
      </button>
      <p className="text-center text-xs text-slate-500">Lupa password? Hubungi Super Admin untuk melihat atau mereset password Anda.</p>
    </form>
  );
}
