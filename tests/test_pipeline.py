"""
===============================================================================
 tests/test_pipeline.py  --  Tests for the shared service layer (pipeline.py)
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 PURPOSE      : Test crawl_and_store, load_index, search, and not-crawled handling
                using a mock crawler and temporary test directory.
===============================================================================
"""

import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import crawler
import pipeline


class TestPipeline(unittest.TestCase):
    """Unit tests for the pipeline service layer."""

    def setUp(self):
        # Create a clean temp directory for every test
        self.test_dir = tempfile.mkdtemp()
        self.edges_path = os.path.join(self.test_dir, "edges.txt")
        self.db_path = os.path.join(self.test_dir, "pages.db")
        # Invalidate cache before each test
        pipeline._invalidate_index_cache()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)
        pipeline._invalidate_index_cache()

    def test_not_crawled_case(self):
        """When data files do not exist, load_index and search return None / handle gracefully."""
        idx = pipeline.load_index(self.edges_path, self.db_path)
        self.assertIsNone(idx)

        res = pipeline.do_search("python", 0.5, 10, self.edges_path, self.db_path)
        self.assertIsNone(res)

        top = pipeline.get_top_pages(10, self.edges_path, self.db_path)
        self.assertIsNone(top)

        snap = pipeline.get_graph_snapshot(30, self.edges_path, self.db_path)
        self.assertIsNone(snap)

    def test_crawl_and_store_with_mock_crawler(self):
        """crawl_and_store executes the pipeline using simulated crawled data without network."""
        fake_edges = [
            ("PageRank", "Search_engine"),
            ("Search_engine", "PageRank"),
            ("Google", "PageRank"),
            ("Google", "Search_engine"),
        ]
        fake_pages = {
            "PageRank": "PageRank algorithm assigns numerical weights to hyperlinked documents.",
            "Search_engine": "A search engine indexes documents and provides relevance ranking.",
            "Google": "Google is a technology company known for its search engine and PageRank.",
        }

        # Mock crawler.crawl
        original_crawl = crawler.crawl
        crawler.crawl = lambda seeds, max_pages, verbose=True: (fake_edges, fake_pages)
        try:
            summary = pipeline.crawl_and_store(
                seeds=["PageRank"],
                max_pages=3,
                edges_path=self.edges_path,
                db_path=self.db_path,
            )

            self.assertEqual(summary["pages"], 3)
            self.assertEqual(summary["edges"], 4)
            self.assertTrue(os.path.exists(self.edges_path))
            self.assertTrue(os.path.exists(self.db_path))

            # Test load_index
            idx = pipeline.load_index(self.edges_path, self.db_path)
            self.assertIsNotNone(idx)
            self.assertIn("PageRank", idx["scores"])
            self.assertIn("Search_engine", idx["scores"])
            self.assertIn("Google", idx["scores"])

            # Test search
            results = pipeline.do_search("algorithm", 0.5, 10, self.edges_path, self.db_path)
            self.assertIsNotNone(results)
            self.assertTrue(len(results) > 0)
            first = results[0]
            self.assertEqual(first["page_id"], "PageRank")
            self.assertIn("final", first)
            self.assertIn("relevance", first)
            self.assertIn("pagerank", first)
            self.assertIn("inLinks", first)
            self.assertIn("outLinks", first)

            # Test top_pages
            top = pipeline.get_top_pages(3, self.edges_path, self.db_path)
            self.assertIsNotNone(top)
            self.assertEqual(len(top), 3)

            # Test graph_snapshot
            snap = pipeline.get_graph_snapshot(10, self.edges_path, self.db_path)
            self.assertIsNotNone(snap)
            self.assertEqual(len(snap["nodes"]), 3)
            self.assertEqual(len(snap["links"]), 4)

            # Test page_detail
            detail = pipeline.get_page_detail("PageRank", self.edges_path, self.db_path)
            self.assertIsNotNone(detail)
            self.assertEqual(detail["page_id"], "PageRank")
            self.assertEqual(detail["inDegree"], 2)  # Google and Search_engine link to PageRank
            self.assertEqual(detail["outDegree"], 1) # PageRank links to Search_engine

        finally:
            crawler.crawl = original_crawl


if __name__ == "__main__":
    unittest.main()
