"""
===============================================================================
 server.py  --  Threading HTTP server for PageRank Explorer Web API
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 17 (Web Server and HTTP API)
 SRS MAPPING  : FR1.1-FR6.4, NFR4

 PURPOSE
 -------
 Replaces the previous Flask server with a clean Python standard-library-only
 ThreadingHTTPServer on port 5000. Wires the React front end directly to the
 shared pipeline service layer (pipeline.py) and records search events in NDJSON.

 ENDPOINTS
 ---------
   GET  /api/status      -> pipeline status and background crawl status
   POST /api/crawl       -> trigger background crawl (validates seeds, max_pages)
   GET  /api/search      -> search query with TF-IDF and PageRank fusion
   GET  /api/top         -> top N pages by PageRank
   GET  /api/graph       -> graph snapshot with nodes and links
   GET  /api/page/<id>   -> detailed in-link/out-link/rank metadata for a page
   GET  /api/history     -> saved searches from searches.json
   POST /api/search-log  -> append search log event to searches.json
   POST /api/search      -> alias for /api/search-log

 DEPENDENCIES
 ------------
 Python standard library only: http.server, json, mimetypes, os, sys,
 threading, time, urllib.parse.
===============================================================================
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
import re
import sys
import threading
import time
from urllib.parse import parse_qs, unquote, urlparse

import crawler
import pipeline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEARCHES_FILE = os.path.join(BASE_DIR, "searches.json")
DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")

# Thread lock and shared status object for the single background crawl worker
crawl_lock = threading.Lock()
crawl_status = {
    "state": "idle",      # idle | running | done | error
    "fetched": 0,
    "max_pages": 0,
    "current": "",
    "error": None,
}


class PageRankRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the PageRank Explorer REST API."""

    def log_message(self, format_str, *args):
        """Silently suppress default stderr logging to keep console clean."""
        pass

    def _send_cors_headers(self):
        """Allow requests from Vite dev server and local origin."""
        origin = self.headers.get("Origin", "")
        if "5173" in origin or "localhost" in origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")

    def _send_json(self, status_code, payload):
        """Serialize payload to UTF-8 JSON and send HTTP response."""
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    # -------------------------------------------------------------------------
    # GET Endpoints
    # -------------------------------------------------------------------------

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = parse_qs(parsed.query)

        if path == "/api/status":
            self._handle_status()
        elif path == "/api/search":
            self._handle_search(query_params)
        elif path == "/api/top":
            self._handle_top(query_params)
        elif path == "/api/graph":
            self._handle_graph(query_params)
        elif path.startswith("/api/page/"):
            page_id = unquote(path[len("/api/page/"):])
            self._handle_page_detail(page_id)
        elif path == "/api/history":
            self._handle_history()
        else:
            self._handle_static_or_404(path)

    def _handle_status(self):
        st = pipeline.get_pipeline_status()
        response = {
            "crawled": st["crawled"],
            "edge_count": st["edge_count"],
            "page_count": st["page_count"],
            "crawl": crawl_status,
        }
        self._send_json(200, response)

    def _handle_search(self, query_params):
        q = query_params.get("q", [""])[0].strip()
        if not q:
            self._send_json(400, {"error": "Query parameter 'q' is required"})
            return

        try:
            alpha = float(query_params.get("alpha", ["0.5"])[0])
            alpha = max(0.0, min(1.0, alpha))
        except ValueError:
            alpha = 0.5

        try:
            limit = int(query_params.get("limit", ["10"])[0])
            limit = max(1, min(50, limit))
        except ValueError:
            limit = 10

        try:
            results = pipeline.search(q, alpha=alpha, limit=limit)
            self._send_json(200, {
                "results": results,
                "query": q,
                "alpha": alpha,
                "count": len(results),
            })
        except pipeline.NotCrawledError:
            self._send_json(409, {"error": "not_crawled"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_top(self, query_params):
        try:
            n = int(query_params.get("n", query_params.get("limit", ["10"]))[0])
            n = max(1, min(300, n))
        except ValueError:
            n = 10

        try:
            results = pipeline.top_pages(n=n)
            self._send_json(200, {
                "pages": results,
                "results": results,
                "total": len(results),
            })
        except pipeline.NotCrawledError:
            self._send_json(409, {"error": "not_crawled"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_graph(self, query_params):
        try:
            max_nodes = int(query_params.get("max_nodes", query_params.get("limit", ["30"]))[0])
            max_nodes = max(1, min(100, max_nodes))
        except ValueError:
            max_nodes = 30

        try:
            snapshot = pipeline.graph_snapshot(max_nodes=max_nodes)
            self._send_json(200, snapshot)
        except pipeline.NotCrawledError:
            self._send_json(409, {"error": "not_crawled"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_page_detail(self, page_id):
        if not page_id:
            self._send_json(400, {"error": "Page id is required"})
            return

        try:
            detail = pipeline.page_detail(page_id)
            if detail is None:
                self._send_json(404, {"error": "Page not found"})
            else:
                self._send_json(200, detail)
        except pipeline.NotCrawledError:
            self._send_json(409, {"error": "not_crawled"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_history(self):
        if not os.path.exists(SEARCHES_FILE):
            self._send_json(200, [])
            return

        entries = []
        try:
            with open(SEARCHES_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except OSError as err:
            self._send_json(500, {"error": "Failed to read searches.json: {0}".format(err)})
            return

        self._send_json(200, entries)

    # -------------------------------------------------------------------------
    # POST Endpoints
    # -------------------------------------------------------------------------

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            data = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if path == "/api/crawl":
            self._handle_post_crawl(data)
        elif path in ("/api/search", "/api/search-log"):
            self._handle_post_search_log(data)
        else:
            self._send_json(404, {"error": "Not found"})

    def _handle_post_crawl(self, data):
        # 1. Check if a crawl is already running
        if crawl_status["state"] == "running":
            self._send_json(409, {
                "error": "A crawl is already in progress",
                "crawl": crawl_status,
            })
            return

        # 2. Extract and validate seeds
        raw_seeds = data.get("seeds")
        if isinstance(raw_seeds, list):
            seeds = [str(s).strip() for s in raw_seeds if str(s).strip()]
        elif isinstance(raw_seeds, str):
            seeds = [s.strip() for s in re.split(r"[,;\n\r]+", raw_seeds) if s.strip()]
        else:
            seeds = []

        if not seeds:
            self._send_json(400, {"error": "Non-empty seeds are required"})
            return

        # 3. Validate max_pages (10 to 300)
        try:
            max_pages = int(data.get("max_pages", 150))
        except (ValueError, TypeError):
            self._send_json(400, {"error": "max_pages must be an integer"})
            return

        if not (10 <= max_pages <= 300):
            self._send_json(400, {"error": "max_pages must be between 10 and 300"})
            return

        force = bool(data.get("force", True))

        # 4. Check if a crawl already exists when force is False
        st = pipeline.get_pipeline_status()
        if st["crawled"] and not force:
            self._send_json(409, {
                "error": "A crawl already exists",
                "edge_count": st["edge_count"],
                "page_count": st["page_count"],
                "hint": "Pass force: true to overwrite existing crawl data",
            })
            return

        # 5. Initialize crawl status before starting background worker
        crawl_status["state"] = "running"
        crawl_status["fetched"] = 0
        crawl_status["max_pages"] = max_pages
        crawl_status["current"] = "Starting crawl..."
        crawl_status["error"] = None

        # 6. Launch background crawl thread
        def background_crawl_worker():
            with crawl_lock:
                try:
                    def on_step(info):
                        crawl_status["fetched"] = info.get("fetched", 0)
                        crawl_status["max_pages"] = info.get("max_pages", max_pages)
                        crawl_status["current"] = info.get("title", "")

                    res = pipeline.crawl_and_store(
                        seeds=seeds,
                        max_pages=max_pages,
                        progress_cb=on_step,
                        verbose=False,
                    )
                    if res.get("pages", 0) == 0:
                        crawl_status["state"] = "error"
                        crawl_status["error"] = "No pages could be fetched for seed(s): {0}. Please check that the Wikipedia article title exists.".format(", ".join(seeds))
                    else:
                        crawl_status["state"] = "done"
                        crawl_status["current"] = "Finished"
                except Exception as exc:
                    crawl_status["state"] = "error"
                    crawl_status["error"] = str(exc)

        worker_thread = threading.Thread(target=background_crawl_worker, daemon=True)
        worker_thread.start()

        self._send_json(202, {
            "status": "started",
            "message": "Crawl started in background",
            "crawl": crawl_status,
        })

    def _handle_post_search_log(self, data):
        if not data:
            self._send_json(400, {"error": "Empty search log payload"})
            return

        try:
            with open(SEARCHES_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(data, ensure_ascii=False) + "\n")
            self._send_json(201, {"status": "ok"})
        except OSError as err:
            self._send_json(500, {"error": "Failed to append search log: {0}".format(err)})

    def _handle_static_or_404(self, path):
        """Serve built frontend files if available, otherwise return 404."""
        if not os.path.exists(DIST_DIR):
            self._send_json(404, {"error": "Not found"})
            return

        clean_path = path.lstrip("/") or "index.html"
        file_path = os.path.normpath(os.path.join(DIST_DIR, clean_path))

        # Security check: must reside inside DIST_DIR
        if not file_path.startswith(DIST_DIR):
            self._send_json(403, {"error": "Forbidden"})
            return

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(DIST_DIR, "index.html")

        if os.path.exists(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or "application/octet-stream"
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except OSError:
                pass

        self._send_json(404, {"error": "Not found"})


def create_server(host="127.0.0.1", port=5000):
    """Factory creating the ThreadingHTTPServer instance."""
    return ThreadingHTTPServer((host, port), PageRankRequestHandler)


def run_server(host="127.0.0.1", port=5000):
    """Run the server until interrupted."""
    server = create_server(host, port)
    print("=" * 70)
    print("PageRank Explorer Server (http.server / ThreadingHTTPServer)")
    print("Listening on http://{0}:{1}".format(host, port))
    print("=" * 70)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
