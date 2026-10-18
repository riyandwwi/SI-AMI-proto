import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";

export default async function Home() {
  const s = await getSession();
  redirect(s ? ROLE_HOME[s.role] : "/login");
}
