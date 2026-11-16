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
APP_ORIGINS = {f"http://{host}:{port}" for host in ("localhost", HOST) for port in (5181, 4173)}
# The deployed build is the same app, and a reader running on the same machine
# is still the reader it should talk to — it just isn't on the dev server's
# origin. Extra origins can be added without editing this file.
APP_ORIGINS |= {
    origin.strip()
    for origin in os.environ.get("DOSE_ORIGINS", "https://rohanhariharan.github.io").split(",")
    if origin.strip()
}
IMAGE_TYPES = {"data:image/jpeg;base64": ".jpg", "data:image/png;base64": ".png"}
MAX_IMAGE_BODY = 14 * 1024 * 1024
FIELDS = (
    "name",
    "form",
    "strength",
    "quantity",
    "unit",
    "perDay",
    "durationDays",
    "dose",
    "route",
    "directions",
    "phases",
    "needsReview",
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

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin in APP_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            # A page on the public web reaching a loopback service is a private
            # network request; Chrome asks permission first.
            if self.headers.get("Access-Control-Request-Private-Network"):
                self.send_header("Access-Control-Allow-Private-Network", "true")

    def _allow_app(self):
        origin = self.headers.get("Origin")
        if origin and origin not in APP_ORIGINS:
            self.close_connection = True
            self._send(403, {"error": "This origin cannot use the Dose reader"})
            return False
        return True

    def _send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if not self._allow_app():
            return
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self._send(200, {"ok": True, "reader": "local+gemini"})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._allow_app():
            return
        route = self.path.split("?")[0]
        if route == "/summary/stream":
            self.handle_summary_stream()
            return
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
            if length <= 0 or length > MAX_IMAGE_BODY:
                self.close_connection = True
                raise ValueError("invalid image size")
            body = json.loads(self.rfile.read(length))
            image = body["image"]
            mime, _, encoded = image.partition(",") if image.startswith("data:") else ("", "", image)
            suffix = IMAGE_TYPES[mime] if mime else ".jpg"
            raw = base64.b64decode(encoded, validate=True)
            if not raw or len(raw) > 10 * 1024 * 1024:
                raise ValueError("invalid image size")
        except Exception as error:  # noqa: BLE001 - any bad body is the same answer
            self._send(400, {"error": f"bad request: {error}"})
            return

        handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            handle.write(raw)
            handle.close()
            result = reader.read(handle.name, allow_cloud=body.get("allowCloud") is True)
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

    def handle_summary_stream(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            facts = (body.get("context") or "").strip()
            if not facts:
                raise ValueError("no facts")
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
            stream = gemini.chat_stream(
                [{"role": "user", "text": "Summarise today."}],
                facts,
                system=gemini.SUMMARY,
            )
            for delta in stream:
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
        self._cors()
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
