# Testing checklist

Verified here means automated tests or a local run without live Google, Gmail, Stripe, Square, or Cash App. Production payments, uploads, and email are not claimed. The live store is a Google Sheet; the unit tests use SQLite.

| Check | Result |
| --- | --- |
| MP3 accepted from ID3 and from an MPEG frame header | Verified, `src/lib/files/validate.test.ts` |
| WAV, EXE, and a JPEG renamed as MP3 rejected | Verified, same file |
| JPG and PNG magic bytes required, MIME must match | Verified |
| WebP flyer accepted only when the RIFF/WEBP header matches | Verified |
| 20 MB song limit and 10 MB photo limit | Verified via `checkSize` and a lowered limit |
| TRAP-001, TRAP-002 issued in order | Verified, `service.test.ts` |
| Draft kept when the artist reaches payment and does not claim it | Verified. Status stays `awaiting_payment`. No confirmation email. |
| Cash App note must contain the TRAP id | Verified |
| Claim sets Payment pending and logs the pending email only | Verified |
| Mark paid stores who, when, amount, and reference, then one confirmation email | Verified |
| Marking paid twice does not send a second confirmation | Verified |
| Stripe `checkout.session.completed` applied once when the same event id is delivered twice | Verified, including signature accept/reject and amount metadata |
| Square Cash App Pay link body sets `cash_app_pay` and the submission id; signature checked | Verified. No live Square call. |
| Closed applications block a new draft and a payment claim | Verified |
| Approve / waitlist / decline refused before payment; waitlist email logged after | Verified |
| Refund records actor and note and does not call Cash App | Verified |
| Delete removes the database row and the stored files | Verified |
| ZIP contains both songs (titles as file names), the photo, and info.txt | Verified, `sync-lib.test.ts` and `export.test.ts` |
| Export lists paid artists only, with signed media URLs | Verified, `export.test.ts` |
| Main folder name is `TRAPMAS EVE 2026 - Rubberband OG` from event + featured artist | Verified |
| Second artist with the same stage name gets the TRAP id on the folder | Verified |
| Re-run skips a file whose size already matches | Verified, `alreadyDownloaded` |
| Typecheck `tsc --noEmit` | Verified in this run |
| Production build `npm run build` | Verified. It completes, including typecheck and lint. |
| Landing CTA, draft create, magic-byte reject, Cash App gate, mark paid, ZIP, sync skip | Verified against the local dev server with curl and `scripts/sync-submissions.mjs`. Re-run skipped 4 existing files. |
| Official flyer on the hero and as the share image | Verified. `public/artwork/trapmas-eve-flyer.jpg` (1672×941) and `.webp` are served, the landing markup uses both, and a 390px screenshot shows the full flyer with no cropped text. |
| Real 20 MB upload streamed to Google Drive | Needs a live Google account. Not verified. |
| Cash App QR and $Cashtag displayed from BC's real assets | Needs BC to upload them. Placeholders until then. |
| Gmail SMTP as Dream 2 Reality, and Resend only when `EMAIL_PROVIDER=resend` | Provider choice is unit-tested. A live Gmail app password has not been used. |
| Copy to Google Drive after Mark paid, then delete from Drive after a checksum match | Unit-tested with a fake Drive. A real Google account has not been connected. |
| Stripe or Square charging a card | Not enabled. Not verified. |
| Admin password, search, filters, audio players, confirm-before-send | Implemented. Exercise on the dev server. Cookie auth is not covered by unit tests. |

Dev server password, until `ADMIN_PASSWORD` is set: `trapmas-dev`.
