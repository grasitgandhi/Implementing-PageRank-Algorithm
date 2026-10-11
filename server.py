"""
===============================================================================
 server.py  --  HTTP API for PageRank Explorer
===============================================================================

 Serves the React frontend's API on http://127.0.0.1:5000 using only the
 Python standard library (http.server.ThreadingHTTPServer).

 Endpoints:
     GET  /api/status           -> system status and crawl progress
     POST /api/crawl            -> start a crawl in the background
     GET  /api/search?q=...     -> search with fused relevance+pagerank
     GET  /api/top?n=10         -> top N pages by PageRank
     GET  /api/graph?max_nodes=30 -> graph nodes + links for visualization
     GET  /api/page/<id>        -> page detail (in/out links, rank)
     POST /api/search-log       -> append to searches.json (NDJSON)
     GET  /api/history          -> read searches.json

 Run:
     python server.py
===============================================================================
"""

import json
import os
import sys
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import crawler
import pipeline

# ── File paths ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EDGES_PATH = os.path.join(BASE_DIR, crawler.EDGES_FILE)
DB_PATH = os.path.join(BASE_DIR, "pages.db")
SEARCHES_FILE = os.path.join(BASE_DIR, "searches.json")

CORS_ORIGIN = "http://localhost:5173"


class APIHandler(BaseHTTPRequestHandler):
    """Handle all API requests."""

    # Suppress per-request log lines to keep the console clean.
    def log_message(self, fmt, *args):
        # Still print, but more concisely
        sys.stdout.write("[server] %s %s\n" % (self.command, self.path))
        sys.stdout.flush()

    # ── CORS ──
    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ── JSON helpers ──
    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    # ── Route dispatcher ──
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        try:
            if path == "/api/status":
                self._handle_status()
            elif path == "/api/search":
                self._handle_search(params)
            elif path == "/api/top":
                self._handle_top(params)
            elif path == "/api/graph":
                self._handle_graph(params)
            elif path.startswith("/api/page/"):
                page_id = path[len("/api/page/"):]
                self._handle_page_detail(page_id)
            elif path == "/api/history":
                self._handle_history()
            else:
                self._json_response({"error": "not_found"}, 404)
        except Exception as exc:
            self._json_response({"error": str(exc)}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            if path == "/api/crawl":
                self._handle_crawl()
            elif path == "/api/search-log":
                self._handle_search_log()
            else:
                self._json_response({"error": "not_found"}, 404)
        except Exception as exc:
            self._json_response({"error": str(exc)}, 500)

    # ── Endpoint handlers ──

    def _handle_status(self):
        crawl_status = pipeline.get_crawl_status()
        crawled = os.path.exists(EDGES_PATH) and os.path.exists(DB_PATH)

        edge_count = 0
        page_count = 0
        if crawled:
            status = crawler.edges_cache_status(EDGES_PATH)
            edge_count = status["edge_count"]
            page_count = status["page_count"]

        self._json_response({
            "crawled": crawled,
            "edge_count": edge_count,
            "page_count": page_count,
            "crawl": crawl_status,
        })

    def _handle_crawl(self):
        body = self._read_body()
        if not body:
            self._json_response({"error": "Empty or invalid JSON body"}, 400)
            return

        # Parse seeds: accept list or comma-separated string
        seeds_raw = body.get("seeds", "")
        if isinstance(seeds_raw, list):
            seeds = [s.strip() for s in seeds_raw if isinstance(s, str) and s.strip()]
        elif isinstance(seeds_raw, str):
            seeds = [s.strip() for s in seeds_raw.split(",") if s.strip()]
        else:
            seeds = []

        if not seeds:
            self._json_response({"error": "Non-empty seeds required"}, 400)
            return

        max_pages = body.get("max_pages", 150)
        try:
            max_pages = int(max_pages)
        except (ValueError, TypeError):
            self._json_response({"error": "max_pages must be an integer"}, 400)
            return

        if max_pages < 10 or max_pages > 300:
            self._json_response({"error": "max_pages must be between 10 and 300"}, 400)
            return

        force = bool(body.get("force", False))

        # If a crawl already exists and force is false, return 409
        if os.path.exists(EDGES_PATH) and not force:
            status = crawler.edges_cache_status(EDGES_PATH)
            self._json_response({
                "error": "crawl_exists",
                "edge_count": status["edge_count"],
                "page_count": status["page_count"],
                "message": "A crawl already exists. Set force=true to re-crawl.",
            }, 409)
            return

        started = pipeline.start_background_crawl(seeds, max_pages, EDGES_PATH, DB_PATH)
        if not started:
            self._json_response({
                "error": "crawl_running",
                "message": "A crawl is already in progress.",
            }, 409)
            return

        self._json_response({"status": "started", "max_pages": max_pages}, 202)

    def _handle_search(self, params):
        q = params.get("q", [""])[0]
        if not q.strip():
            self._json_response({"error": "Query parameter 'q' is required"}, 400)
            return

        try:
            alpha = float(params.get("alpha", ["0.5"])[0])
        except ValueError:
            alpha = 0.5

        try:
            limit = int(params.get("limit", ["10"])[0])
        except ValueError:
            limit = 10

        results = pipeline.do_search(q, alpha, limit, EDGES_PATH, DB_PATH)
        if results is None:
            self._json_response({"error": "not_crawled",
                                  "message": "No crawled data available. Run a crawl first."}, 409)
            return

        self._json_response({"query": q, "alpha": alpha, "results": results})

    def _handle_top(self, params):
        try:
            n = int(params.get("n", ["10"])[0])
        except ValueError:
            n = 10

        top = pipeline.get_top_pages(n, EDGES_PATH, DB_PATH)
        if top is None:
            self._json_response({"error": "not_crawled"}, 409)
            return

        self._json_response({"top": top})

    def _handle_graph(self, params):
        try:
            max_nodes = int(params.get("max_nodes", ["30"])[0])
        except ValueError:
            max_nodes = 30

        snap = pipeline.get_graph_snapshot(max_nodes, EDGES_PATH, DB_PATH)
        if snap is None:
            self._json_response({"error": "not_crawled"}, 409)
            return

        self._json_response(snap)

    def _handle_page_detail(self, page_id):
        if not page_id:
            self._json_response({"error": "page_id is required"}, 400)
            return

        detail = pipeline.get_page_detail(page_id, EDGES_PATH, DB_PATH)
        if detail is None:
            self._json_response({"error": "not_found"}, 404)
            return

        self._json_response(detail)

    def _handle_search_log(self):
        data = self._read_body()
        if not data:
            self._json_response({"error": "Empty body"}, 400)
            return

        with open(SEARCHES_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")

        self._json_response({"status": "ok"}, 201)

    def _handle_history(self):
        if not os.path.exists(SEARCHES_FILE):
            self._json_response([])
            return

        entries = []
        with open(SEARCHES_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        self._json_response(entries)


def main():
    host = "127.0.0.1"
    port = 5000
    server = ThreadingHTTPServer((host, port), APIHandler)

    print("=" * 60)
    print("PageRank Explorer API Server")
    print("=" * 60)
    print("  Listening on http://{0}:{1}".format(host, port))
    print("  CORS origin : {0}".format(CORS_ORIGIN))
    print("  edges.txt   : {0}".format(EDGES_PATH))
    print("  pages.db    : {0}".format(DB_PATH))
    print("  searches    : {0}".format(SEARCHES_FILE))
    print("=" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
