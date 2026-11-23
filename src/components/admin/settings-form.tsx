"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Settings } from "@/lib/types";

const TEXT: [keyof Settings, string][] = [
  ["eventName", "Event name"],
  ["eventTagline", "Headline"],
  ["eventSubheading", "Subheading"],
  ["featuredArtist", "Featured artist"],
  ["presenterName", "Presenter"],
  ["eventDate", "Date"],
  ["eventTime", "Time"],
  ["venueName", "Venue"],
  ["venueAddress", "Address"],
  ["city", "City"],
  ["submissionDeadline", "Deadline note"],
  ["contactEmail", "Contact email"],
  ["contactPhone", "Contact phone"],
  ["instagramUrl", "Instagram URL"],
  ["emailFromName", "Email from name"],
  ["emailReplyTo", "Reply-to email"],
];

const LONG: [keyof Settings, string][] = [
  ["eventDescription", "Event description"],
  ["termsText", "Terms draft"],
  ["privacyText", "Privacy draft"],
  ["refundText", "Refund draft"],
  ["pendingEmailSubject", "Payment-pending subject"],
  ["pendingEmailBody", "Payment-pending email"],
  ["confirmationEmailSubject", "Confirmation subject"],
  ["confirmationEmailBody", "Confirmation email"],
  ["approvedEmailSubject", "Approved subject"],
  ["approvedEmailBody", "Approved email"],
  ["waitlistEmailSubject", "Waitlist subject"],
  ["waitlistEmailBody", "Waitlist email"],
  ["declinedEmailSubject", "Declined subject"],
  ["declinedEmailBody", "Declined email"],
];

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings.");
        setSettings((await response.json()) as Settings);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load."));
  }, []);

  if (!settings) return <p>{error || "Loading settings…"}</p>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const response = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            genreOptions: settings.genreOptions.join("\n"),
            feeCents: Math.round(Number(settings.feeCents)),
          }),
        });
        const body = (await response.json().catch(() => ({}))) as Settings & { error?: string };
        setBusy(false);
        if (!response.ok) {
          setError(body.error || "Could not save.");
          return;
        }
        setSettings(body);
        setMessage("Saved.");
      }}
    >
      <div>
        <h1 className="display text-5xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Closing applications blocks new payments. Legal pages stay marked draft until you turn that off.
        </p>
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT.map(([key, label]) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              className="h-11 bg-black/25"
              value={String(settings[key] ?? "")}
              onChange={(event) => set(key, event.target.value as Settings[typeof key])}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="fee">Fee in dollars</Label>
        <Input
          id="fee"
          className="h-11 max-w-xs bg-black/25"
          value={(settings.feeCents / 100).toFixed(2)}
          onChange={(event) => set("feeCents", Math.round(Number(event.target.value || 0) * 100))}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.applicationsOpen}
          onChange={(event) => set("applicationsOpen", event.target.checked)}
        />
        Applications open
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.legalIsDraft}
          onChange={(event) => set("legalIsDraft", event.target.checked)}
        />
        Legal pages are still drafts
      </label>
      <div className="grid gap-2">
        <Label htmlFor="cashtag">Cash App $Cashtag</Label>
        <Input
          id="cashtag"
          className="h-11 max-w-xs bg-black/25"
          placeholder="$Cashtag"
          value={settings.cashappCashtag}
          onChange={(event) => set("cashappCashtag", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="provider">Payment method</Label>
        <select
          id="provider"
          className="h-11 max-w-md rounded-lg border border-input bg-black/25 px-3"
          value={settings.paymentProvider}
          onChange={(event) => set("paymentProvider", event.target.value as Settings["paymentProvider"])}
        >
          <option value="cashapp_manual">Cash App, confirmed by hand</option>
          <option value="stripe_checkout">Stripe Checkout (needs keys)</option>
          <option value="square_cashapp">Square Cash App Pay (needs keys)</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="genres">Genres, one per line</Label>
        <Textarea
          id="genres"
          className="bg-black/25"
          value={settings.genreOptions.join("\n")}
          onChange={(event) => set("genreOptions", event.target.value.split("\n"))}
        />
      </div>
      <Upload
        label="Replace event flyer"
        hint="JPG, PNG, or WebP. The public page shows the whole image, with no crop. Reset brings back the official flyer."
        url="/api/admin/settings/artwork"
        onDone={(next) => setSettings(next)}
      />
      <Upload
        label="Cash App QR code"
        hint="Shown on the payment step. Leave it empty until you have the code."
        url="/api/admin/settings/qr"
        onDone={(next) => setSettings(next)}
      />
      {LONG.map(([key, label]) => (
        <div key={key} className="grid gap-2">
          <Label htmlFor={key}>{label}</Label>
          <Textarea
            id={key}
            className="min-h-28 bg-black/25"
            value={String(settings[key] ?? "")}
            onChange={(event) => set(key, event.target.value as Settings[typeof key])}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Email tokens: {"{{artist_name}} {{public_id}} {{event_name}} {{fee}} {{event_date}} {{venue}} {{city}} {{cashtag}} {{note}}"}
      </p>
      <Button type="submit" className="h-11" disabled={busy}>
        {busy ? "Saving" : "Save settings"}
      </Button>
    </form>
  );
}

function Upload({
  label,
  hint,
  url,
  onDone,
}: {
  label: string;
  hint: string;
  url: string;
  onDone: (settings: Settings) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="rounded-2xl border border-border p-4">
      <Label>{label}</Label>
      <p className="mb-2 text-sm text-muted-foreground">{hint}</p>
      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const data = new FormData();
          data.set("file", file);
          const response = await fetch(url, { method: "POST", body: data });
          const body = (await response.json().catch(() => ({}))) as Settings & { error?: string };
          if (!response.ok) setError(body.error || "Upload failed.");
          else {
            setError("");
            onDone(body);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        onClick={async () => {
          const response = await fetch(url, { method: "DELETE" });
          if (response.ok) onDone((await response.json()) as Settings);
        }}
      >
        Remove upload
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
