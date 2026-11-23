"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, STATUSES, type SubmissionStatus } from "@/lib/types";

type Row = {
  id: string;
  publicId: string;
  artistName: string;
  email: string;
  phone: string;
  status: SubmissionStatus;
  genre: string;
  createdAt: string;
  payerName: string;
};

export function SubmissionsTable() {
  const initial = useSearchParams().get("status") || "";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initial);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/submissions?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load submissions.");
          const body = (await response.json()) as { rows: Row[] };
          setRows(body.rows);
          setError("");
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load."))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, status]);

  return (
    <div className="space-y-4">
      <h1 className="display text-5xl">Submissions</h1>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          placeholder="Search name, phone, email, TRAP id, Cash App"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="h-11 bg-black/25"
        />
        <select
          className="h-11 rounded-lg border border-input bg-black/25 px-3"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABELS[item]}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-destructive">{error}</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">
          No submissions match. New artist drafts and payment claims show up here.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/submissions/${row.id}`} className="text-primary">
                    {row.publicId}
                  </Link>
                </TableCell>
                <TableCell>{row.artistName}</TableCell>
                <TableCell className="font-medium">{row.phone || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{STATUS_LABELS[row.status] || row.status}</Badge>
                </TableCell>
                <TableCell>{row.email || "No email"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <Button asChild variant="outline">
        <Link href="/admin">Back to overview</Link>
      </Button>
    </div>
  );
}
