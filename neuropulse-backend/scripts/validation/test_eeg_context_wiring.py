"""
test_eeg_context_wiring.py — verify PART 2 of the AI consultant bugfix.

Proves that the `eeg_context` from a /api/deepseek-chat request actually reaches
the OUTGOING messages array sent to the LLM gateway (not just saved to the DB).

How: starts a local mock "gateway" (stdlib http.server) that captures the POST
body it receives, then starts the real FastAPI backend pointed at that mock
(via env override, so NO real paid API call is made). Registers + logs in for a
JWT, POSTs a chat request with a concrete eeg_context (band power values), and
finally inspects the mock's captured body to confirm the EEG data is inside the
`messages` array that was sent to the "gateway".

Run from neuropulse-backend/:
    venv\\Scripts\\python test_eeg_context_wiring.py
"""

import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request

# The Windows console can default to a non-UTF-8 code page; make stdout/stderr
# robust to the Thai text asserted in this test.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Script lives under neuropulse-backend/scripts/validation now; ROOT must point
# to the backend dir so uvicorn can import main:app as the cwd.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOCK_PORT = 9877
BACKEND_PORT = 9876
CAPTURE_FILE = os.path.join(ROOT, "mock_gateway_capture.json")

FAILURES = []


def ok(check, label):
    print(("PASS  " if check else "FAIL  ") + label)
    if not check:
        FAILURES.append(label)


# ---------------------------------------------------------------------------
# 1. Mock gateway — records the outgoing request body it receives.
# ---------------------------------------------------------------------------

class _Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        with open(CAPTURE_FILE, "wb") as f:
            f.write(body)
        try:
            print("MOCK GATEWAY captured POST to", self.path, f"({len(body)} bytes)")
        except Exception:
            pass  # console encoding quirks on Windows must not break the handler
        # Return an OpenAI-compatible streaming SSE response.
        reply = ("บททดสอบ ดัชนีสุขภาพสมองของคุณ alpha สูงขึ้น สอดคล้องกับภาวะผ่อนคลาย "
                 "แต่ beta/theta อยู่ในช่วงสมดุล (เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย)")
        chunks = []
        for i in range(0, len(reply), 3):
            token = reply[i:i + 3]
            chunks.append("data: " + json.dumps({"choices": [{"delta": {"content": token}}]}) + "\n\n")
        chunks.append("data: [DONE]\n\n")
        data = ("".join(chunks)).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


def start_mock():
    class Reusable(socketserver.TCPServer):
        allow_reuse_address = True

    srv = Reusable(("127.0.0.1", MOCK_PORT), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


# ---------------------------------------------------------------------------
# 2. HTTP helpers against the running backend.
# ---------------------------------------------------------------------------

def http_json(method, path, payload=None, token=None):
    """Issue an HTTP request and return (status, body, raw_bytes).

    `body` is the parsed JSON dict when the response is JSON; otherwise it is
    the raw response text (e.g. the SSE stream body). `raw` is the raw byte
    payload. Streaming endpoints return text — we never force-JSON them here.
    """
    url = f"http://127.0.0.1:{BACKEND_PORT}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw.decode("utf-8")), raw
            except json.JSONDecodeError:
                return resp.status, raw.decode("utf-8", errors="replace"), raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw.decode("utf-8")), raw
        except Exception:
            return e.code, raw.decode("utf-8", errors="replace"), raw


def sse_last_token(token):
    """Minimal token to probe a done request is unnecessary; unused placeholder."""
    return token


# ---------------------------------------------------------------------------
# 3. Orchestration.
# ---------------------------------------------------------------------------

def main():
    if os.path.exists(CAPTURE_FILE):
        os.remove(CAPTURE_FILE)

    mock = start_mock()
    print(f"Mock gateway listening on 127.0.0.1:{MOCK_PORT}")

    # Start the real backend pointing at the mock, with a placeholder key so no
    # real API call is ever made. Env vars are set on the child process; these
    # override .env because python-dotenv does not override existing env vars.
    env = dict(os.environ)
    env["DEEPSEEK_API_ENDPOINT"] = f"http://127.0.0.1:{MOCK_PORT}/v1/chat/completions"
    env["DEEPSEEK_API_KEY"] = "test-placeholder-key"
    env["DEEPSEEK_MODEL"] = "deepseek-v4-flash-0731"

    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", str(BACKEND_PORT)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("Backend starting...")

    try:
        # Wait for backend to become ready.
        deadline = time.time() + 30
        ready = False
        while time.time() < deadline:
            try:
                s, h, _ = http_json("GET", "/health")
                if s == 200:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        ok(ready, "backend /health responds")
        if not ready:
            print("backend never became ready — aborting")
            return

        # Register (idempotent) + login for JWT.
        http_json("POST", "/api/auth/register",
                  {"email": "eegtest@example.com", "password": "password123", "nickname": "EEG Test"})
        s, login, _ = http_json("POST", "/api/auth/login",
                                {"email": "eegtest@example.com", "password": "password123"})
        ok(s == 200 and login.get("access_token"), "login returns JWT")
        token = login.get("access_token", "")

        # Concrete eeg_context: representative band-power values.
        eeg_context = {
            "delta": 0.35,
            "theta": 0.22,
            "alpha": 0.28,
            "beta": 0.12,
            "gamma": 0.03,
            "focusScore": 61.0,
            "stressLevel": 34.0,
        }

        # POST to the streaming chat endpoint. Reading the response fully
        # consumes the SSE stream up to [DONE] — that itself proves the backend
        # streamed a reply back end-to-end through the mock gateway.
        s, body, raw = http_json(
            "POST", "/api/deepseek-chat",
            {"user_prompt": "โปรดวิเคราะห์ดัชนีสุขภาพสมองของฉัน", "eeg_context": eeg_context},
            token=token,
        )
        ok(s == 200, "POST /api/deepseek-chat returns 200 (SSE body streamed)")
        ok(isinstance(raw, bytes) and b"data: [DONE]" in raw,
           "backend streamed an SSE reply through the gateway ([DONE] seen)")

        # Give the streaming generator a beat to finish before we read capture.
        time.sleep(2.0)

        # Inspect the captured outgoing request.
        ok(os.path.exists(CAPTURE_FILE), "mock gateway captured the outgoing request body")
        if not os.path.exists(CAPTURE_FILE):
            return

        with open(CAPTURE_FILE, "r", encoding="utf-8") as f:
            captured = json.load(f)
        msgs = captured.get("messages", [])
        ok(isinstance(msgs, list) and len(msgs) >= 2, f"messages array present ({len(msgs)} messages)")

        roles = [m.get("role") for m in msgs]
        contents = [m.get("content", "") for m in msgs]

        ok("system" in roles, "messages include the system prompt (no mojibake path)")
        # Confirm the system prompt is the correct service-module prompt (English,
        # language-neutral — the reply-language directive is appended separately).
        sys_content = next((m.get("content", "") for m in msgs if m.get("role") == "system"), "")
        ok("AI Neuro-Consultant for the NeuroPulse AI platform" in sys_content,
           "system prompt is the service-module prompt (reused, no mojibake path)")
        ok("Do not include greetings, introductory fluff, or closing summaries" in sys_content,
           "system prompt enforces the concise-response style rules")

        # Confirm eeg_context reached the gateway, not just the DB.
        any_ctx = any("Latest EEG data context for the user" in c for c in contents)
        ok(any_ctx, "eeg_context grounding block present in outgoing messages")
        all_values_present = all(
            str(v) in json.dumps(contents, ensure_ascii=False)
            for v in (0.35, 0.22, 0.28, 61.0)
        )
        ok(all_values_present, "concrete eeg_context values reached the outgoing request")

        # Confirm the speed-tuned generation parameters reached the gateway.
        ok(captured.get("max_tokens") == 300, "max_tokens=300 sent to gateway")
        ok(captured.get("temperature") == 0.3, "temperature=0.3 sent to gateway")

        saved = os.path.join(ROOT, "mock_gateway_messages.txt")
        with open(saved, "w", encoding="utf-8") as f:
            f.write("==== captured messages sent to gateway ====\n")
            for m in msgs:
                role = m.get("role")
                content = m.get("content", "")
                f.write(f"--- {role} ---\n")
                f.write(content if len(content) < 900 else content[:900] + "...\n")
            f.write("=============================================\n")
        print("Saved captured messages to", os.path.basename(saved))

    finally:
        backend.terminate()
        backend.wait(timeout=10)
        mock.shutdown()
        mock.server_close()

    print("\n" + ("ALL CHECKS PASSED" if not FAILURES else f"{len(FAILURES)} CHECK(S) FAILED"))
    print("\n".join("  FAIL " + f for f in FAILURES))
    sys.exit(1 if FAILURES else 0)


if __name__ == "__main__":
    main()