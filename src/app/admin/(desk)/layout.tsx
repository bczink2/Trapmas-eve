import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/nav";
import { getSession } from "@/lib/auth/session";
import { macLink } from "@/lib/mac/registry";
import { usesMacStorage } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return (
    <>
      <AdminNav />
      {usesMacStorage() && !macLink().online ? (
        <p className="bg-destructive px-4 py-3 text-center text-sm text-white">Mac offline. Submissions, files, and settings pause until BC&apos;s Mac checks in.</p>
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </>
  );
}
