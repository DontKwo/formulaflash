"""Cross-platform local HTTP loopback host for FormulaFlash macOS and Linux bundles."""

from __future__ import annotations

import argparse
from functools import partial
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
from urllib.parse import unquote, urlparse
import urllib.request
import webbrowser


APP_TITLE: str = "FormulaFlash"


def resolve_dist_dir() -> Path:
    """Resolve embedded PyInstaller dist directory or workspace Vite output."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        frozen_dist = Path(getattr(sys, "_MEIPASS")) / "dist"
        if frozen_dist.exists():
            return frozen_dist
    repo_dist = Path(__file__).resolve().parent.parent / "apps" / "app" / "dist"
    if repo_dist.exists():
        return repo_dist
    raise FileNotFoundError("Compiled apps/app/dist directory not found.")


class AppHandler(BaseHTTPRequestHandler):
    """Serve compiled FormulaFlash assets and health API over loopback HTTP."""

    def __init__(self, dist_dir: Path, *args: object, **kwargs: object) -> None:
        self.dist_dir = dist_dir
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]

    def log_message(self, format: str, *args: object) -> None:
        """Silence standard HTTP server access logging."""
        return None

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status: int, content_type: str, data: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        """Serve health endpoint and compiled frontend static bundle."""
        parsed = urlparse(self.path)
        req_path = unquote(parsed.path)
        if req_path == "/api/health":
            self._send_json(HTTPStatus.OK, {"ok": True, "app": APP_TITLE})
            return

        rel = "index.html" if req_path in ("", "/") else req_path.lstrip("/")
        candidate = (self.dist_dir / rel).resolve()
        dist_root = self.dist_dir.resolve()
        if not str(candidate).startswith(str(dist_root)) or not candidate.is_file():
            candidate = dist_root / "index.html"
        if not candidate.is_file():
            self._send_bytes(HTTPStatus.NOT_FOUND, "text/plain; charset=utf-8", b"Not Found")
            return
        mime_type, _ = mimetypes.guess_type(str(candidate))
        self._send_bytes(HTTPStatus.OK, mime_type or "application/octet-stream", candidate.read_bytes())


def run_self_test(base_url: str) -> None:
    """Verify embedded frontend HTML and health endpoint over loopback HTTP."""
    with urllib.request.urlopen(base_url, timeout=5) as resp:
        html = resp.read().decode("utf-8", "replace")
        if "FormulaFlash" not in html and "<div id=\"root\">" not in html:
            raise RuntimeError("Self-test failed: root HTML payload missing.")
    with urllib.request.urlopen(f"{base_url}api/health", timeout=5) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
        if not payload.get("ok"):
            raise RuntimeError("Self-test failed: health endpoint returned error.")
    print(f"SELF_TEST_OK {base_url}", flush=True)


def capture_screenshot(base_url: str, output_png: Path) -> None:
    """Capture headless Chromium or Edge screenshot using an isolated user-data-dir."""
    output_png.parent.mkdir(parents=True, exist_ok=True)
    candidates = ["google-chrome", "chromium", "chromium-browser", "microsoft-edge", "msedge"]
    browser = next((shutil.which(name) for name in candidates if shutil.which(name)), None)
    if not browser and sys.platform == "darwin":
        mac_app = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        browser = str(mac_app) if mac_app.is_file() else None
    if not browser:
        raise RuntimeError("No Chromium-family browser found for screenshot capture.")
    with tempfile.TemporaryDirectory() as profile_dir:
        subprocess.run(
            [
                browser,
                "--headless",
                "--disable-gpu",
                f"--user-data-dir={profile_dir}",
                "--window-size=1280,820",
                f"--screenshot={output_png}",
                base_url,
            ],
            check=True,
            timeout=30,
        )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse FormulaFlash Unix desktop CLI flags."""
    parser = argparse.ArgumentParser(description="FormulaFlash Unix desktop host")
    parser.add_argument("--self-test", action="store_true", help="Run loopback verification and exit")
    parser.add_argument("--headless-server", type=int, default=None, help="Serve over HTTP without opening browser")
    parser.add_argument("--screenshot", default=None, help="Capture a screenshot PNG path and exit")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Start local FormulaFlash loopback HTTP server and optional GUI shell."""
    args = parse_args(argv)
    dist_dir = resolve_dist_dir()
    port = int(args.headless_server) if args.headless_server is not None else 0
    handler_cls = partial(AppHandler, dist_dir)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_cls)
    actual_port = server.server_address[1]
    base_url = f"http://127.0.0.1:{actual_port}/"

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        if args.self_test:
            run_self_test(base_url)
            return 0
        if args.screenshot:
            capture_screenshot(base_url, Path(args.screenshot))
            return 0
        if args.headless_server is not None:
            print(f"READY {base_url}", flush=True)
            thread.join()
            return 0
        webbrowser.open(base_url)
        print(f"FormulaFlash running at {base_url} (Ctrl+C to quit)", flush=True)
        thread.join()
    except KeyboardInterrupt:
        sys.stderr.write("Shutting down FormulaFlash host.\n")
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
