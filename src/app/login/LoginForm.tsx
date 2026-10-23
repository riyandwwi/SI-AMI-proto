"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: initialError });
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-xl border-2 border-black bg-[#FECDD3] px-3.5 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000000]">
          ⚠️ {state.error}
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="Username..."
          className="w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password..."
          className="w-full"
        />
      </div>
      <button className="btn w-full py-3 text-base shadow-[4px_4px_0px_#000000]" disabled={pending}>
        {pending ? "Memproses..." : "Masuk →"}
      </button>
    </form>
  );
}
