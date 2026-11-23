"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ showDevHint }: { showDevHint: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        if (!response.ok) {
          setError(body.error || "Could not sign in.");
          return;
        }
        router.push("/admin");
        router.refresh();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11 bg-black/25"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {showDevHint ? (
        <p className="text-sm text-muted-foreground">
          Local password until you set ADMIN_PASSWORD: trapmas-dev
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy ? "Checking" : "Sign in"}
      </Button>
    </form>
  );
}
