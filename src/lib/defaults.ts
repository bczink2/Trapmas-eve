import type { Settings } from "@/lib/types";

const TOKEN_HELP =
  "You can use {{artist_name}}, {{public_id}}, {{event_name}}, {{fee}}, {{event_date}}, {{venue}}, {{city}}, {{cashtag}}, and {{note}}.";

export const TEMPLATE_HELP = TOKEN_HELP;

export function defaultSettings(now = new Date().toISOString()): Settings {
  return {
    eventName: "TRAPMAS EVE 2026",
    eventTagline: "YOUR MUSIC. YOUR MOMENT. YOUR SHOT AT THE STAGE.",
    eventSubheading: "Want to perform on the same stage as Rubberband OG?",
    eventDescription:
      "Submit your music for consideration. Artist submissions are now open. Send two MP3 songs and one professional artist photo, complete the application, and pay the $25 review fee. The fee covers music review for performance consideration. It does not guarantee a slot. Our team confirms the payment, then emails you.",
    presenterName: "Barryel Watkins",
    featuredArtist: "Rubberband OG",
    eventDate: "December 24, 2026",
    eventTime: "Doors open 8:00 PM",
    venueName: "GEECHI'S",
    venueAddress: "383 Millwood Road",
    city: "Greensboro, Alabama 36744",
    feeCents: 2500,
    applicationsOpen: true,
    submissionDeadline: "",
    cashappCashtag: "",
    cashappQrKey: "",
    artworkKey: "",
    paymentProvider: "cashapp_manual",
    contactEmail: "",
    contactPhone: "",
    instagramUrl: "",
    genreOptions: ["Trap", "Hip-Hop", "R&B", "Gospel", "Pop", "Other"],
    emailFromName: "Dream 2 Reality",
    emailReplyTo: "",
    legalIsDraft: true,
    termsText: DRAFT_TERMS,
    privacyText: DRAFT_PRIVACY,
    refundText: DRAFT_REFUND,
    pendingEmailSubject: "We have your TRAPMAS EVE payment claim — {{public_id}}",
    pendingEmailBody: `Hi {{artist_name}},

We saved your TRAPMAS EVE application {{public_id}}. Your Cash App payment is pending until our team confirms it in Cash App. This note is not a confirmation and it is not a performance slot.

Fee: {{fee}}
Send it to {{cashtag}} and keep {{public_id}} in the Cash App note.

You will get another email after the payment is confirmed.

— {{event_name}}`,
    confirmationEmailSubject: "Payment confirmed — {{public_id}}",
    confirmationEmailBody: `Hi {{artist_name}},

Your {{fee}} submission fee for {{event_name}} is confirmed. Your application number is {{public_id}}.

This confirms payment only. It does not mean you are booked to perform. Our team will email you when a decision is ready.

Event: {{event_name}}
When: {{event_date}}
Where: {{venue}}, {{city}}

— TRAPMAS EVE`,
    approvedEmailSubject: "You're selected — {{event_name}} {{public_id}}",
    approvedEmailBody: `Hi {{artist_name}},

Our team selected {{public_id}} for {{event_name}}.

{{note}}

Details for the night ({{event_date}} at {{venue}}, {{city}}) will follow from this email address. Reply here if your contact info changed.

— TRAPMAS EVE`,
    waitlistEmailSubject: "TRAPMAS EVE waitlist — {{public_id}}",
    waitlistEmailBody: `Hi {{artist_name}},

{{public_id}} is on the waitlist for {{event_name}}. You are not booked yet. If a slot opens, our team will email you.

{{note}}

— TRAPMAS EVE`,
    declinedEmailSubject: "TRAPMAS EVE decision — {{public_id}}",
    declinedEmailBody: `Hi {{artist_name}},

Thank you for submitting {{public_id}} to {{event_name}}. Our team is not able to offer you a slot this time.

{{note}}

If a refund is due under the refund policy, it will be sent manually in Cash App. This email is the decision, not the refund itself.

— TRAPMAS EVE`,
    updatedAt: now,
  };
}

export const DRAFT_TERMS = `DRAFT — pending approval. This is not legal advice and it is not final policy.

By sending a TRAPMAS EVE application you agree to the following draft terms:

1. You are applying to be considered for TRAPMAS EVE 2026 at GEECHI'S in Greensboro, Alabama. Paying the submission fee and receiving a confirmation email does not book you to perform.

2. You must be at least 18 years old, or a parent or legal guardian must submit for you and be the contact on the application. This age rule is still a draft.

3. You will upload two MP3s and one photo. You promise the music is yours to submit, or that everyone who needs to agree has agreed. Do not upload beats, samples, or features you cannot clear.

4. Our team may listen to the songs and view the photo for selection and event planning. This draft does not give anyone the right to release, sell, or post your music. A separate yes is required before any public use of your song or photo.

5. You will pay the posted submission fee (default $25) with Cash App, put your TRAP number in the payment note, and wait for our team to mark the payment received. Until that happens the application stays Payment Pending.

6. The date, time, and venue shown on the site are whatever was last saved in the admin settings.

7. Our team can close submissions at any time. Closing stops new payments. It does not delete an application already saved.

8. Decisions are emailed. Statuses used here are approved, waitlist, and declined.

9. These terms are a draft. Do not treat them as the final agreement until the draft banner is removed.`;

export const DRAFT_PRIVACY = `DRAFT — pending approval. This is not a legal privacy policy yet.

What this site stores if you apply:

- Your artist name, legal name, email, phone, city, state, Instagram, genre, bio, and any note you write to BC.
- Two MP3s and one photo, kept in private storage. They are not on a public page.
- Your Cash App payment claim: the name or $Cashtag you say you paid from, the payment note, and later the amount, reference, and time our team records when the payment is marked paid.
- Emails we send you, and a log of whether the email provider accepted them.

Who can see it: our team, through the admin password. Review audio and the photo are opened with short-lived signed links. There are no artist accounts.

Payments: this version asks you to pay our team directly in Cash App. We do not receive your Cash App password. If the payment setting is later switched to Stripe or Square Cash App Pay, that provider processes the charge under its own terms, and we store the payment reference the provider sends.

Email: confirmation and decision mail is sent from Dream 2 Reality through Gmail, unless a domain mailer is turned on later.

How long: files stay until our team deletes the submission or your computer has saved them. Deleting a submission deletes the stored songs and photo. A database backup at the host may keep a copy for a short time.

We do not sell the list.

This draft is not final until the draft banner is removed. Questions go to the contact email published in the site settings.`;

export const DRAFT_REFUND = `DRAFT — pending approval. This is not a final refund policy.

The submission fee (default $25) is paid in Cash App to the $Cashtag published on the application page. The app cannot see Cash App, so our team confirms each payment.

Refunds, if our team agrees one is due, are sent manually in Cash App. The admin then marks the submission Refunded and records a note. Marking it refunded does not move the money. The money moves only when it is sent in Cash App.

Until this draft is replaced, the working assumption is:

- A fee that our team has not confirmed stays unpaid in this system. Do not expect a refund record for a payment that cannot be found.
- If an application is declined and the fee should be returned, the Cash App refund is sent and the submission is marked refunded.
- A confirmed payment is not by itself a promise of a performance slot, and a refund is not automatic on a decline unless that rule is written here.

Our team must edit this page before the link is announced.`;
