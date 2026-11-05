#!/bin/sh
# Read-only, noninteractive evaluation runner. Same Opus model; bounded medium effort.
claude_bin=${VIBEPRINT_CLAUDE_BIN:-claude}
if ! command -v "$claude_bin" >/dev/null 2>&1; then
  claude_bin=/home/rudder/.local/bin/claude
fi
exec "$claude_bin" --effort medium --permission-mode dontAsk --allowedTools Read Grep Glob "$@"
