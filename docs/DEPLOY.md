# Deploy on Render

The live address is Render's hostname. You do not buy a domain.

1. Push this repo and create a Render web service named `trapmas-eve`, or apply `render.yaml`.
2. Plan: Free. No disk. The Blueprint sets `plan: free` and does not mount storage.
3. Set the secrets in `docs/CREDENTIALS.md`. Google Drive and the Sheet use the same OAuth client.
4. Deploy. Render shows a URL like `https://trapmas-eve.onrender.com`. If that name is taken, Render picks another `onrender.com` name. Copy that exact URL into `NEXT_PUBLIC_APP_URL` and redeploy once.
5. Open `/api/health`. Before Google is connected it says `database: not_configured` and `drive: off`, and the landing page still loads. After the Google keys are in, it says `database: google_sheets` and `drive: configured`. Email says `gmail` once the app password is set.
6. Sign in at `/admin`. Add the Cash App $Cashtag and QR. Read the draft Terms, Privacy, and Refund pages before sharing the link.

The free service sleeps after about 15 minutes of quiet. The first request after that takes about 30–60 seconds. Later requests in the same visit are normal. Uploads and the Sheet are not on the server, so a restart does not delete applications.

`DRAFT_TTL_DAYS` defaults to 14. Drafts that never reach payment are removed from Drive after that many days. The cleanup runs when the service wakes up.

Locally:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3847. Password `trapmas-dev` until you set `ADMIN_PASSWORD`.
