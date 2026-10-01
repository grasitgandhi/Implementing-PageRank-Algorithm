"""
===============================================================================
 test_graph_model.py  --  Assert-based tests for graph_model.py
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 8 (Days 34-38)
 SRS MAPPING  : FR3.1, FR3.2, FR3.3, NFR8 (each module independently testable)

 PURPOSE
 -------
 Prove that dangling-page detection is correct, because it is the one piece of
 graph_model.py that the PageRank engine's correctness depends on. If a dangling
 page is missed, its score leaks every iteration and the total quietly stops
 summing to 1.0 -- a failure that produces plausible-looking numbers rather than
 an error message, which is exactly the kind of bug a test has to catch.

 WHY PLAIN assert AND NOT unittest OR pytest
 -------------------------------------------
 pytest is a PyPI package and therefore out of bounds for this project. unittest
 is in the standard library but outside the module allowance we agreed, and it
 would add class boilerplate around what are one-line checks. A bare assert
 gives us the same guarantee: the expression must be true, or the program stops
 with a traceback pointing at the exact line. Every test prints a PASS line so a
 successful run is visibly successful, not just silent.

 (Checkpoint 13 folds this file into tests/test_math_modules.py together with
 the pagerank_engine and linear_solve_pagerank tests.)

 DEPENDENCIES
 ------------
 graph_model.py must be in the same directory. No third-party packages.

 HOW TO RUN
 ----------
     python test_graph_model.py

 Exits printing "ALL TESTS PASSED" if everything holds; raises AssertionError
 on the first failure.
===============================================================================
"""

import graph_model


def test_dangling_page_is_detected():
    """A page with no outgoing links must be reported as dangling.

    Graph:  A -> B,  B -> C,  and C links to nothing.
    Expected dangling pages: ["C"].
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "C")])

    dangling = graph_model.find_dangling_pages(graph)

    assert dangling == ["C"], \
        "expected ['C'] to be dangling, got {0!r}".format(dangling)
    print("PASS  test_dangling_page_is_detected")


def test_link_target_becomes_a_node():
    """A page that is only ever linked TO must still exist in the graph.

    This is the subtle one. If build_graph only created entries for pages that
    appear as a SOURCE, then C above would have no key at all, find_dangling_
    pages() would return [] and the leak would go undetected. This test locks
    down the setdefault(target, []) line in add_edge().
    """
    graph = graph_model.build_graph([("A", "B")])

    assert "B" in graph, "link target B was not registered as a node"
    assert graph["B"] == [], "B should have an empty adjacency list, got {0!r}".format(graph["B"])
    assert graph_model.all_pages(graph) == ["A", "B"], \
        "expected both pages, got {0!r}".format(graph_model.all_pages(graph))
    print("PASS  test_link_target_becomes_a_node")


def test_no_dangling_pages_in_a_full_cycle():
    """In a cycle every page has an outgoing link, so nothing is dangling.

    Graph:  A -> B -> C -> A.
    Expected dangling pages: [] (the empty list).
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "C"), ("C", "A")])

    dangling = graph_model.find_dangling_pages(graph)

    assert dangling == [], "expected no dangling pages, got {0!r}".format(dangling)
    print("PASS  test_no_dangling_pages_in_a_full_cycle")


def test_several_dangling_pages_are_all_found():
    """More than one dead end must all be reported, in sorted order.

    Graph:  A -> B,  A -> C,  A -> D,  and B, C, D all link nowhere.
    Expected: ["B", "C", "D"] -- sorted, so the assertion is stable.
    """
    graph = graph_model.build_graph([("A", "B"), ("A", "C"), ("A", "D")])

    dangling = graph_model.find_dangling_pages(graph)

    assert dangling == ["B", "C", "D"], \
        "expected all three dead ends, got {0!r}".format(dangling)
    print("PASS  test_several_dangling_pages_are_all_found")


def test_duplicate_links_collapse_to_one_edge():
    """The same hyperlink written twice must count as one vote, not two.

    A real page links to the same article from its body and its navigation box.
    Counting both would let any page double the score it sends to a chosen
    target simply by repeating the href, which is trivially gameable.
    """
    graph = graph_model.build_graph([("A", "B"), ("A", "B"), ("A", "B")])

    assert graph["A"] == ["B"], "duplicate edges were not collapsed: {0!r}".format(graph["A"])
    assert graph_model.out_degree(graph, "A") == 1, \
        "out-degree should be 1, got {0}".format(graph_model.out_degree(graph, "A"))
    assert graph_model.edge_count(graph) == 1, \
        "edge count should be 1, got {0}".format(graph_model.edge_count(graph))
    print("PASS  test_duplicate_links_collapse_to_one_edge")


def test_out_degree_of_unknown_page_is_zero():
    """Asking for a page that was never crawled returns 0, not an exception.

    The PageRank engine treats "unknown page" and "page with no links" the same
    way, so out_degree must not raise KeyError on the first one.
    """
    graph = graph_model.build_graph([("A", "B")])

    assert graph_model.out_degree(graph, "NeverSeen") == 0, \
        "unknown page should have out-degree 0"
    print("PASS  test_out_degree_of_unknown_page_is_zero")


def test_example_graph_from_the_report():
    """The 5-page example used throughout the report has exactly one dead end.

    This is the graph printed by graph_model.py's own demo block and used in the
    PageRank worked example, so pinning its properties here means a future edit
    to the example cannot silently invalidate the hand calculations in the report.
    """
    graph = graph_model.build_graph([
        ("A", "B"), ("A", "C"),
        ("B", "C"), ("B", "E"),
        ("C", "A"),
        ("D", "A"), ("D", "C"),
    ])

    assert graph_model.all_pages(graph) == ["A", "B", "C", "D", "E"], \
        "expected 5 pages A-E, got {0!r}".format(graph_model.all_pages(graph))
    assert graph_model.edge_count(graph) == 7, \
        "expected 7 edges, got {0}".format(graph_model.edge_count(graph))
    assert graph_model.find_dangling_pages(graph) == ["E"], \
        "E should be the only dead end, got {0!r}".format(graph_model.find_dangling_pages(graph))
    assert graph_model.out_degree(graph, "A") == 2
    assert graph_model.out_degree(graph, "C") == 1
    assert graph_model.out_degree(graph, "E") == 0
    print("PASS  test_example_graph_from_the_report")


if __name__ == "__main__":
    print("=" * 70)
    print("test_graph_model.py  --  running tests")
    print("=" * 70)
    print()

    # Called explicitly, in a fixed order, rather than discovered by scanning
    # globals(). Explicit is easier for a reader to follow, and the order stays
    # simple-to-complex so the first failure is usually the most basic one.
    test_dangling_page_is_detected()
    test_link_target_becomes_a_node()
    test_no_dangling_pages_in_a_full_cycle()
    test_several_dangling_pages_are_all_found()
    test_duplicate_links_collapse_to_one_edge()
    test_out_degree_of_unknown_page_is_zero()
    test_example_graph_from_the_report()

    print()
    print("=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
