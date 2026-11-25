# Files on your computer

Songs now go straight to BC's Mac. See [mac-agent/README.md](../mac-agent/README.md). The Drive sync script below is legacy and is not the live path.

# Legacy Drive sync

While an artist is still applying, the photo and both MP3s stream into `Pending/TRAP-###/` in Google Drive. The application row is in the Sheet `TRAPMAS submissions` in the same event folder. Render does not keep a copy.

When you mark a submission paid, those files move into the artist folder and `info.txt` is added:

```text
TRAPMAS EVE 2026 - Rubberband OG/
  Night Drive/
    Eve.mp3
    After Midnight.mp3
    photo.jpg
    info.txt
```

The checksum is taken while the file is streaming up. If your computer is off, the files wait in Drive. The admin desk still plays them from Drive. Drafts left unpaid for 14 days (`DRAFT_TTL_DAYS`) are deleted from Pending the next time the site wakes.

The script pulls new Drive folders into the same layout on your computer, checks the checksum, then tells the server to delete them from Drive. The desk then says **Saved to computer** and stops offering playback.

```bash
export ADMIN_EXPORT_TOKEN="the token from Render"
export TRAPMAS_BASE_URL="https://trapmas-eve.onrender.com"
node scripts/sync-submissions.mjs --out "$HOME/Music"
```

Use the real `onrender.com` URL. Run it once by hand and open a folder before you schedule it.

## Every 15 minutes on Windows

Task Scheduler → Create Task.

- Trigger: Daily, repeat every 15 minutes for 1 day. Stop at the end of the day is off, so it keeps repeating.
- Action: Start a program.
- Program: `node`
- Arguments: `C:\trapmas\scripts\sync-submissions.mjs --out C:\Users\BC\Music`
- Start in: `C:\trapmas`
- On the General tab, run whether you are logged on or not if the machine stays on.

Set `ADMIN_EXPORT_TOKEN` and `TRAPMAS_BASE_URL` as user environment variables so they are not in the task command.

## Every 15 minutes on macOS

Save this as `~/Library/LaunchAgents/com.trapmas.sync.plist`, then `launchctl load` that file.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.trapmas.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/BC/trapmas/scripts/sync-submissions.mjs</string>
    <string>--out</string>
    <string>/Users/BC/Music</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ADMIN_EXPORT_TOKEN</key>
    <string>paste-the-token</string>
    <key>TRAPMAS_BASE_URL</key>
    <string>https://trapmas-eve.onrender.com</string>
  </dict>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
```

`StartInterval` is seconds. 900 is 15 minutes. Change the node path if `which node` prints something else.

A second run skips files whose checksum already matches and only retries the Drive delete if the first confirmation failed.
