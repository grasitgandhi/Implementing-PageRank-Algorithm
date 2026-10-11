"""
===============================================================================
 tests/test_server.py  --  HTTP API Integration tests for server.py
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 PURPOSE      : Test server.py's HTTP endpoints against a live ThreadingHTTPServer
                on an ephemeral port using standard library urllib.
===============================================================================
"""

import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
import pipeline


class TestServerAPI(unittest.TestCase):
    """Test the HTTP API server endpoints."""

    @classmethod
    def setUpClass(cls):
        # Create temp dir for isolated test data
        cls.test_dir = tempfile.mkdtemp()
        cls.edges_path = os.path.join(cls.test_dir, "edges.txt")
        cls.db_path = os.path.join(cls.test_dir, "pages.db")
        cls.searches_path = os.path.join(cls.test_dir, "searches.json")

        # Monkey patch server paths to temp dir
        cls.orig_edges = server.EDGES_PATH
        cls.orig_db = server.DB_PATH
        cls.orig_searches = server.SEARCHES_FILE
        server.EDGES_PATH = cls.edges_path
        server.DB_PATH = cls.db_path
        server.SEARCHES_FILE = cls.searches_path

        # Start server on ephemeral port (port 0)
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.APIHandler)
        cls.port = cls.httpd.server_address[1]
        cls.base_url = "http://127.0.0.1:{0}".format(cls.port)

        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        shutil.rmtree(cls.test_dir, ignore_errors=True)
        server.EDGES_PATH = cls.orig_edges
        server.DB_PATH = cls.orig_db
        server.SEARCHES_FILE = cls.orig_searches

    def _request(self, path, method="GET", data=None):
        url = "{0}{1}".format(self.base_url, path)
        headers = {}
        encoded_data = None
        if data is not None:
            headers["Content-Type"] = "application/json"
            encoded_data = json.dumps(data).encode("utf-8")

        req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                body = resp.read().decode("utf-8")
                return status, json.loads(body) if body else None, resp.headers
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8")
            return exc.code, json.loads(body) if body else None, exc.headers

    def test_status_endpoint_uncrawled(self):
        """GET /api/status returns crawled=False before any data exists."""
        status, body, _ = self._request("/api/status")
        self.assertEqual(status, 200)
        self.assertFalse(body["crawled"])
        self.assertIn("crawl", body)
        self.assertIn("state", body["crawl"])

    def test_search_uncrawled_returns_409(self):
        """GET /api/search when nothing is crawled returns 409 not_crawled."""
        status, body, _ = self._request("/api/search?q=test")
        self.assertEqual(status, 409)
        self.assertEqual(body.get("error"), "not_crawled")

    def test_search_validation_empty_query(self):
        """GET /api/search with no q parameter returns 400."""
        status, body, _ = self._request("/api/search")
        self.assertEqual(status, 400)

    def test_crawl_validation(self):
        """POST /api/crawl validates inputs properly."""
        # Empty seeds
        status, body, _ = self._request("/api/crawl", method="POST", data={"seeds": ""})
        self.assertEqual(status, 400)

        # max_pages out of range
        status, body, _ = self._request("/api/crawl", method="POST", data={"seeds": "PageRank", "max_pages": 5})
        self.assertEqual(status, 400)

        status, body, _ = self._request("/api/crawl", method="POST", data={"seeds": "PageRank", "max_pages": 500})
        self.assertEqual(status, 400)

    def test_search_log_and_history(self):
        """POST /api/search-log logs an entry and GET /api/history reads it back."""
        log_entry = {
            "query": "PageRank algorithm",
            "alpha": 0.5,
            "timestamp": "2026-10-11T12:00:00Z",
            "result_count": 5,
        }
        status, body, _ = self._request("/api/search-log", method="POST", data=log_entry)
        self.assertEqual(status, 201)

        status, history, _ = self._request("/api/history")
        self.assertEqual(status, 200)
        self.assertTrue(len(history) >= 1)
        self.assertEqual(history[-1]["query"], "PageRank algorithm")

    def test_options_cors_headers(self):
        """OPTIONS request returns 204 and CORS headers."""
        url = "{0}/api/status".format(self.base_url)
        req = urllib.request.Request(url, method="OPTIONS")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 204)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), server.CORS_ORIGIN)

    def test_not_found_endpoint(self):
        """Unknown paths return 404."""
        status, body, _ = self._request("/api/nonexistent")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
