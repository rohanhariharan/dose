#!/usr/bin/env python3
"""The bridge between the app and the reader.

    ./serve.py           # 127.0.0.1:8791, loopback only

POST /read  {"image": "data:image/jpeg;base64,..."}  ->  the fields
GET  /health                                          ->  {"ok": true}

Bound to loopback and nothing else: this is not a service anyone else can
reach, it holds no state, and it exits when you stop it. In the Tauri build the
same function is called from Rust instead of over a socket.
"""

import base64
import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import gemini  # noqa: E402
import read as reader  # noqa: E402

HOST, PORT = "127.0.0.1", 8791
FIELDS = (
    "name",
    "form",
    "strength",
    "quantity",
    "unit",
    "perDay",
    "durationDays",
    "prn",
    "source",
    "escalated",
    "missing",
)


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.1 so the browser will accept a chunked stream; everything else
    # sets Content-Length, so keep-alive is safe.
    protocol_version = "HTTP/1.1"

    def _chunk(self, data):
        self.wfile.write(f"{len(data):X}\r\n".encode() + data + b"\r\n")
        self.wfile.flush()
    def _send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # The app is served from a different port while developing.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self._send(200, {"ok": True, "reader": "local+gemini"})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        route = self.path.split("?")[0]
        if route == "/chat/stream":
            self.handle_chat_stream()
            return
        if route == "/chat":
            self.handle_chat()
            return
        if route != "/read":
            self._send(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            image = body["image"]
            _, _, encoded = image.partition(",") if image.startswith("data:") else ("", "", image)
            raw = base64.b64decode(encoded)
        except Exception as error:  # noqa: BLE001 - any bad body is the same answer
            self._send(400, {"error": f"bad request: {error}"})
            return

        handle = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        try:
            handle.write(raw)
            handle.close()
            result = reader.read(handle.name)
        except SystemExit as error:  # gemini.py exits on HTTP errors
            self._send(502, {"error": str(error)})
            return
        except Exception as error:  # noqa: BLE001
            self._send(500, {"error": f"reader failed: {error}"})
            return
        finally:
            try:
                os.unlink(handle.name)
            except OSError:
                pass

        self._send(200, {key: result.get(key) for key in FIELDS})

    def handle_chat_stream(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            messages = body.get("messages") or []
            context = (body.get("context") or "").strip()
            if not messages:
                raise ValueError("no messages")
        except Exception as error:  # noqa: BLE001
            self._send(400, {"error": f"bad request: {error}"})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        def event(payload):
            return f"data: {json.dumps(payload)}\n\n".encode()

        try:
            for delta in gemini.chat_stream(messages, context):
                self._chunk(event({"delta": delta}))
            self._chunk(event({"done": True}))
        except Exception as error:  # noqa: BLE001
            try:
                self._chunk(event({"error": str(error)}))
            except OSError:
                pass
        finally:
            try:
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
            except OSError:
                pass

    def handle_chat(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            messages = body.get("messages") or []
            context = (body.get("context") or "").strip()
            if not messages:
                raise ValueError("no messages")
        except Exception as error:  # noqa: BLE001
            self._send(400, {"error": f"bad request: {error}"})
            return

        try:
            reply = gemini.chat(messages, context)
        except Exception as error:  # noqa: BLE001
            self._send(502, {"error": str(error)})
            return

        self._send(200, {"reply": reply})

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"reader on http://{HOST}:{PORT}  (ctrl-c to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped", flush=True)


if __name__ == "__main__":
    main()
