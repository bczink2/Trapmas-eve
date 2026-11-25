"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatUsd } from "@/lib/money";
import { parseProfile } from "@/lib/profile";
import type { PublicSettings } from "@/lib/types";

type FileMeta = { name: string; bytes: number } | null;

type Application = {
  id: string;
  publicId: string;
  status: string;
  artistName: string;
  legalName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  instagram: string;
  genre: string;
  bio: string;
  organizerNote: string;
  song1Title: string;
  song2Title: string;
  files: { photo: FileMeta; song1: FileMeta; song2: FileMeta };
  payerName: string;
  paymentNote: string;
};

type Instructions = {
  provider: string;
  amountCents: number;
  publicId: string;
  cashtag: string;
  cashtagReady: boolean;
  qrReady: boolean;
};

const STORAGE_KEY = "trapmas-resume";
const fieldClass = "h-11 bg-black/25 text-base md:text-base";

async function readError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || "Something went wrong. Try again.";
}

function uploadFile(url: string, file: File, kind: string, onProgress: (value: number) => void) {
  return new Promise<{ application: Application }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}") as { error?: string; application?: Application };
      if (xhr.status >= 200 && xhr.status < 300 && body.application) resolve({ application: body.application });
      else reject(new Error(body.error || "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("The upload dropped. Retry this file."));
    const joiner = url.includes("?") ? "&" : "?";
    xhr.open("POST", `${url}${joiner}kind=${encodeURIComponent(kind)}`);
    xhr.setRequestHeader("X-Filename", file.name);
    xhr.setRequestHeader("Content-Type", file.type || (kind === "photo" ? "image/jpeg" : "audio/mpeg"));
    xhr.send(file);
  });
}

export function ApplyWizard({
  settings,
  initialToken = "",
}: {
  settings: PublicSettings;
  initialToken?: string;
}) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState(initialToken);
  const [application, setApplication] = useState<Application | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [acks, setAcks] = useState({
    ackTerms: false,
    ackPrivacy: false,
    ackRefund: false,
    ackRights: false,
    ackPhoto: false,
    ackFee: false,
  });
  const [paidFrom, setPaidFrom] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [form, setForm] = useState({
    artistName: "",
    legalName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    instagram: "",
    genre: "",
    bio: "",
    organizerNote: "",
    song1Title: "",
    song2Title: "",
  });

  useEffect(() => {
    const stored = initialToken || window.localStorage.getItem(STORAGE_KEY) || "";
    if (!stored) return;
    const url = initialToken
      ? `/api/drafts/lookup?token=${encodeURIComponent(stored)}`
      : `/api/drafts/lookup?token=${encodeURIComponent(stored)}`;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { application: Application; instructions: Instructions };
        setToken(stored);
        setApplication(body.application);
        setInstructions(body.instructions);
        setForm({
          artistName: body.application.artistName,
          legalName: body.application.legalName,
          email: body.application.email,
          phone: body.application.phone,
          city: body.application.city,
          state: body.application.state,
          instagram: body.application.instagram,
          genre: body.application.genre,
          bio: body.application.bio,
          organizerNote: body.application.organizerNote,
          song1Title: body.application.song1Title,
          song2Title: body.application.song2Title,
        });
        setPaidFrom(body.application.payerName);
        setPaymentNote(body.application.paymentNote || body.application.publicId);
        if (body.application.status === "payment_pending" || body.application.status === "paid") setStep(5);
        else if (body.application.status === "awaiting_payment") setStep(4);
        else if (body.application.files.photo && body.application.files.song1 && body.application.files.song2) setStep(3);
        else setStep(2);
      })
      .catch(() => undefined);
  }, [initialToken]);

  const fee = formatUsd(settings.feeCents);
  const resumeLink = useMemo(() => {
    if (!token || typeof window === "undefined") return "";
    return `${window.location.origin}/apply/resume/${token}`;
  }, [token]);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile() {
    const parsed = parseProfile(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = application
        ? await fetch(`/api/drafts/${application.id}?token=${encodeURIComponent(token)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as {
        application: Application;
        resumeToken?: string;
        instructions: Instructions;
      };
      const nextToken = body.resumeToken || token;
      setToken(nextToken);
      window.localStorage.setItem(STORAGE_KEY, nextToken);
      setApplication(body.application);
      setInstructions(body.instructions);
      setPaymentNote((current) => current || body.application.publicId);
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the application.");
    } finally {
      setBusy(false);
    }
  }

  async function sendFile(kind: "photo" | "song1" | "song2", file: File) {
    if (!application) return;
    setError("");
    setProgress((current) => ({ ...current, [kind]: 0 }));
    try {
      const body = await uploadFile(
        `/api/drafts/${application.id}/files?token=${encodeURIComponent(token)}`,
        file,
        kind,
        (value) => setProgress((current) => ({ ...current, [kind]: value })),
      );
      setApplication(body.application);
      if (kind === "photo") {
        const url = URL.createObjectURL(file);
        setPreviews((current) => ({ ...current, photo: url }));
      }
      setProgress((current) => ({ ...current, [kind]: 1 }));
    } catch (cause) {
      setProgress((current) => ({ ...current, [kind]: -1 }));
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  }

  async function continueToAgreements() {
    if (!application?.files.photo || !application.files.song1 || !application.files.song2) {
      setError("Upload both MP3s and the photo before you continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/drafts/${application.id}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { application: Application };
      setApplication(body.application);
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the song titles.");
    } finally {
      setBusy(false);
    }
  }

  async function continueToPayment() {
    if (Object.values(acks).some((value) => !value)) {
      setError("Check every acknowledgment. The fee and the draft policies are part of the application.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const patch = await fetch(`/api/drafts/${application?.id}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acks),
      });
      if (!patch.ok) throw new Error(await readError(patch));
      const ready = await fetch(`/api/drafts/${application?.id}/ready?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!ready.ok) throw new Error(await readError(ready));
      const body = (await ready.json()) as { application: Application; instructions: Instructions };
      setApplication(body.application);
      setInstructions(body.instructions);
      setPaymentNote((current) => (current.includes(body.application.publicId) ? current : body.application.publicId));
      setStep(4);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open payment.");
    } finally {
      setBusy(false);
    }
  }

  async function claimPayment() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/drafts/${application?.id}/payment-claim?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidFrom, paymentNote }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { application: Application };
      setApplication(body.application);
      setStep(5);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the payment claim.");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/drafts/${application?.id}/checkout?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { url?: string };
      if (body.url) window.location.href = body.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout is not available.");
    } finally {
      setBusy(false);
    }
  }

  if (settings.macOnline === false) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="display text-3xl text-primary">Submissions are paused</h2>
        <p className="mt-2 text-muted-foreground">Submissions are paused for a moment, please try again in a few minutes.</p>
      </div>
    );
  }

  if (!settings.applicationsOpen && !application) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="display text-3xl text-primary">Submissions are closed</h2>
        <p className="mt-2 text-muted-foreground">
          Our team is not taking new applications or payments right now
          {settings.submissionDeadline ? ` (deadline was ${settings.submissionDeadline})` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {["Your info", "Songs and photo", "Agreements", "Cash App"].map((label, index) => (
          <li
            key={label}
            className={`rounded-full px-3 py-2 text-center ${step === index + 1 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <FeeNotice fee={fee} />
      {error ? (
        <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <Pair>
            <Field label="Real / full name" value={form.legalName} onChange={(value) => update("legalName", value)} required />
            <Field label="Phone" type="tel" value={form.phone} onChange={(value) => update("phone", value)} required />
          </Pair>
          <Field label="Artist / stage name" value={form.artistName} onChange={(value) => update("artistName", value)} required />
          <div className="grid gap-2">
            <Label htmlFor="genre">
              Genre <span className="text-primary">*</span>
            </Label>
            <select
              id="genre"
              required
              className={`${fieldClass} rounded-lg border border-input px-3`}
              value={form.genre}
              onChange={(event) => update("genre", event.target.value)}
            >
              <option value="">Select a genre</option>
              {settings.genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
          <Pair>
            <Field label="City" value={form.city} onChange={(value) => update("city", value)} required />
            <Field label="State" value={form.state} onChange={(value) => update("state", value)} required />
          </Pair>
          <Field label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} />
          <Field label="Instagram" value={form.instagram} onChange={(value) => update("instagram", value)} />
          <div className="grid gap-2">
            <Label htmlFor="bio">Short bio <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="bio" value={form.bio} onChange={(event) => update("bio", event.target.value)} className="min-h-24 bg-black/25" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Anything our team should know <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="note" value={form.organizerNote} onChange={(event) => update("organizerNote", event.target.value)} className="bg-black/25" />
          </div>
          <Button type="submit" size="lg" className="h-12" disabled={busy}>
            {busy ? "Saving" : "Continue to songs"}
          </Button>
        </form>
      ) : null}

      {step === 2 && application ? (
        <div className="space-y-4">
          <Field label="Song 1 title" value={form.song1Title} onChange={(value) => update("song1Title", value)} />
          <Uploader
            label="Song 1 MP3, 20 MB max"
            accept="audio/mpeg,.mp3"
            meta={application.files.song1}
            progress={progress.song1}
            onFile={(file) => void sendFile("song1", file)}
            required
          />
          <Field label="Song 2 title" value={form.song2Title} onChange={(value) => update("song2Title", value)} />
          <Uploader
            label="Song 2 MP3, 20 MB max"
            accept="audio/mpeg,.mp3"
            meta={application.files.song2}
            progress={progress.song2}
            onFile={(file) => void sendFile("song2", file)}
            required
          />
          <Uploader
            label="Photo, JPG or PNG, 10 MB max"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            meta={application.files.photo}
            progress={progress.photo}
            onFile={(file) => void sendFile("photo", file)}
            required
          />
          {previews.photo ? (
            <img src={previews.photo} alt="Preview of your submitted photo" className="max-h-72 w-full rounded-xl object-contain" />
          ) : application.files.photo ? (
            <img
              src={`/api/drafts/${application.id}/file/photo?token=${encodeURIComponent(token)}`}
              alt="Uploaded photo"
              className="max-h-72 w-full rounded-xl object-contain"
            />
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" className="h-11 flex-1" disabled={busy} onClick={() => void continueToAgreements()}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Ack
            id="ack-terms"
            checked={acks.ackTerms}
            onChange={(value) => setAcks((current) => ({ ...current, ackTerms: value }))}
            text="I agree to the draft Terms. A payment confirmation is not a booked slot."
          />
          <Ack
            id="ack-privacy"
            checked={acks.ackPrivacy}
            onChange={(value) => setAcks((current) => ({ ...current, ackPrivacy: value }))}
            text="I agree to the draft Privacy note. My songs and photo stay private for review."
          />
          <Ack
            id="ack-refund"
            checked={acks.ackRefund}
            onChange={(value) => setAcks((current) => ({ ...current, ackRefund: value }))}
            text="I read the draft Refund page. Cash App refunds are sent manually by BC."
          />
          <Ack
            id="ack-rights"
            checked={acks.ackRights}
            onChange={(value) => setAcks((current) => ({ ...current, ackRights: value }))}
            text="I have the rights to both songs I am uploading."
          />
          <Ack
            id="ack-photo"
            checked={acks.ackPhoto}
            onChange={(value) => setAcks((current) => ({ ...current, ackPhoto: value }))}
            text="This photo is of me, or I have permission to submit it."
          />
          <Ack
            id="ack-fee"
            checked={acks.ackFee}
            onChange={(value) => setAcks((current) => ({ ...current, ackFee: value }))}
            text={`I understand the submission fee is ${fee} by Cash App, and the application stays Payment Pending until our team marks it paid.`}
          />
          <p className="text-sm text-muted-foreground">
            Read the drafts: <a className="underline" href="/terms">Terms</a>, <a className="underline" href="/privacy">Privacy</a>, <a className="underline" href="/refund">Refunds</a>.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" className="h-11 flex-1" disabled={busy} onClick={() => void continueToPayment()}>
              Continue to payment
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && application ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your draft is saved. Leave this page and come back with the link below. Nothing is confirmed until our team marks the payment.
          </p>
          {resumeLink ? (
            <p className="break-all rounded-xl bg-black/30 p-3 text-sm">
              Resume link: <a href={resumeLink}>{resumeLink}</a>
            </p>
          ) : null}
          {settings.paymentProvider === "cashapp_manual" ? (
            <>
              <div className="rounded-2xl border border-primary/40 bg-card p-4">
                <p className="text-sm uppercase tracking-wide text-primary">Send {fee} on Cash App</p>
                <p className="display mt-2 text-4xl">{instructions?.cashtagReady ? instructions.cashtag : "$Cashtag"}</p>
                {instructions?.cashtagReady ? null : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Our team has not published a $Cashtag yet. Your application stays saved. Do not send money until this shows a real tag.
                  </p>
                )}
                {instructions?.qrReady ? (
                  <img src="/api/branding/cashapp-qr" alt="Cash App QR code" className="mt-4 h-auto w-full max-w-xs" />
                ) : (
                  <div className="mt-4 grid h-40 place-items-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
                    Cash App QR — not uploaded yet
                  </div>
                )}
                <p className="mt-4 text-sm">
                  Put this in the Cash App note: <strong className="text-primary">{application.publicId}</strong>
                </p>
              </div>
              <Field label="Name or $Cashtag you paid from" value={paidFrom} onChange={setPaidFrom} required />
              <div className="grid gap-2">
                <Label htmlFor="pay-note">Cash App payment note</Label>
                <Textarea id="pay-note" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className="bg-black/25" />
              </div>
              <Button
                type="button"
                className="h-12 w-full"
                disabled={busy || !instructions?.cashtagReady || !settings.applicationsOpen}
                onClick={() => void claimPayment()}
              >
                {settings.applicationsOpen ? "I sent the Cash App payment" : "Payments are closed"}
              </Button>
            </>
          ) : (
            <Button type="button" className="h-12 w-full" disabled={busy || !settings.applicationsOpen} onClick={() => void startCheckout()}>
              Continue to hosted checkout
            </Button>
          )}
        </div>
      ) : null}

      {step === 5 && application ? (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-5">
          <h2 className="display text-4xl text-primary">Payment pending</h2>
          <p>
            {application.publicId} is saved for {application.artistName}. Our team still has to match your Cash App payment.
          </p>
          {application.email.trim() ? (
            <p>The confirmation email goes out only after that.</p>
          ) : (
            <p className="rounded-xl border border-primary/40 bg-black/30 p-3">
              No email was entered, so nothing will be emailed. Save your submission id{" "}
              <strong className="text-primary">{application.publicId}</strong>. Our team will use your phone number to reach you.
            </p>
          )}
          <p className="text-sm text-muted-foreground">Keep the resume link if you need to check back on this phone.</p>
        </div>
      ) : null}
    </div>
  );
}

function FeeNotice({ fee }: { fee: string }) {
  return (
    <aside className="rounded-2xl border border-primary/50 bg-primary/10 p-4">
      <p className="text-sm uppercase tracking-wide text-primary">Submission fee</p>
      <p className="mt-1 text-lg">{fee} on Cash App. This pays for review. It does not book you to perform.</p>
    </aside>
  );
}

function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}{" "}
        {required ? (
          <span className="text-primary">*</span>
        ) : (
          <span className="text-muted-foreground">(optional)</span>
        )}
      </Label>
      <Input id={id} className={fieldClass} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Uploader({
  label,
  accept,
  meta,
  progress,
  onFile,
  required = false,
}: {
  label: string;
  accept: string;
  meta: FileMeta;
  progress?: number;
  onFile: (file: File) => void;
  required?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <Label>
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </Label>
      <Input
        className="mt-2 h-11 bg-black/25"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {meta ? <p className="mt-2 text-sm text-muted-foreground">Uploaded {meta.name} ({formatBytes(meta.bytes)})</p> : null}
      {progress != null && progress >= 0 && progress < 1 ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
          <div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
      {progress === -1 ? <p className="mt-2 text-sm text-destructive">Upload failed. Choose the file again to retry.</p> : null}
    </div>
  );
}

function Ack({
  id,
  checked,
  onChange,
  text,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-1" />
      <Label htmlFor={id} className="text-sm leading-5 font-normal">
        {text}
      </Label>
    </div>
  );
}
