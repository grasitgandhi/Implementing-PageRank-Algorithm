"""
===============================================================================
 tests/test_pipeline.py  --  Tests for shared service layer and HTTP server API
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 17
 COVERS       : pipeline.py (crawl_and_store, load_index, search, top_pages),
                server.py (ThreadingHTTPServer HTTP endpoints via urllib)

 PURPOSE
 -------
 Comprehensive unit tests for the pipeline service layer and HTTP REST server.
 Runs completely offline with a fake crawler and temporary directories.
 Never touches the committed edges.txt or pages.db.
===============================================================================
"""

import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError
import urllib.parse
import urllib.request

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import crawler
import graph_model
import page_store
import pagerank_engine
import pipeline
import search_engine
import server


class TestPipelineService(unittest.TestCase):
    """Test the shared service layer in pipeline.py."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.edges_path = os.path.join(self.test_dir, "test_edges.txt")
        self.db_path = os.path.join(self.test_dir, "test_pages.db")
        pipeline.invalidate_cache()

    def tearDown(self):
        pipeline.invalidate_cache()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_not_crawled_case(self):
        """When data files are missing, pipeline operations must report not-crawled."""
        status = pipeline.get_pipeline_status(self.edges_path, self.db_path)
        self.assertFalse(status["crawled"])
        self.assertEqual(status["edge_count"], 0)
        self.assertEqual(status["page_count"], 0)

        self.assertIsNone(pipeline.load_index(self.edges_path, self.db_path))

        with self.assertRaises(pipeline.NotCrawledError):
            pipeline.search("pagerank", edges_path=self.edges_path, db_path=self.db_path)

        with self.assertRaises(pipeline.NotCrawledError):
            pipeline.top_pages(n=5, edges_path=self.edges_path, db_path=self.db_path)

        with self.assertRaises(pipeline.NotCrawledError):
            pipeline.graph_snapshot(max_nodes=5, edges_path=self.edges_path, db_path=self.db_path)

    def test_crawl_and_store_with_fake_crawler(self):
        """crawl_and_store must atomically write edges and pages.db without network."""
        # Synthetic fake pages and edges
        fake_pages = {
            "Alpha": "Alpha is a foundational search algorithm topic with ranking.",
            "Beta": "Beta is a web crawler that links to Alpha and Gamma.",
            "Gamma": "Gamma discusses link structure and search engine authority.",
        }
        fake_edges = [
            ("Alpha", "Beta"),
            ("Beta", "Gamma"),
            ("Gamma", "Alpha"),
            ("Beta", "Alpha"),
        ]

        # Intercept crawler.crawl with a fake implementation
        original_crawl = crawler.crawl
        progress_events = []

        def fake_crawl(seed_titles, max_pages, host=None, delay_seconds=0, verbose=False, progress_cb=None):
            if progress_cb:
                progress_cb({"title": "Alpha", "fetched": 1, "max_pages": max_pages, "queued": 2})
                progress_cb({"title": "Beta", "fetched": 2, "max_pages": max_pages, "queued": 1})
                progress_cb({"title": "Gamma", "fetched": 3, "max_pages": max_pages, "queued": 0})
            return fake_edges, fake_pages

        try:
            crawler.crawl = fake_crawl

            def on_progress(p):
                progress_events.append(p)

            summary = pipeline.crawl_and_store(
                seeds=["Alpha", "Beta"],
                max_pages=10,
                edges_path=self.edges_path,
                db_path=self.db_path,
                progress_cb=on_progress,
                verbose=False,
            )

            # Check summary
            self.assertEqual(summary["pages"], 3)
            self.assertEqual(summary["edges"], 4)
            self.assertEqual(summary["dangling"], 0)
            self.assertEqual(len(progress_events), 3)

            # Files must exist on disk atomically
            self.assertTrue(os.path.exists(self.edges_path))
            self.assertTrue(os.path.exists(self.db_path))

            # Verify contents of store
            store = page_store.SimplePageStore(self.db_path)
            self.assertEqual(store.count(), 3)
            alpha_rec = store.get("Alpha")
            self.assertIsNotNone(alpha_rec)
            self.assertEqual(alpha_rec["title"], "Alpha")

            # Check pipeline status
            st = pipeline.get_pipeline_status(self.edges_path, self.db_path)
            self.assertTrue(st["crawled"])
            self.assertEqual(st["edge_count"], 4)
            self.assertEqual(st["page_count"], 3)

            # Test search over the crawled index
            results = pipeline.search(
                "algorithm ranking",
                alpha=0.5,
                limit=5,
                edges_path=self.edges_path,
                db_path=self.db_path,
            )
            self.assertGreater(len(results), 0)
            top_result = results[0]
            self.assertEqual(top_result["page_id"], "Alpha")
            self.assertIn("final", top_result)
            self.assertIn("relevance", top_result)
            self.assertIn("pagerank", top_result)
            self.assertIn("raw_cosine", top_result)
            self.assertIn("inLinks", top_result)
            self.assertIn("outLinks", top_result)
            self.assertIn("url", top_result)

            # Test top_pages
            top = pipeline.top_pages(n=3, edges_path=self.edges_path, db_path=self.db_path)
            self.assertEqual(len(top), 3)
            self.assertEqual(top[0]["rank"], 1)

            # Test graph_snapshot
            snapshot = pipeline.graph_snapshot(
                max_nodes=3, edges_path=self.edges_path, db_path=self.db_path
            )
            self.assertEqual(len(snapshot["nodes"]), 3)
            self.assertGreater(len(snapshot["links"]), 0)

            # Test page_detail
            detail = pipeline.page_detail("Alpha", edges_path=self.edges_path, db_path=self.db_path)
            self.assertIsNotNone(detail)
            self.assertEqual(detail["id"], "Alpha")
            self.assertIn("Beta", detail["outLinks"])

        finally:
            crawler.crawl = original_crawl


class TestServerApi(unittest.TestCase):
    """Test HTTP API endpoints against a live ThreadingHTTPServer on an ephemeral port."""

    @classmethod
    def setUpClass(cls):
        # Create server on ephemeral port (port 0 lets OS allocate an available port)
        cls.httpd = server.create_server("127.0.0.1", 0)
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        if os.path.exists(server.SEARCHES_FILE):
            try:
                os.remove(server.SEARCHES_FILE)
            except OSError:
                pass

    def _url(self, path):
        return "http://127.0.0.1:{0}{1}".format(self.port, path)

    def test_status_endpoint(self):
        """GET /api/status returns valid JSON with pipeline status and crawl status."""
        req = urllib.request.Request(self._url("/api/status"))
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("crawled", data)
            self.assertIn("edge_count", data)
            self.assertIn("page_count", data)
            self.assertIn("crawl", data)
            self.assertIn("state", data["crawl"])

    def test_search_not_crawled_or_success(self):
        """GET /api/search returns 409 if not crawled or 200 with result list."""
        st = pipeline.get_pipeline_status()
        url = self._url("/api/search?q=pagerank&alpha=0.5&limit=5")
        if not st["crawled"]:
            with self.assertRaises(HTTPError) as ctx:
                urllib.request.urlopen(url)
            self.assertEqual(ctx.exception.code, 409)
            data = json.loads(ctx.exception.read().decode("utf-8"))
            self.assertEqual(data.get("error"), "not_crawled")
        else:
            with urllib.request.urlopen(url) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertIn("results", data)
                self.assertIsInstance(data["results"], list)

    def test_top_pages_endpoint(self):
        """GET /api/top returns top pages."""
        st = pipeline.get_pipeline_status()
        url = self._url("/api/top?n=5")
        if not st["crawled"]:
            with self.assertRaises(HTTPError) as ctx:
                urllib.request.urlopen(url)
            self.assertEqual(ctx.exception.code, 409)
        else:
            with urllib.request.urlopen(url) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertIn("pages", data)

    def test_crawl_validation_failures(self):
        """POST /api/crawl validates input parameters."""
        # 1. Empty seeds -> 400
        req = urllib.request.Request(
            self._url("/api/crawl"),
            data=json.dumps({"seeds": [], "max_pages": 50}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 400)

        # 2. max_pages out of bounds -> 400
        req2 = urllib.request.Request(
            self._url("/api/crawl"),
            data=json.dumps({"seeds": ["PageRank"], "max_pages": 5}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as ctx2:
            urllib.request.urlopen(req2)
        self.assertEqual(ctx2.exception.code, 400)

    def test_search_log_and_history(self):
        """POST /api/search-log appends entry and GET /api/history retrieves it."""
        event = {
            "query": "unit test query",
            "alpha": 0.5,
            "timestamp": "2026-10-11T12:00:00Z",
            "resultsCount": 3,
        }
        post_req = urllib.request.Request(
            self._url("/api/search-log"),
            data=json.dumps(event).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(post_req) as resp:
            self.assertEqual(resp.status, 201)

        get_req = urllib.request.Request(self._url("/api/history"))
        with urllib.request.urlopen(get_req) as resp:
            self.assertEqual(resp.status, 200)
            history = json.loads(resp.read().decode("utf-8"))
            self.assertIsInstance(history, list)
            queries = [item.get("query") for item in history]
            self.assertIn("unit test query", queries)


if __name__ == "__main__":
    unittest.main()
