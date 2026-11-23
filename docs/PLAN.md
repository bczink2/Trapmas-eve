# TRAPMAS EVE 2026 — implementation plan

Artist submission desk for Barryel Watkins (BC), Greensboro, Alabama. Artists do not get accounts. BC reviews everything from one password-protected desk.

The attached master prompt was not on disk when this was built. Behavior follows the task: one public application, Cash App payment confirmed by hand, emails after that confirmation, and an admin desk. Stripe Checkout and Square Cash App Pay stay behind a switch.

## Build order

1. Schema, submission ids, settings.
2. Public page, file checks, drafts that survive an abandoned payment.
3. Payment module. Cash App manual is on. Stripe and Square adapters are present and untested with live keys.
4. Email log, with Resend when a key exists.
5. Admin desk: stats, search, review, decisions, refunds, delete, settings.
6. Draft legal pages, flyer slot, per-artist ZIP, and the local sync script.

## Schema

Nothing is stored on the Render server. The free plan has no disk, and the filesystem is wiped whenever the service restarts. Records live in a Google Sheet named `TRAPMAS submissions` inside the Drive folder `TRAPMAS EVE 2026 - Rubberband OG`. The same OAuth client that uploads files also edits that Sheet. Tabs:

- `settings` — event copy, featured artist, fee (default 2500 cents), open/closed, Cash App $Cashtag, QR file id, flyer file id, payment provider, contact info, legal drafts, email templates.
- `meta` — the counter that allocates `TRAP-001`, `TRAP-002`, and so on.
- `submissions` — one row per application: applicant info, file ids, acknowledgments, payment claim, paid-by / paid-at / amount / reference, decision, refund.
- `events` — every status change, who did it, and a note.
- `notes` — internal notes. They are not emailed.
- `emails` — every send attempt.
- `webhooks` — provider + event id, so a repeated Stripe or Square webhook does not apply twice.

`db/schema.sql` is the same shape, used only by the unit tests. There is no Supabase project and no separate database service.

- `settings` — one row. Event copy, featured artist, fee (default 2500 cents), open/closed, Cash App $Cashtag, QR file key, flyer file key, payment provider, contact info, legal drafts, email templates.
- `id_counters` — allocates `TRAP-001`, `TRAP-002`, and so on.
- `submissions` — the application, file keys, acknowledgments, payment claim, paid-by / paid-at / amount / reference, decision, refund.
- `status_events` — every status change, who did it, and a note.
- `submission_notes` — internal notes. They are not emailed.
- `webhook_events` — provider + event id, unique, so a repeated Stripe or Square webhook does not apply twice.
- `email_log` — every send attempt.

Statuses: `draft`, `awaiting_payment`, `payment_pending`, `paid`, `approved`, `waitlisted`, `declined`, `refunded`, `expired`.

Files live in private storage, not on a public URL. Admin players use signed links that expire in 15 minutes. The export script's links expire in 60 minutes.

## Services

| Piece | Choice | Why |
| --- | --- | --- |
| App | Next.js on Render, Node 22 | One web service. The public URL is `https://<name>.onrender.com`. No domain. |
| Database | Google Sheet in the Drive folder | Same Google login as the files. Nothing stays on Render. |
| Files before payment | Drive folder `Pending/TRAP-###/` | Streamed as they arrive. Abandoned drafts are deleted after 14 days. |
| Files after Mark paid | `TRAPMAS EVE 2026 - Rubberband OG/<Artist>/` | Moved there from Pending. |
| Files after the sync script | The computer only | The script checks the checksum, then the server deletes the Drive copy. |
| Payments now | Cash App, confirmed in the desk | No webhook for a personal Cash App transfer. |
| Payments later | Stripe Checkout or Square Cash App Pay | Same mark-paid path. |
| Email | Gmail SMTP as Dream 2 Reality | No domain to verify. Resend is optional later. |
| Desk auth | One password, httpOnly cookie | No artist accounts. |
| Script auth | `ADMIN_EXPORT_TOKEN` | Separate from the desk password. |

Cash App $Cashtag and QR are settings, not env vars, so BC can change them without a deploy. Both start empty. The payment button stays disabled until a real $Cashtag is saved.

Open/closed blocks new drafts, payment claims, and hosted checkout.

## Cost at 50–300 submissions

Prices checked 23 Nov 2026.

Songs never land on Render. The browser streams each file straight into Drive. After Mark paid, those files move into the artist folder. The sync script checks the checksum and then deletes them from Drive. If the computer is off, they wait in Drive.

The free web service sleeps after about 15 minutes with no visitors. The next visit waits roughly 30–60 seconds while Render wakes it, then a few more seconds while the Sheet is opened. That delay is normal. There is no disk to add on the free plan.

| Item | Plan | Monthly |
| --- | --- | --- |
| Render web service | Free, 0.1 CPU / 512 MB, sleeps, 750 hours, `onrender.com` | $0 |
| Render disk | None | $0 |
| Google Drive and the Sheet | Free 15 GB, shared by files and the spreadsheet. Sync the computer so unsynced songs do not fill it. Google One starts around $2 if you pass 15 GB. | $0 |
| Gmail | App password. Sender name Dream 2 Reality. | $0 |
| Domain | Not used. | $0 |
| Resend | Off unless a domain is added later. | $0 |
| Cash App | No platform fee. | $0 |

**$0 / month** while Drive stays inside the free 15 GB and the form uses the free web service.

A full-size submission is about 50 MB (two 20 MB songs and a 10 MB photo). Three hundred of those, left in Drive and never synced, would pass 15 GB. Run the sync script and the holding area stays small. The free instance cannot be given a disk, and it only has 512 MB of RAM, so uploads are streamed instead of loaded into memory.

Stripe or Square, if switched on later, add their processing fee (commonly about 2.9% + $0.30). That comes out of the fees, not this monthly bill.

## Not included

Artist logins, public lineups, ticket sales, automatic Cash App verification, and a live production test of payments, storage, or email. Those need BC's keys.
