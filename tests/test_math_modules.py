"""
===============================================================================
 tests/test_math_modules.py  --  Consolidated tests for the maths modules
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 13 (Days 59-63)
 COVERS       : graph_model.py, pagerank_engine.py, linear_solve_pagerank.py
 SRS MAPPING  : FR3.1-FR3.3, FR4.1-FR4.6, NFR8, NFR9

 PURPOSE
 -------
 Every test here has an expected value that can be worked out on paper before
 running the code. That is deliberate and it is what SRS NFR9 asks for: a test
 that only checks the program agrees with itself proves nothing, because a bug
 in the implementation would simply be baked into the expected value too.

 The anchor case is a two-page graph where A and B link to each other. By
 symmetry both pages must end up with exactly 0.5 -- there is no other answer
 the maths could give. Working it through by hand with d = 0.85:

     r(A) = (1-d)/2 + d * r(B)/outdeg(B)
          = 0.075 + 0.85 * 0.5 / 1
          = 0.075 + 0.425
          = 0.5                            and the same for r(B).

 If the engine ever returns something else for that graph, the damping, the
 teleport term or the normalisation is wrong, and the test says so immediately.

 WHY PLAIN assert
 ----------------
 pytest is a PyPI package and out of bounds for this project. unittest is in the
 standard library but would wrap one-line checks in class boilerplate. A bare
 assert gives the same guarantee -- the expression must hold or the program
 stops at that exact line -- and every test prints PASS so a good run is
 visibly good rather than merely silent.

 HOW TO RUN
 ----------
     python tests/test_math_modules.py       (from the project root)

 Prints ALL TESTS PASSED at the end if everything holds.
===============================================================================
"""

import os
import sys

# The modules under test live in the project root, one level up from tests/.
# Running "python tests/test_math_modules.py" puts tests/ on the import path but
# NOT the root, so "import graph_model" would fail without this.
#
# NOTE ON THE LIBRARY ALLOWANCE: `sys` is the one module used here beyond the
# list agreed for this project. It is needed only for this path line, only in
# the test files, and never in the modules being shipped. Flagged rather than
# slipped in quietly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import graph_model
import linear_solve_pagerank
import pagerank_engine


# How close two floats must be to count as equal. Power iteration stops at a
# total change of 1e-8, so demanding more agreement than that would be asking
# for precision the algorithm never promised.
TOLERANCE = 1e-7


def almost_equal(actual, expected, tolerance=TOLERANCE):
    """True if two floats agree within tolerance.

    Floats are never compared with == here. 0.1 + 0.2 is not 0.3 in binary
    floating point, and a test that insists on exact equality would fail for
    reasons that have nothing to do with PageRank.
    """
    return abs(actual - expected) < tolerance


# =============================================================================
# graph_model.py
# =============================================================================

def test_dangling_detection():
    """A page with no outgoing links must be reported as dangling.

    Graph: A -> B -> C, and C links nowhere. Expected: ["C"].
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "C")])
    assert graph_model.find_dangling_pages(graph) == ["C"], \
        "expected ['C'], got {0!r}".format(graph_model.find_dangling_pages(graph))
    print("PASS  test_dangling_detection")


def test_link_target_registered_as_node():
    """A page only ever linked TO must still exist in the graph.

    If build_graph skipped it, its trapped score would leak with nothing able
    to detect it.
    """
    graph = graph_model.build_graph([("A", "B")])
    assert "B" in graph, "link target B was not registered"
    assert graph["B"] == [], "B should have an empty adjacency list"
    print("PASS  test_link_target_registered_as_node")


def test_duplicate_links_collapse():
    """The same hyperlink written three times is still one vote."""
    graph = graph_model.build_graph([("A", "B"), ("A", "B"), ("A", "B")])
    assert graph["A"] == ["B"], "duplicates not collapsed: {0!r}".format(graph["A"])
    assert graph_model.edge_count(graph) == 1
    print("PASS  test_duplicate_links_collapse")


# =============================================================================
# pagerank_engine.py
# =============================================================================

def test_two_page_symmetry_gives_exactly_half():
    """THE anchor test: A <-> B must give both pages exactly 0.5.

    Hand calculation, d = 0.85:
        r(A) = 0.15/2 + 0.85 * r(B)/1 = 0.075 + 0.425 = 0.5
    By symmetry r(B) is identical. No other answer is possible.
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "A")])
    scores, _ = pagerank_engine.pagerank(graph)

    assert almost_equal(scores["A"], 0.5), \
        "A should be exactly 0.5, got {0!r}".format(scores["A"])
    assert almost_equal(scores["B"], 0.5), \
        "B should be exactly 0.5, got {0!r}".format(scores["B"])
    print("PASS  test_two_page_symmetry_gives_exactly_half")


def test_three_page_cycle_gives_exactly_one_third():
    """A -> B -> C -> A is symmetric too: every page must get exactly 1/3."""
    graph = graph_model.build_graph([("A", "B"), ("B", "C"), ("C", "A")])
    scores, _ = pagerank_engine.pagerank(graph)

    for page in ("A", "B", "C"):
        assert almost_equal(scores[page], 1.0 / 3.0), \
            "{0} should be 1/3, got {1!r}".format(page, scores[page])
    print("PASS  test_three_page_cycle_gives_exactly_one_third")


def test_scores_sum_to_one_even_with_a_dead_end():
    """The total must stay at 1.0 -- that is what dangling redistribution is for.

    This is the test that would have caught the leak the undamped version has.
    """
    graph = graph_model.build_graph([
        ("A", "B"), ("A", "C"), ("B", "C"), ("B", "E"),
        ("C", "A"), ("D", "A"), ("D", "C"),
    ])
    assert graph_model.find_dangling_pages(graph) == ["E"], "expected E to be the dead end"

    scores, _ = pagerank_engine.pagerank(graph)
    total = sum(scores.values())

    assert almost_equal(total, 1.0), "scores must sum to 1.0, got {0!r}".format(total)
    print("PASS  test_scores_sum_to_one_even_with_a_dead_end")


def test_undamped_version_leaks_score():
    """The undamped version SHOULD lose score on a dead end.

    Asserting the known-bad behaviour on purpose. It is kept in the codebase as
    the contrast that justifies damping, so if someone "fixes" it by quietly
    normalising, the leak demo in the report stops demonstrating anything and
    this test is what notices.
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "C")])
    scores, _ = pagerank_engine.power_iteration_undamped(
        graph, tolerance=0.0, max_iterations=30)

    total = sum(scores.values())
    assert total < 0.01, \
        "undamped total should have decayed towards 0, got {0!r}".format(total)
    print("PASS  test_undamped_version_leaks_score")


def test_page_with_no_incoming_links_gets_the_floor_score():
    """A page nothing links to still gets (1-d)/N plus its dangling share.

    No page can ever reach zero -- that is what makes the chain irreducible and
    the answer unique.
    """
    graph = graph_model.build_graph([("A", "B"), ("B", "A"), ("C", "A")])
    scores, _ = pagerank_engine.pagerank(graph)

    # C has no incoming links at all, and the graph has no dead ends, so C gets
    # exactly the teleport term: (1 - 0.85) / 3 = 0.05.
    assert almost_equal(scores["C"], 0.05), \
        "C should sit at the (1-d)/N floor of 0.05, got {0!r}".format(scores["C"])
    print("PASS  test_page_with_no_incoming_links_gets_the_floor_score")


def test_sparse_and_push_versions_agree():
    """pagerank() and pagerank_sparse() must give identical answers.

    They traverse the graph in opposite directions -- one pushes score along
    out-links, the other pulls along in-links -- so agreeing is real evidence
    that neither has a direction-specific bug.
    """
    graph = graph_model.build_graph([
        ("A", "B"), ("A", "C"), ("B", "C"), ("B", "E"),
        ("C", "A"), ("D", "A"), ("D", "C"),
    ])
    push_scores, _ = pagerank_engine.pagerank(graph)
    pull_scores, _ = pagerank_engine.pagerank_sparse(graph)

    for page in graph:
        assert almost_equal(push_scores[page], pull_scores[page]), \
            "{0}: push {1!r} vs pull {2!r}".format(page, push_scores[page], pull_scores[page])
    print("PASS  test_sparse_and_push_versions_agree")


def test_sparse_and_dense_versions_agree():
    """The sparse engine and the dense matrix version must also agree.

    If they did not, the Checkpoint 11 speed benchmark would be comparing two
    different calculations, and a fast wrong answer is not an optimisation.
    """
    graph = pagerank_engine.make_random_graph(40, 5)
    sparse_scores, _ = pagerank_engine.pagerank_sparse(graph)
    dense_scores, _ = pagerank_engine.pagerank_dense(graph)

    for page in graph:
        assert almost_equal(sparse_scores[page], dense_scores[page]), \
            "{0}: sparse {1!r} vs dense {2!r}".format(
                page, sparse_scores[page], dense_scores[page])
    print("PASS  test_sparse_and_dense_versions_agree")


def test_empty_graph_is_rejected():
    """Ranking nothing should raise, not divide by zero and return garbage."""
    try:
        pagerank_engine.pagerank({})
    except ValueError:
        print("PASS  test_empty_graph_is_rejected")
        return
    raise AssertionError("an empty graph should have raised ValueError")


# =============================================================================
# linear_solve_pagerank.py
# =============================================================================

def test_gaussian_elimination_on_a_known_system():
    """Solve a 2x2 system whose answer is obvious by substitution.

        2x +  y =  5
         x + 3y = 10        =>   x = 1, y = 3

    Checking: 2(1) + 3 = 5, and 1 + 3(3) = 10. Both hold.
    """
    matrix = [[2.0, 1.0], [1.0, 3.0]]
    vector = [5.0, 10.0]

    solution = linear_solve_pagerank.gaussian_elimination(matrix, vector)

    assert almost_equal(solution[0], 1.0), "x should be 1, got {0!r}".format(solution[0])
    assert almost_equal(solution[1], 3.0), "y should be 3, got {0!r}".format(solution[1])
    print("PASS  test_gaussian_elimination_on_a_known_system")


def test_transition_matrix_columns_sum_to_one():
    """Every column of M must sum to 1.0 -- a surfer always ends up somewhere.

    Including the dangling column, which is filled with 1/N rather than zeros.
    """
    graph = graph_model.build_graph([("A", "B"), ("A", "C"), ("B", "C")])
    matrix, pages = linear_solve_pagerank.build_transition_matrix(graph)

    for column_index, page in enumerate(pages):
        column_total = sum(matrix[row][column_index] for row in range(len(pages)))
        assert almost_equal(column_total, 1.0), \
            "column {0} sums to {1!r}, not 1.0".format(page, column_total)
    print("PASS  test_transition_matrix_columns_sum_to_one")


def test_exact_solve_matches_the_hand_calculation():
    """The exact solver must also give 0.5 each on the symmetric two-page graph."""
    graph = graph_model.build_graph([("A", "B"), ("B", "A")])
    scores = linear_solve_pagerank.exact_pagerank(graph)

    assert almost_equal(scores["A"], 0.5), "A should be 0.5, got {0!r}".format(scores["A"])
    assert almost_equal(scores["B"], 0.5), "B should be 0.5, got {0!r}".format(scores["B"])
    print("PASS  test_exact_solve_matches_the_hand_calculation")


def test_exact_solve_and_power_iteration_agree():
    """FR4.6: the independent exact method must confirm the iterative one.

    These two share no code path at all -- one builds a dense matrix and does
    Gaussian elimination, the other walks an adjacency list repeatedly. Them
    agreeing is the strongest correctness evidence in the whole project.
    """
    graph = graph_model.build_graph([
        ("A", "B"), ("A", "C"), ("B", "C"), ("B", "E"),
        ("C", "A"), ("D", "A"), ("D", "C"),
    ])
    exact_scores = linear_solve_pagerank.exact_pagerank(graph)
    iterative_scores, _ = pagerank_engine.pagerank(graph)

    for page in graph:
        assert almost_equal(exact_scores[page], iterative_scores[page]), \
            "{0}: exact {1!r} vs iterative {2!r}".format(
                page, exact_scores[page], iterative_scores[page])
    print("PASS  test_exact_solve_and_power_iteration_agree")


if __name__ == "__main__":
    print("=" * 70)
    print("tests/test_math_modules.py")
    print("=" * 70)
    print()

    print("-- graph_model.py " + "-" * 50)
    test_dangling_detection()
    test_link_target_registered_as_node()
    test_duplicate_links_collapse()

    print("\n-- pagerank_engine.py " + "-" * 46)
    test_two_page_symmetry_gives_exactly_half()
    test_three_page_cycle_gives_exactly_one_third()
    test_scores_sum_to_one_even_with_a_dead_end()
    test_undamped_version_leaks_score()
    test_page_with_no_incoming_links_gets_the_floor_score()
    test_sparse_and_push_versions_agree()
    test_sparse_and_dense_versions_agree()
    test_empty_graph_is_rejected()

    print("\n-- linear_solve_pagerank.py " + "-" * 40)
    test_gaussian_elimination_on_a_known_system()
    test_transition_matrix_columns_sum_to_one()
    test_exact_solve_matches_the_hand_calculation()
    test_exact_solve_and_power_iteration_agree()

    print()
    print("=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
