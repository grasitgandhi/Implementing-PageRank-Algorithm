"""
===============================================================================
 tests/test_end_to_end.py  --  Full pipeline test: crawl -> rank -> search
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 16 (Days 74-77)
 COVERS       : cli.py and the integration of all five modules
 SRS MAPPING  : FR6.1-FR6.4, NFR4, NFR8

 PURPOSE
 -------
 The other three test files each check one module in isolation. They all pass
 and the pipeline can still be broken, because the thing they cannot test is the
 JOINS -- whether the dict crawler.crawl() returns is shaped the way
 page_store.insert() expects, whether the page ids in pages.db match the node
 names in edges.txt, whether a function signature changed in one module and the
 caller in another was never updated.

 That class of bug is exactly what Phase 4 integration is for, and this file is
 what catches it.

 NO NETWORK REQUIRED
 -------------------
 The crawl stage is tested against a FIXTURE: a small graph and corpus written
 out by hand into temporary edges.txt and pages.db files, in precisely the format
 the real crawler produces. Everything downstream then runs on it for real.

 That is a deliberate trade. A test that crawls live would take eight minutes,
 fail whenever the wifi hiccups, and give different answers each week as
 Wikipedia edits its articles -- so it would get ignored, which makes it worse
 than no test. This version runs in under a second and gives the same answer
 every time. The live crawl is exercised separately by running the real thing.

 HOW TO RUN
 ----------
     python tests/test_end_to_end.py          (from the project root)

 Prints ALL TESTS PASSED at the end if the whole pipeline holds together.
===============================================================================
"""

import os
import sys

# The modules under test live one directory up. See the note in
# tests/test_math_modules.py about `sys` in test files.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cli
import crawler
import graph_model
import page_store
import pagerank_engine
import search_engine


# Temporary fixture files, removed at the end of the run.
FIXTURE_EDGES = "test_e2e_edges.txt"
FIXTURE_DB = "test_e2e_pages.db"

# A hand-built six-page graph. "Hub" is linked to by nearly everything, so it
# must come out on top by PageRank. "Orphan" is linked to by nobody and has no
# out-links either, so it is both rank-starved and a dead end -- the two edge
# cases that matter, in one fixture.
FIXTURE_LINKS = [
    ("Hub", "Spoke_A"),
    ("Hub", "Spoke_B"),
    ("Spoke_A", "Hub"),
    ("Spoke_B", "Hub"),
    ("Spoke_C", "Hub"),
    ("Spoke_C", "Spoke_A"),
    ("Lonely", "Hub"),
]

FIXTURE_TEXTS = {
    "Hub": "The hub page is about pagerank and the link structure of the web",
    "Spoke_A": "Spoke A discusses crawling web pages over raw network sockets",
    "Spoke_B": "Spoke B explains term frequency and inverse document frequency",
    "Spoke_C": "Spoke C covers gaussian elimination and solving linear systems",
    "Lonely": "Lonely is about statistics, variance and the arithmetic mean",
    "Orphan": "Orphan mentions pagerank but nothing at all links to this page",
}

TOLERANCE = 1e-7


def almost_equal(actual, expected, tolerance=TOLERANCE):
    """True if two floats agree within tolerance."""
    return abs(actual - expected) < tolerance


def build_fixture():
    """Write the fixture edges.txt and pages.db in the crawler's own formats.

    Writing through crawler.write_edges_file and page_store.insert rather than
    hand-writing the files, so the fixture is produced by the same code the real
    pipeline uses. A fixture written by hand could drift out of step with the
    real format and quietly make the test meaningless.
    """
    crawler.write_edges_file(FIXTURE_LINKS, FIXTURE_EDGES)

    graph = graph_model.build_graph(FIXTURE_LINKS)
    store = page_store.SimplePageStore(FIXTURE_DB, reset=True)

    for title, text in FIXTURE_TEXTS.items():
        store.insert(title, title.replace("_", " "),
                     graph_model.out_degree(graph, title), text)

    return graph, store


def cleanup():
    """Remove the fixture files, whether the tests passed or not."""
    for path in (FIXTURE_EDGES, FIXTURE_DB):
        if os.path.exists(path):
            os.remove(path)


# =============================================================================
# Stage joins -- the handoffs between modules
# =============================================================================

def test_crawler_output_feeds_graph_model():
    """The edge list the crawler writes must load back into a usable graph."""
    edges = crawler.read_edges_file(FIXTURE_EDGES)

    assert len(edges) == len(FIXTURE_LINKS), \
        "expected {0} edges back, got {1}".format(len(FIXTURE_LINKS), len(edges))

    graph = graph_model.build_graph(edges)

    # Orphan appears in no edge at all, so it is correctly absent from a graph
    # built purely from edges -- it only exists in pages.db.
    assert "Hub" in graph and "Spoke_A" in graph, "graph is missing crawled pages"
    print("PASS  test_crawler_output_feeds_graph_model")


def test_graph_model_output_feeds_pagerank():
    """The graph must rank without error, and the scores must total 1.0."""
    graph = graph_model.build_graph(crawler.read_edges_file(FIXTURE_EDGES))
    scores, iterations = pagerank_engine.pagerank(graph)

    assert len(scores) == len(graph), "every page must get a score"
    assert almost_equal(sum(scores.values()), 1.0), \
        "scores must sum to 1.0, got {0!r}".format(sum(scores.values()))
    assert iterations < pagerank_engine.DEFAULT_MAX_ITERATIONS, \
        "should converge well before the iteration cap"
    print("PASS  test_graph_model_output_feeds_pagerank")


def test_page_store_output_feeds_search_engine():
    """Records read back from pages.db must build a working SearchEngine.

    This is the join that breaks most easily: page_store hands back dicts with
    an "id" key, and SearchEngine wants {page_id: text}. If either side renames
    a field, this is what notices.
    """
    store = page_store.SimplePageStore(FIXTURE_DB)
    page_texts = {record["id"]: record["text"] for record in store.iter_records()}

    assert len(page_texts) == len(FIXTURE_TEXTS), \
        "expected {0} pages, got {1}".format(len(FIXTURE_TEXTS), len(page_texts))

    graph = graph_model.build_graph(crawler.read_edges_file(FIXTURE_EDGES))
    scores, _ = pagerank_engine.pagerank(graph)

    engine = search_engine.SearchEngine(page_texts, scores)

    assert len(engine.vectors) == len(page_texts), "a vector per page was not built"
    print("PASS  test_page_store_output_feeds_search_engine")


def test_page_ids_match_between_the_two_data_files():
    """Node names in edges.txt must be the same strings as ids in pages.db.

    If the crawler ever stored a prettified title ("Larry Page") while writing
    the raw one ("Larry_Page") into edges.txt, every page would score zero
    authority and the fusion would silently collapse to relevance only. Nothing
    would crash -- the results would just quietly get worse.
    """
    edge_pages = set()
    for source, target in crawler.read_edges_file(FIXTURE_EDGES):
        edge_pages.add(source)
        edge_pages.add(target)

    store = page_store.SimplePageStore(FIXTURE_DB)
    stored_ids = {record["id"] for record in store.iter_records()}

    overlap = edge_pages & stored_ids
    assert len(overlap) >= 5, \
        "page ids do not line up between the files: edges {0!r} vs store {1!r}".format(
            sorted(edge_pages), sorted(stored_ids))
    print("PASS  test_page_ids_match_between_the_two_data_files")


# =============================================================================
# Whole-pipeline behaviour
# =============================================================================

def test_the_most_linked_page_ranks_first():
    """Hub is linked to by four of five linking pages, so it must rank top.

    A result we can predict from the fixture by eye, which is what makes it a
    real test rather than a restatement of whatever the code happens to output.
    """
    graph = graph_model.build_graph(crawler.read_edges_file(FIXTURE_EDGES))
    scores, _ = pagerank_engine.pagerank(graph)

    best_page = pagerank_engine.top_pages(scores, 1)[0][0]

    assert best_page == "Hub", \
        "Hub has the most incoming links but {0!r} ranked first".format(best_page)
    print("PASS  test_the_most_linked_page_ranks_first")


def test_search_finds_the_page_that_matches():
    """A query about a distinctive topic must return the page covering it."""
    graph = graph_model.build_graph(crawler.read_edges_file(FIXTURE_EDGES))
    scores, _ = pagerank_engine.pagerank(graph)

    store = page_store.SimplePageStore(FIXTURE_DB)
    page_texts = {record["id"]: record["text"] for record in store.iter_records()}

    engine = search_engine.SearchEngine(page_texts, scores)

    # Each query uses terms unique to one fixture page.
    expected = {
        "sockets crawling network": "Spoke_A",
        "gaussian elimination linear": "Spoke_C",
        "variance arithmetic statistics": "Lonely",
    }

    for query, wanted_page in expected.items():
        results = engine.search(query, alpha=1.0)
        assert results, "query {0!r} returned nothing".format(query)
        assert results[0]["page_id"] == wanted_page, \
            "query {0!r} should find {1!r}, got {2!r}".format(
                query, wanted_page, results[0]["page_id"])

    print("PASS  test_search_finds_the_page_that_matches")


def test_a_page_absent_from_the_graph_still_searchable():
    """Orphan has text but no edges, so it must score zero authority, not crash.

    This really happens on a live crawl: the page limit stops the crawl before
    every discovered page gets fetched, leaving records whose links were never
    recorded.
    """
    graph = graph_model.build_graph(crawler.read_edges_file(FIXTURE_EDGES))
    scores, _ = pagerank_engine.pagerank(graph)

    store = page_store.SimplePageStore(FIXTURE_DB)
    page_texts = {record["id"]: record["text"] for record in store.iter_records()}

    engine = search_engine.SearchEngine(page_texts, scores)

    assert "Orphan" in engine.pagerank, "Orphan should still be known to the engine"
    assert engine.pagerank["Orphan"] == 0.0, \
        "a page with no graph entry should get 0.0 authority, got {0!r}".format(
            engine.pagerank["Orphan"])

    # It is still findable on its own distinctive words.
    results = engine.search("orphan nothing links", alpha=1.0)
    assert any(row["page_id"] == "Orphan" for row in results), \
        "Orphan should still be searchable on its text"
    print("PASS  test_a_page_absent_from_the_graph_still_searchable")


# =============================================================================
# cli.py wiring
# =============================================================================

def test_cli_parser_accepts_all_three_commands():
    """The parser must recognise crawl, rank and search with their options."""
    parser = cli.build_parser()

    crawl_arguments = parser.parse_args(["crawl", "--seeds", "A,B", "--max-pages", "7"])
    assert crawl_arguments.command == "crawl"
    assert crawl_arguments.seeds == "A,B"
    assert crawl_arguments.max_pages == 7, "--max-pages did not reach max_pages"

    rank_arguments = parser.parse_args(["rank", "--top", "3"])
    assert rank_arguments.command == "rank" and rank_arguments.top == 3

    search_arguments = parser.parse_args(["search", "hello world", "--alpha", "0.25"])
    assert search_arguments.command == "search"
    assert search_arguments.query == "hello world", "the query must stay one string"
    assert almost_equal(search_arguments.alpha, 0.25)

    print("PASS  test_cli_parser_accepts_all_three_commands")


def test_cli_with_no_arguments_prints_usage():
    """Running the tool bare must show help, not raise or exit non-zero."""
    try:
        cli.main([])
    except SystemExit as exit_signal:
        raise AssertionError(
            "no arguments should print usage, not exit ({0!r})".format(exit_signal))
    print("PASS  test_cli_with_no_arguments_prints_usage")


def test_cli_rank_runs_against_the_fixture():
    """The rank command must run end to end on fixture data files."""
    cli.main(["rank", "--edges", FIXTURE_EDGES, "--db", FIXTURE_DB, "--top", "3"])
    print("PASS  test_cli_rank_runs_against_the_fixture")


def test_cli_search_runs_against_the_fixture():
    """The search command must run end to end on fixture data files."""
    cli.main(["search", "pagerank link structure",
              "--edges", FIXTURE_EDGES, "--db", FIXTURE_DB, "--top", "3"])
    print("PASS  test_cli_search_runs_against_the_fixture")


def test_cli_exits_cleanly_when_data_is_missing():
    """rank without edges.txt must exit with a message, not a traceback.

    This is the failure an evaluator is most likely to trigger -- running rank
    before crawl on a fresh clone -- so it gets its own test.
    """
    try:
        cli.main(["rank", "--edges", "definitely_not_a_real_file.txt"])
    except SystemExit as exit_signal:
        assert exit_signal.code == 1, \
            "missing data should exit with status 1, got {0!r}".format(exit_signal.code)
        print("PASS  test_cli_exits_cleanly_when_data_is_missing")
        return
    raise AssertionError("a missing edges file should have exited")


if __name__ == "__main__":
    print("=" * 70)
    print("tests/test_end_to_end.py  --  crawl -> rank -> search")
    print("=" * 70)
    print()

    try:
        build_fixture()
        print("fixture built: {0} pages, {1} links\n"
              .format(len(FIXTURE_TEXTS), len(FIXTURE_LINKS)))

        print("-- module joins " + "-" * 52)
        test_crawler_output_feeds_graph_model()
        test_graph_model_output_feeds_pagerank()
        test_page_store_output_feeds_search_engine()
        test_page_ids_match_between_the_two_data_files()

        print("\n-- pipeline behaviour " + "-" * 46)
        test_the_most_linked_page_ranks_first()
        test_search_finds_the_page_that_matches()
        test_a_page_absent_from_the_graph_still_searchable()

        print("\n-- cli.py " + "-" * 58)
        test_cli_parser_accepts_all_three_commands()
        test_cli_with_no_arguments_prints_usage()
        test_cli_exits_cleanly_when_data_is_missing()

        print("\n-- cli.py live runs (their output follows) " + "-" * 25)
        print()
        test_cli_rank_runs_against_the_fixture()
        print()
        test_cli_search_runs_against_the_fixture()
    finally:
        cleanup()

    print()
    print("=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
