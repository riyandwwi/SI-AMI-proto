import { LoginForm } from "./LoginForm";
import { one, type SP } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const err = one((await searchParams).err);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">AMI</div>
          <h1 className="text-xl font-bold text-slate-900">SI-AMI ITBMP</h1>
          <p className="text-sm text-slate-500">Sistem Audit Mutu Internal</p>
        </div>
        <div className="card">
          <LoginForm initialError={err} />
        </div>
      </div>
    </div>
  );
}
