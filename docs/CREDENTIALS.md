# Credentials

No custom domain. Render gives the site a hostname such as `https://trapmas-eve.onrender.com`. After the first deploy, put that exact URL in `NEXT_PUBLIC_APP_URL`.

Put secrets in Render's environment, or in `.env.local` on a computer. Do not commit them.

## You invent these

| Key | Where |
| --- | --- |
| Desk password | `ADMIN_PASSWORD` |
| Long random string | `ADMIN_SESSION_SECRET` |
| A different long random string for the sync script | `ADMIN_EXPORT_TOKEN` |

Locally, until `ADMIN_PASSWORD` is set, the password is `trapmas-dev`.

## Gmail (default email)

No domain to verify. Mail is sent as **Dream 2 Reality** from the Gmail address.

1. Use the Gmail account that should send the artist emails.
2. Turn on 2-Step Verification.
3. Create an App Password (Google Account → Security → App passwords). Choose Mail.
4. Set `GMAIL_USER` to the full address, `GMAIL_APP_PASSWORD` to the 16-character password, and leave `EMAIL_PROVIDER=gmail`.

`EMAIL_FROM_NAME` is already `Dream 2 Reality`.

## Google Drive (holding area)

Paid songs wait here until the computer at home downloads them.

1. In Google Cloud, create a project and enable the Google Drive API and the Google Sheets API.
2. Create a parent folder in Drive, or use My Drive. The id is the last part of the folder URL. Set `GOOGLE_DRIVE_FOLDER_ID` to that parent. The app creates `TRAPMAS EVE 2026 - Rubberband OG` inside it.
3. For a normal Gmail Drive, create an OAuth client (Desktop) and a refresh token with both scopes:
   `https://www.googleapis.com/auth/drive`
   `https://www.googleapis.com/auth/spreadsheets`
   Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`. If you already minted a token for Drive only, sign in again and grant Sheets. The old token cannot edit the spreadsheet.
4. A service account only works if that folder is inside a Shared Drive and the service account is a member. Then set `GOOGLE_SERVICE_ACCOUNT_JSON` to the key JSON (or its base64) and leave the OAuth fields empty.

The Sheet `TRAPMAS submissions` is created in that event folder. Songs land in `Pending/TRAP-###/` and move to `<Artist>/` when you mark the fee paid.

## Cash App

Not environment variables. After deploy, open Admin → Settings and add the $Cashtag and QR code.

## Optional later

| When | Keys |
| --- | --- |
| You buy a domain and want Resend instead of Gmail | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` on that domain |
| You switch off manual Cash App | Stripe or Square keys in `.env.example` |

## Not required

A domain, a separate database, Supabase, a Stripe account, or a Cash App API key.
