import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="display text-2xl leading-none text-primary">
        TRAPMAS EVE
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/#apply" className="text-foreground/90">
          Apply
        </Link>
        <Link href="/admin" className="text-muted-foreground">
          Admin
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-5xl space-y-3 px-4 pb-28 text-sm text-muted-foreground md:pb-10">
      <p>Greensboro, Alabama</p>
      <nav className="flex flex-wrap gap-4">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refund">Refunds</Link>
      </nav>
    </footer>
  );
}
