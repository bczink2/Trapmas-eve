# TRAPMAS EVE 2026

Artist submissions for Barryel Watkins. One public page, a $25 Cash App fee that BC confirms by hand, and a password-protected desk. No artist accounts.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847). Admin is at `/admin`. Until you set `ADMIN_PASSWORD`, the local password is `trapmas-dev`.

```bash
npm test
npm run typecheck
npm run build
```

Copy `.env.example` to `.env.local` when you have Gmail and Google Drive keys. Without them, production shows the landing page and refuses new applications. Locally, the app keeps a SQLite file for development and prints email to the terminal. Mail is sent as Dream 2 Reality through Gmail. The public site is a Render `onrender.com` address on the free plan. No domain, no disk, and no separate database: the Sheet and the files live in Google Drive.

## What BC edits

Admin → Settings: event date, time, venue, fee, open/closed, $Cashtag, Cash App QR, flyer, featured artist, and the draft Terms, Privacy, and Refund pages. Legal pages show a draft banner until that checkbox is turned off.

The hero **SUBMIT YOUR MUSIC NOW** button and the flyer both jump to the form. On a phone, a sticky button does the same until the form is on screen.

## Files on your computer

See [docs/SYNC.md](docs/SYNC.md). Review page → **Download all**, or:

```bash
export ADMIN_EXPORT_TOKEN="..."
export TRAPMAS_BASE_URL="http://127.0.0.1:3847"
node scripts/sync-submissions.mjs --out "$HOME/Music"
```

## Deploy

[docs/DEPLOY.md](docs/DEPLOY.md), [docs/CREDENTIALS.md](docs/CREDENTIALS.md), [docs/PLAN.md](docs/PLAN.md), [docs/TESTING.md](docs/TESTING.md).

**$0 / month** on Render's free web service, Gmail, and the free Google Drive quota. The free service sleeps after about 15 minutes; the first visit after that waits about 30–60 seconds. Keep the computer sync running so Drive stays under 15 GB. Details are in the plan.

Do not treat payments, Drive uploads, or email as working in production until they have been tried with real keys.
