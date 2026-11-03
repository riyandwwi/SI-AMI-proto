import { LoginForm } from "./LoginForm";
import { one, type SP } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const err = one((await searchParams).err);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] p-4 text-slate-900">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-extrabold text-white shadow-sm">
            AMI
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">SI-AMI ITBMP</h1>
          <p className="text-xs font-medium text-slate-500">
            Sistem Informasi Audit Mutu Internal Kampus ITBMP
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-4">
          <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            Masuk ke Akun Anda
          </h2>
          <LoginForm initialError={err} />
        </div>
      </div>
    </div>
  );
}
