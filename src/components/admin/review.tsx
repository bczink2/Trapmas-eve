"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/money";
import { STATUS_LABELS, type Submission, type SubmissionStatus } from "@/lib/types";

type Detail = {
  submission: Submission;
  notes: { id: string; body: string; createdAt: string }[];
  events: { id: string; fromStatus: string; toStatus: string; actor: string; note: string; createdAt: string }[];
  emails: { id: string; template: string; status: string; subject: string; createdAt: string }[];
  media: { photoUrl: string; song1Url: string; song2Url: string };
};

export function Review({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("25.00");
  const [reference, setReference] = useState("");
  const [decision, setDecision] = useState<"approved" | "waitlisted" | "declined" | null>(null);
  const [message, setMessage] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundNote, setRefundNote] = useState("Sent the refund in Cash App.");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch(`/api/admin/submissions/${id}`);
    if (!response.ok) {
      setError("Could not open this submission.");
      return;
    }
    const body = (await response.json()) as Detail;
    setDetail(body);
    if (body.submission.paidAmountCents) setAmount((body.submission.paidAmountCents / 100).toFixed(2));
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/submissions/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not open this submission.");
        return (await response.json()) as Detail;
      })
      .then((body) => {
        if (cancelled) return;
        setDetail(body);
        if (body.submission.paidAmountCents) setAmount((body.submission.paidAmountCents / 100).toFixed(2));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not open this submission.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "That action failed.");
      return false;
    }
    await load();
    return true;
  }

  if (!detail && !error) return <p>Loading submission…</p>;
  if (!detail) return <p className="text-destructive">{error}</p>;
  const submission = detail.submission;
  const hasEmail = Boolean(submission.email.trim());

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/admin/submissions" className="text-primary">
          All submissions
        </Link>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-5xl">{submission.publicId}</h1>
          <p className="text-lg">{submission.artistName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{STATUS_LABELS[submission.status as SubmissionStatus] || submission.status}</Badge>
          <Badge variant="secondary">
            {submission.fileHold === "computer"
              ? "Saved to computer"
              : submission.fileHold === "drive"
                ? "In Google Drive"
                : submission.fileHold === "pending"
                  ? "Pending in Google Drive"
                  : "On the server"}
          </Badge>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          {submission.fileHold === "computer" && !submission.photoKey.startsWith("mac/") && !submission.song1Key.startsWith("mac/") ? (
            <p className="rounded-2xl border border-primary/40 bg-card p-4">Saved to computer. Playback stays on your machine.</p>
          ) : (
            <>
              {detail.media.photoUrl ? (
                <img src={detail.media.photoUrl} alt={`Photo of ${submission.artistName}`} className="max-h-96 w-full rounded-2xl object-contain" />
              ) : (
                <p className="text-muted-foreground">No photo uploaded.</p>
              )}
              <Audio title={submission.song1Title || "Song 1"} src={detail.media.song1Url} />
              <Audio title={submission.song2Title || "Song 2"} src={detail.media.song2Url} />
              <a className="inline-block rounded-lg bg-primary px-4 py-3 text-primary-foreground" href={`/api/admin/submissions/${submission.id}/download`}>
                Download all
              </a>
            </>
          )}
          <div className="rounded-2xl border border-primary/40 bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-primary">Phone</p>
            <p className="text-2xl">{submission.phone || "No phone on file"}</p>
            {hasEmail ? (
              <p className="text-sm text-muted-foreground">{submission.email}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No email on file. Contact this artist by phone.</p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Legal name" value={submission.legalName} />
            <Info label="Email" value={submission.email} />
            <Info label="Phone" value={submission.phone} />
            <Info label="City" value={[submission.city, submission.state].filter(Boolean).join(", ")} />
            <Info label="Genre" value={submission.genre} />
            <Info label="Instagram" value={submission.instagram} />
            <Info label="Paid from" value={submission.payerName} />
            <Info label="Payment note" value={submission.paymentNote} />
            <Info label="Paid at" value={submission.paidAt} />
            <Info label="Paid by" value={submission.paidBy} />
            <Info label="Amount" value={submission.paidAmountCents ? formatUsd(submission.paidAmountCents) : ""} />
            <Info label="Reference" value={submission.paymentReference} />
          </dl>
          {submission.bio ? <p className="whitespace-pre-wrap text-sm">{submission.bio}</p> : null}
          {submission.organizerNote ? <p className="text-sm text-muted-foreground">Note: {submission.organizerNote}</p> : null}
        </section>
        <section className="space-y-4">
          {!submission.paidAt && submission.status !== "refunded" ? (
            <form
              className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
              onSubmit={async (event) => {
                event.preventDefault();
                const cents = Math.round(Number(amount) * 100);
                await post(`/api/admin/submissions/${id}/paid`, { amountCents: cents, reference });
              }}
            >
              <h2 className="text-lg">Mark paid</h2>
              <p className="text-sm text-muted-foreground">
                {hasEmail
                  ? "Records who, when, the amount, and your reference. Then sends the confirmation email."
                  : `Records who, when, the amount, and your reference. No email is on file, so no confirmation is sent. Call or text ${submission.phone || "the artist"}.`}
              </p>
              <Label htmlFor="amount">Amount received</Label>
              <Input id="amount" value={amount} onChange={(event) => setAmount(event.target.value)} className="bg-black/25" />
              <Label htmlFor="reference">Cash App reference or note</Label>
              <Input id="reference" value={reference} onChange={(event) => setReference(event.target.value)} className="bg-black/25" required />
              <Button type="submit" disabled={busy}>
                {hasEmail ? "Mark paid and send confirmation" : "Mark paid"}
              </Button>
            </form>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setDecision("approved")}>Approve</Button>
            <Button type="button" variant="secondary" onClick={() => setDecision("waitlisted")}>Waitlist</Button>
            <Button type="button" variant="outline" onClick={() => setDecision("declined")}>Decline</Button>
            <Button type="button" variant="outline" onClick={() => setRefundOpen(true)}>Mark refunded</Button>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
          </div>
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await post(`/api/admin/submissions/${id}/notes`, { body: note });
              if (ok) setNote("");
            }}
          >
            <Label htmlFor="internal-note">Internal note</Label>
            <Textarea id="internal-note" value={note} onChange={(event) => setNote(event.target.value)} className="bg-black/25" />
            <Button type="submit" variant="outline" disabled={busy}>Save note</Button>
          </form>
          <div className="space-y-2 text-sm">
            {detail.notes.map((item) => (
              <p key={item.id} className="rounded-lg bg-card p-2">{item.body}</p>
            ))}
          </div>
          <h2 className="text-lg">Status history</h2>
          <ol className="space-y-2 text-sm">
            {detail.events.map((event) => (
              <li key={event.id}>
                <span className="text-primary">{event.toStatus}</span> · {event.actor} · {event.createdAt}
                {event.note ? <span className="block text-muted-foreground">{event.note}</span> : null}
              </li>
            ))}
          </ol>
          <h2 className="text-lg">Emails</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {detail.emails.length === 0 ? <li>No emails yet.</li> : null}
            {detail.emails.map((email) => (
              <li key={email.id}>{email.template}: {email.status} — {email.subject}</li>
            ))}
          </ul>
        </section>
      </div>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasEmail ? `Send the ${decision} email?` : `Save the ${decision} decision?`}</DialogTitle>
            <DialogDescription>
              {hasEmail
                ? `This updates ${submission.publicId} and emails ${submission.email}. Nothing is sent until you confirm.`
                : `This updates ${submission.publicId}. No email is on file, so nothing is emailed. Reach ${submission.artistName} at ${submission.phone || "the phone number on file"}.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional note included in the email" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!decision) return;
                const ok = await post(`/api/admin/submissions/${id}/decision`, { decision, message });
                if (ok) setDecision(null);
              }}
            >
              {hasEmail ? "Send email" : "Save decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark refunded</DialogTitle>
            <DialogDescription>
              Send the money back in Cash App first. This only records that you did it.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await post(`/api/admin/submissions/${id}/refund`, { note: refundNote });
                if (ok) setRefundOpen(false);
              }}
            >
              Mark refunded
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {submission.publicId}</DialogTitle>
            <DialogDescription>This deletes the songs, the photo, and the application. Type the id to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder={submission.publicId} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || deleteText !== submission.publicId}
              onClick={async () => {
                setBusy(true);
                const response = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
                setBusy(false);
                if (response.ok) window.location.href = "/admin/submissions";
                else setError("Could not delete the submission.");
              }}
            >
              Delete files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Audio({ title, src }: { title: string; src: string }) {
  return (
    <div>
      <p className="mb-1 text-sm">{title}</p>
      {src ? <audio controls preload="metadata" src={src} className="w-full" /> : <p className="text-sm text-muted-foreground">No file.</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
