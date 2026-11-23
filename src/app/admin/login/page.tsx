import { LoginForm } from "@/components/admin/login-form";

export default function LoginPage() {
  const showDevHint = process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <h1 className="display text-5xl text-primary">Admin</h1>
      <p className="mt-2 text-muted-foreground">Barryel Watkins&apos; submission desk. Artists do not get accounts.</p>
      <LoginForm showDevHint={showDevHint} />
    </main>
  );
}
