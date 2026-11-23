import type { Store } from "@/lib/store";
import { renderTemplate, textToEmailHtml, type EmailVars } from "@/lib/email/render";
import { activeEmailProvider, gmailAppPassword, gmailFrom, resendFrom } from "@/lib/email/provider";
import { formatUsd } from "@/lib/money";
import type { EmailTemplateName, Settings, Submission } from "@/lib/types";

export function emailVars(settings: Settings, submission: Submission, note = ""): EmailVars {
  return {
    artist_name: submission.artistName,
    public_id: submission.publicId,
    event_name: settings.eventName,
    fee: formatUsd(settings.feeCents),
    event_date: settings.eventDate,
    venue: settings.venueName,
    city: settings.city,
    cashtag: settings.cashappCashtag || "$Cashtag not published yet",
    note: note.trim(),
  };
}

export function templateCopy(
  settings: Settings,
  template: EmailTemplateName,
): { subject: string; body: string } {
  switch (template) {
    case "pending":
      return { subject: settings.pendingEmailSubject, body: settings.pendingEmailBody };
    case "confirmation":
      return { subject: settings.confirmationEmailSubject, body: settings.confirmationEmailBody };
    case "approved":
      return { subject: settings.approvedEmailSubject, body: settings.approvedEmailBody };
    case "waitlist":
      return { subject: settings.waitlistEmailSubject, body: settings.waitlistEmailBody };
    case "declined":
      return { subject: settings.declinedEmailSubject, body: settings.declinedEmailBody };
  }
}

async function deliver(
  settings: Settings,
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<{ status: "sent" | "logged_dev" | "skipped_unconfigured" | "skipped_no_email" | "failed"; detail: string }> {
  const provider = activeEmailProvider();
  if (provider === "log") {
    const status = process.env.NODE_ENV === "production" ? "skipped_unconfigured" : "logged_dev";
    if (status === "logged_dev") console.info(`[email] to ${to}: ${subject}`);
    return {
      status,
      detail:
        status === "logged_dev"
          ? "Gmail is not configured. Logged locally."
          : "Set GMAIL_USER and GMAIL_APP_PASSWORD.",
    };
  }
  try {
    if (provider === "gmail") {
      const nodemailer = await import("nodemailer");
      const from = gmailFrom(settings.emailFromName);
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: from.address, pass: gmailAppPassword() },
      });
      const info = await transport.sendMail({
        from: `${from.name} <${from.address}>`,
        to,
        subject,
        text,
        html,
        replyTo: settings.emailReplyTo || from.address,
      });
      return { status: "sent", detail: info.messageId || "gmail" };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom(settings.emailFromName, settings.emailReplyTo),
        to: [to],
        subject,
        html,
        text,
        reply_to: settings.emailReplyTo || undefined,
      }),
    });
    const detail = (await response.text()).slice(0, 500);
    return { status: response.ok ? "sent" : "failed", detail };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Email send failed." };
  }
}

export async function sendTemplateEmail(
  store: Store,
  input: {
    settings: Settings;
    submission: Submission;
    template: EmailTemplateName;
    note?: string;
  },
): Promise<{ status: "sent" | "logged_dev" | "skipped_unconfigured" | "skipped_no_email" | "failed"; subject: string }> {
  const copy = templateCopy(input.settings, input.template);
  const vars = emailVars(input.settings, input.submission, input.note);
  const subject = renderTemplate(copy.subject, vars);
  const text = renderTemplate(copy.body, vars);
  const html = textToEmailHtml(text);
  const to = input.submission.email.trim();
  if (!to) {
    await store.logEmail({
      submissionId: input.submission.id,
      template: input.template,
      toEmail: "",
      subject,
      status: "skipped_no_email",
      detail: "No email address on the application. Nothing was sent.",
    });
    return { status: "skipped_no_email", subject };
  }

  const delivered = await deliver(input.settings, to, subject, text, html);
  await store.logEmail({
    submissionId: input.submission.id,
    template: input.template,
    toEmail: input.submission.email,
    subject,
    status: delivered.status,
    detail: delivered.detail,
  });
  return { status: delivered.status, subject };
}
