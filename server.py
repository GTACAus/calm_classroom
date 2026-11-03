"""Calm Classroom Builder server: static files from ./public plus a tiny JSON API.

Stdlib only.  Run:  python3 server.py  [--port 8000]
  GET  /api/builds        list saved builds (newest first)
  GET  /api/builds/<id>   one build
  POST /api/builds        save {name, room, overall, spent, scores}
"""
import argparse
import json
import re
import secrets
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
BUILDS = ROOT / "data" / "builds"
MAX_BODY = 512 * 1024
ID_RE = re.compile(r"^[0-9]+-[0-9a-f]{6}$")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def end_headers(self):
        # Short cache so test deploys show up immediately; Caddy handles compression.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/builds":
            out = []
            for f in BUILDS.glob("*.json"):
                try:
                    d = json.loads(f.read_text())
                except (OSError, ValueError):
                    continue
                out.append({k: d.get(k) for k in ("id", "name", "created", "overall", "spent")})
            out.sort(key=lambda d: d.get("created") or 0, reverse=True)
            return self.send_json(out[:200])
        if path.startswith("/api/builds/"):
            bid = path.rsplit("/", 1)[1]
            f = BUILDS / f"{bid}.json"
            if not ID_RE.match(bid) or not f.exists():
                return self.send_json({"error": "not found"}, 404)
            return self.send_json(json.loads(f.read_text()))
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/builds":
            return self.send_json({"error": "not found"}, 404)
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY:
            return self.send_json({"error": "bad size"}, 413)
        try:
            data = json.loads(self.rfile.read(length))
            room = data["room"]
            assert isinstance(room, dict) and isinstance(room.get("items"), list)
        except (ValueError, KeyError, AssertionError, TypeError):
            return self.send_json({"error": "bad build"}, 400)
        now = int(time.time())
        bid = f"{now}-{secrets.token_hex(3)}"
        rec = {
            "id": bid,
            "created": now,
            "name": str(data.get("name", "anon"))[:40],
            "overall": data.get("overall"),
            "spent": data.get("spent"),
            "scores": data.get("scores"),
            "room": room,
        }
        BUILDS.mkdir(parents=True, exist_ok=True)
        (BUILDS / f"{bid}.json").write_text(json.dumps(rec))
        return self.send_json({"id": bid}, 201)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    BUILDS.mkdir(parents=True, exist_ok=True)
    print(f"Serving {PUBLIC} on http://{a.host}:{a.port}")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
