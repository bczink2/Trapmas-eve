# TRAPMAS on BC's Mac

The Render site does not keep the songs. This program runs on the MacBook and saves every application under Music.

Leave the Mac on, awake, and online. The quick Cloudflare address changes when this program restarts. It tells the website the new address about once a minute. Until that check-in, the form says submissions are paused.

Closing the lid can still sleep the Mac. Leave the lid open, or use power and an external screen. The program runs `caffeinate -i` so it does not idle-sleep while you are logged in.

## Files the Mac needs

The `mac-agent` folder from this repo. Node is at `/Users/bc/trapmas/node/bin/node`. No Homebrew and no admin password.

## Install

```bash
cd /Users/bc/trapmas/Trapmas-eve/mac-agent
MAC_RECEIVER_SECRET='the-same-secret-as-render' \
TRAPMAS_SITE_URL='https://trapmas-eve-c2a2.onrender.com' \
./install-macos.sh
```

That writes `~/Library/LaunchAgents/com.trapmas.macagent.plist` (RunAtLoad, KeepAlive).

Unpaid songs go in `~/Music/TRAPMAS EVE 2026 - Rubberband OG/Pending/TRAP-###/`. Mark Paid on the website moves that folder to the artist's name and adds `info.txt`. `submissions.csv` in the same Music folder opens in Numbers or Excel.

Log: `~/Library/Logs/trapmas-mac-agent.log`

Stop it:

```bash
launchctl bootout gui/$(id -u)/com.trapmas.macagent
```
