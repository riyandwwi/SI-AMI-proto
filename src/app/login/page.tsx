import { LoginForm } from "./LoginForm";
import { one, type SP } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const err = one((await searchParams).err);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7EE] p-4 text-[#121212]">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-3 border-black bg-[#FF5C38] text-xl font-black text-white shadow-[4px_4px_0px_#000000]">
            AMI
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black">SI-AMI ITBMP</h1>
        </div>

        <div className="rounded-3xl border-3 border-black bg-white p-7 shadow-[8px_8px_0px_#000000] space-y-4">
          <h2 className="border-b-2 border-black pb-3 text-xl font-black text-black">Masuk</h2>
          <LoginForm initialError={err} />
        </div>
      </div>
    </div>
  );
}
