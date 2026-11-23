import Link from "next/link";

export function AdminNav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin" className="display text-2xl text-primary">
          TRAPMAS ADMIN
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/submissions">Submissions</Link>
          <Link href="/admin/settings">Settings</Link>
          <Link href="/">Public page</Link>
          <form action="/api/admin/logout" method="post">
            <button className="text-muted-foreground" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
