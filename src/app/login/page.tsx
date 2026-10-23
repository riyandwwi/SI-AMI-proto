import { LoginForm } from "./LoginForm";
import { one, type SP } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const err = one((await searchParams).err);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7EE] p-4 text-[#121212]">
      <div className="w-full max-w-md space-y-5">
        {/* Header Hero Neo-Brutalism */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-3 border-black bg-[#FF5C38] text-xl font-black text-white shadow-[4px_4px_0px_#000000]">
            AMI
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black">SI-AMI ITBMP</h1>
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">
            Sistem Audit Mutu Internal Kampus ITBMP
          </p>
        </div>

        {/* Card Login */}
        <div className="rounded-3xl border-3 border-black bg-white p-7 shadow-[8px_8px_0px_#000000] space-y-4">
          <div className="border-b-2 border-black pb-3">
            <h2 className="text-xl font-black text-black">Masuk ke Akun Anda 👋</h2>
            <p className="text-xs font-semibold text-slate-600">
              Gunakan username dan password yang diberikan Super Admin / LPM.
            </p>
          </div>
          <LoginForm initialError={err} />
        </div>

        {/* Petunjuk Bawah */}
        <div className="rounded-2xl border-2 border-black bg-[#FEF08A] p-3 text-center text-xs font-black shadow-[3px_3px_0px_#000000]">
          💡 Akun awal LPM, Auditor, dan Auditee memakai password default: <code className="rounded bg-black px-1.5 py-0.5 text-white">123</code>
        </div>
      </div>
    </div>
  );
}
