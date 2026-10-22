import { requireUser } from "@/lib/auth";
import { Flash, PageHeader, one, type SP } from "@/components/ui";
import { gantiPasswordSendiri } from "./actions";

export default async function AkunPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Ganti Password" desc={`Akun: ${user.username} (${user.nama})`} />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />
      <form action={gantiPasswordSendiri} className="card max-w-md space-y-3">
        <div className="space-y-1">
          <label>Password lama</label>
          <input name="lama" type="password" required className="w-full" autoComplete="current-password" />
        </div>
        <div className="space-y-1">
          <label>Password baru (min. 3 karakter)</label>
          <input name="baru" type="password" required minLength={3} className="w-full" autoComplete="new-password" />
        </div>
        <div className="space-y-1">
          <label>Ulangi password baru</label>
          <input name="ulang" type="password" required minLength={3} className="w-full" autoComplete="new-password" />
        </div>
        <button className="btn">Simpan</button>
      </form>
    </>
  );
}
