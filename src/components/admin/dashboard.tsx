"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/money";
import { STATUS_LABELS, type SubmissionStatus } from "@/lib/types";

type Row = {
  id: string;
  publicId: string;
  artistName: string;
  email: string;
  status: SubmissionStatus;
  fileHold?: "disk" | "pending" | "drive" | "computer";
};

type Payload = {
  rows: Row[];
  stats: { byStatus: Record<string, number>; total: number; revenueCents: number; refundedCents: number };
  applicationsOpen: boolean;
  feeCents: number;
};

export function Dashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/submissions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the desk.");
        setData((await response.json()) as Payload);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load."));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p>Loading the desk…</p>;
  const pending = data.stats.byStatus.payment_pending || 0;
  const waiting = data.stats.byStatus.awaiting_payment || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-5xl">Overview</h1>
        <p className="text-muted-foreground">
          Applications are {data.applicationsOpen ? "open" : "closed"}. Fee {formatUsd(data.feeCents)}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Submissions" value={String(data.stats.total)} />
        <Stat label="Payment pending" value={String(pending)} />
        <Stat label="Left at payment" value={String(waiting)} />
        <Stat label="Confirmed fees" value={formatUsd(data.stats.revenueCents)} />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(data.stats.byStatus).map(([status, count]) => (
          <Link key={status} href={`/admin/submissions?status=${status}`} className="rounded-full bg-card px-3 py-1 ring-1 ring-border">
            {STATUS_LABELS[status as SubmissionStatus] || status}: {count}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Refunds recorded: {formatUsd(data.stats.refundedCents)}. Cash App refunds are sent by you, then marked here.
      </p>
      <section className="space-y-2">
        <h2 className="text-lg">Latest submissions</h2>
        {data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-border">
            {data.rows.slice(0, 8).map((row) => (
              <li key={row.id}>
                <Link href={`/admin/submissions/${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="text-primary">{row.publicId}</span> {row.artistName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {STATUS_LABELS[row.status] || row.status}
                    {row.fileHold === "computer"
                      ? " · Saved to computer"
                      : row.fileHold === "drive" || row.fileHold === "pending"
                        ? " · In Google Drive"
                        : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href="/admin/submissions" className="inline-block rounded-lg bg-primary px-4 py-3 text-primary-foreground">
        Review submissions
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="text-xs uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-1 text-2xl">{value}</p>
    </article>
  );
}
