#!/bin/bash
# Starts the TRAPMAS receiver when BC logs in. No sudo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${TRAPMAS_NODE:-/Users/bc/trapmas/node/bin/node}"
SECRET="${MAC_RECEIVER_SECRET:-}"
SITE="${TRAPMAS_SITE_URL:-}"
STORAGE="${MAC_STORAGE_ROOT:-$HOME/Music/TRAPMAS EVE 2026 - Rubberband OG}"
PORT="${MAC_PORT:-4747}"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node was not found at $NODE_BIN"
  exit 1
fi
if [[ -z "$SECRET" || -z "$SITE" ]]; then
  echo "Set MAC_RECEIVER_SECRET and TRAPMAS_SITE_URL, then run this again."
  exit 1
fi

escape() {
  local s=$1
  s=${s//&/&amp;}
  s=${s//</&lt;}
  s=${s//>/&gt;}
  s=${s//\"/&quot;}
  printf '%s' "$s"
}

PLIST="$HOME/Library/LaunchAgents/com.trapmas.macagent.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.trapmas.macagent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(escape "$NODE_BIN")</string>
    <string>$(escape "$ROOT/agent.mjs")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(escape "$ROOT")</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$(escape "$HOME/Library/Logs/trapmas-mac-agent.log")</string>
  <key>StandardErrorPath</key>
  <string>$(escape "$HOME/Library/Logs/trapmas-mac-agent.log")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MAC_RECEIVER_SECRET</key>
    <string>$(escape "$SECRET")</string>
    <key>TRAPMAS_SITE_URL</key>
    <string>$(escape "$SITE")</string>
    <key>MAC_STORAGE_ROOT</key>
    <string>$(escape "$STORAGE")</string>
    <key>MAC_PORT</key>
    <string>$(escape "$PORT")</string>
    <key>MAC_CAFFEINATE</key>
    <string>1</string>
    <key>PATH</key>
    <string>/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

UID_NUM="$(id -u)"
launchctl bootout "gui/${UID_NUM}/com.trapmas.macagent" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST"
launchctl enable "gui/${UID_NUM}/com.trapmas.macagent"
launchctl kickstart -k "gui/${UID_NUM}/com.trapmas.macagent"
echo "Installed com.trapmas.macagent. Log: $HOME/Library/Logs/trapmas-mac-agent.log"
echo "Files: $STORAGE"
