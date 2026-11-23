import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/nav";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return (
    <>
      <AdminNav />
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </>
  );
}
