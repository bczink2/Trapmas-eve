# Deploy on Render

The live address is Render's hostname. You do not buy a domain.

1. Push this repo and create a Render web service named `trapmas-eve`, or apply `render.yaml`.
2. Plan: Free. No disk. The Blueprint sets `plan: free` and does not mount storage.
3. Set the secrets in `docs/CREDENTIALS.md`. `MAC_RECEIVER_SECRET` must match the Mac.
4. Deploy. Render shows a URL like `https://trapmas-eve-c2a2.onrender.com`. Copy that exact URL into `NEXT_PUBLIC_APP_URL` and into `TRAPMAS_SITE_URL` on the Mac.
5. Open `/api/health`. It says `storage: "mac"`. `mac` is `offline` until the Mac checks in, then `online`. Email says `gmail` once the app password is set. The form pauses while the Mac is offline.
6. Sign in at `/admin`. Add the Cash App $Cashtag and QR. Read the draft Terms, Privacy, and Refund pages before sharing the link.

The free service sleeps after about 15 minutes of quiet. The first request after that takes about 30–60 seconds. Later requests in the same visit are normal. Uploads and the Sheet are not on the server, so a restart does not delete applications.

`DRAFT_TTL_DAYS` defaults to 14. Drafts that never reach payment are removed from Drive after that many days. The cleanup runs when the service wakes up.

Locally:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3847. Password `trapmas-dev` until you set `ADMIN_PASSWORD`.
