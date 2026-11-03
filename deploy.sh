#!/usr/bin/env bash
# Deploy to ubuntu@gtac:~/apps/sims (served at https://renatatest.dunc.app via Caddy -> :8000).
# Saved builds in data/ on the server are left untouched.
set -euo pipefail
HOST=${HOST:-ubuntu@gtac}
DEST=apps/sims
cd "$(dirname "$0")"

tar czf - public server.py sims.service | ssh "$HOST" "mkdir -p $DEST && cd $DEST && rm -rf public && tar xzf -"

ssh "$HOST" "cd $DEST && \
  (cmp -s sims.service /etc/systemd/system/sims.service || \
   (sudo cp sims.service /etc/systemd/system/sims.service && sudo systemctl daemon-reload && sudo systemctl enable sims)) && \
  sudo systemctl restart sims && sleep 1 && systemctl is-active sims && \
  curl -s -o /dev/null -w 'local: %{http_code}\n' http://127.0.0.1:8000/"

curl -s -o /dev/null -w 'public: %{http_code}\n' https://renatatest.dunc.app/
