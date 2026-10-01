"""
===============================================================================
 linear_solve_pagerank.py  --  Exact PageRank by Gaussian elimination
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 10 (Days 44-48)
 SRS MAPPING  : FR4.6  (independent, non-iterative computation for validation)
 DAD MAPPING  : Design of Algorithm document, Section 6.4

 PURPOSE
 -------
 pagerank_engine.py computes PageRank by repeating a step until the numbers stop
 moving. That works, but it raises a fair question: how do we know the number it
 settles on is the RIGHT number, and not just a number it stopped at?

 This file answers that by solving the same problem a completely different way --
 as a system of linear equations, solved exactly, with no iteration anywhere.
 If two unrelated methods agree to ten decimal places, neither is wrong.

 THE REARRANGEMENT
 -----------------
 The damped PageRank definition is

     r = d * M * r + (1-d)/N * 1

 where M is the transition matrix: M[i][j] = 1/outdeg(j) if page j links to
 page i, and 0 otherwise. Each COLUMN of M sums to 1, because a page splits all
 of its score across its own out-links.

 Collect the r terms on one side:

     r - d*M*r         = (1-d)/N * 1
     (I - d*M) * r     = (1-d)/N * 1
          A    * r     =      b

 That is an ordinary N-equation, N-unknown linear system, which Gaussian
 elimination solves exactly.

 DANGLING PAGES
 --------------
 A dead-end page has no out-links, so its column of M would be all zeros and the
 column would not sum to 1 -- the same rank leak the power-iteration version
 fixes by redistributing. The matrix equivalent is to fill that column with 1/N
 everywhere: a dead end behaves exactly as if it linked to every page at once.
 This must match what pagerank_engine.py does, or the two methods would be
 solving different problems and disagreeing would mean nothing.

 WHY THIS IS NOT THE MAIN ENGINE
 -------------------------------
 Gaussian elimination costs O(N^3) time and O(N^2) memory -- it needs the full
 dense N x N matrix in memory. For the 150-page crawl that is 22,500 cells and
 roughly 3.4 million operations; for a real web it is hopeless. Power iteration
 costs O(V + E) per step on the sparse adjacency list. So this file is the
 ORACLE used on small graphs to prove the fast method correct, not the method
 we actually ship.

 DEPENDENCIES
 ------------
 Standard library only. Imports graph_model and pagerank_engine, both ours.
 No numpy -- the elimination is written out by hand, which is the point.

 HOW TO RUN
 ----------
     python linear_solve_pagerank.py

 The __main__ block solves the shared example graph both ways and prints the two
 answers side by side with their difference.
===============================================================================
"""

import graph_model
import pagerank_engine


def build_transition_matrix(graph):
    """Build the dense column-stochastic transition matrix M.

    Args:
        graph: adjacency-list dict from graph_model.

    Returns:
        (matrix, pages) where matrix[i][j] is the probability of moving from
        page j to page i, and pages is the sorted page list fixing the ordering.

    Every column sums to 1.0: a surfer standing on page j must end up somewhere.
    """
    pages = graph_model.all_pages(graph)
    page_count = len(pages)

    # Position of each page in the ordering, so we can fill the matrix by index.
    # Built once as a dict rather than calling pages.index() inside the loop,
    # which would turn an O(N^2) fill into O(N^3).
    position = {page: index for index, page in enumerate(pages)}

    # N x N of zeros. Note the inner list is rebuilt per row -- writing
    # [[0.0] * n] * n would make every row the SAME list object, so setting one
    # cell would appear to set a whole column. A classic Python trap.
    matrix = [[0.0] * page_count for _ in range(page_count)]

    for source in pages:
        column = position[source]
        targets = graph[source]

        if not targets:
            # Dangling column: treat the dead end as linking to everything,
            # matching pagerank_engine's redistribution of trapped score.
            for row in range(page_count):
                matrix[row][column] = 1.0 / page_count
            continue

        # Split this page's score evenly across the pages it links to.
        share = 1.0 / len(targets)
        for target in targets:
            matrix[position[target]][column] = share

    return matrix, pages


def gaussian_elimination(matrix_a, vector_b):
    """Solve A x = b exactly, by hand, with partial pivoting.

    Args:
        matrix_a: list of N rows, each a list of N floats. Modified in place.
        vector_b: list of N floats. Modified in place.

    Returns:
        list of N floats -- the solution x.

    Raises:
        ValueError: if the matrix is singular (no unique solution).

    PARTIAL PIVOTING -- why it is here:
    At each column we swap in the row with the largest absolute value in that
    column before dividing by it. Without this step, a pivot that happens to be
    very small makes the division blow up tiny rounding errors into large ones,
    and a pivot that is exactly zero makes it fail outright. Choosing the
    largest available pivot keeps every multiplier at most 1 in magnitude, which
    keeps the arithmetic stable.
    """
    size = len(vector_b)

    # ---- Forward elimination: reduce A to upper-triangular form -------------
    for column in range(size):

        # Find the row at or below the diagonal with the biggest value here.
        pivot_row = column
        for row in range(column + 1, size):
            if abs(matrix_a[row][column]) > abs(matrix_a[pivot_row][column]):
                pivot_row = row

        # Swap it up into the pivot position. Rows of A and entries of b must
        # move together -- they are two halves of the same equation.
        if pivot_row != column:
            matrix_a[column], matrix_a[pivot_row] = matrix_a[pivot_row], matrix_a[column]
            vector_b[column], vector_b[pivot_row] = vector_b[pivot_row], vector_b[column]

        pivot = matrix_a[column][column]

        # A pivot of (near) zero after pivoting means no row has a usable value
        # in this column, so the equations are dependent and there is no unique
        # solution. 1e-12 rather than == 0 because floating-point arithmetic
        # rarely produces an exact zero even when the true value is zero.
        if abs(pivot) < 1e-12:
            raise ValueError("matrix is singular at column {0}".format(column))

        # Subtract a multiple of the pivot row from every row beneath it, so
        # that every entry below the pivot becomes zero.
        for row in range(column + 1, size):
            factor = matrix_a[row][column] / pivot
            if factor == 0.0:
                continue  # already zero here; skip the pointless row sweep

            for inner_column in range(column, size):
                matrix_a[row][inner_column] -= factor * matrix_a[column][inner_column]
            vector_b[row] -= factor * vector_b[column]

    # ---- Back substitution: solve upward from the last equation -------------
    solution = [0.0] * size
    for row in range(size - 1, -1, -1):
        # Every unknown to the right of this one is already solved, so move
        # their contributions to the right-hand side and divide out the pivot.
        total = vector_b[row]
        for column in range(row + 1, size):
            total -= matrix_a[row][column] * solution[column]
        solution[row] = total / matrix_a[row][row]

    return solution


def exact_pagerank(graph, damping=pagerank_engine.DEFAULT_DAMPING):
    """Compute PageRank exactly, with no iteration (FR4.6).

    Args:
        graph:   adjacency-list dict.
        damping: d, matching the value the iterative engine uses.

    Returns:
        dict page -> score, summing to 1.0.

    Raises:
        ValueError: if the graph is empty.
    """
    matrix, pages = build_transition_matrix(graph)
    page_count = len(pages)

    if page_count == 0:
        raise ValueError("cannot rank an empty graph")

    # A = I - d*M, built directly rather than by constructing I and subtracting,
    # which would mean allocating a second N x N matrix for no reason.
    matrix_a = []
    for row in range(page_count):
        new_row = [-damping * matrix[row][column] for column in range(page_count)]
        new_row[row] += 1.0            # the identity's 1 on the diagonal
        matrix_a.append(new_row)

    # b = (1-d)/N for every entry -- the random-jump term, same for every page.
    vector_b = [(1.0 - damping) / page_count] * page_count

    solution = gaussian_elimination(matrix_a, vector_b)

    return {page: solution[index] for index, page in enumerate(pages)}


if __name__ == "__main__":
    # The same 5-page example used in graph_model.py and pagerank_engine.py, so
    # all three demos can be read against each other. E is the dead end.
    EXAMPLE_EDGES = [
        ("A", "B"), ("A", "C"),
        ("B", "C"), ("B", "E"),
        ("C", "A"),
        ("D", "A"), ("D", "C"),
    ]
    example_graph = graph_model.build_graph(EXAMPLE_EDGES)

    print("=" * 70)
    print("linear_solve_pagerank.py  --  exact solve vs power iteration")
    print("=" * 70)

    print("\nGraph under test:")
    graph_model.print_graph(example_graph)
    print("  dangling pages:", graph_model.find_dangling_pages(example_graph))

    # ---- show the matrix, since it is the whole point of this file ----------
    matrix, pages = build_transition_matrix(example_graph)
    print("\nTransition matrix M  (M[i][j] = chance of moving from j to i):")
    print("           " + "".join("{0:>9}".format(p) for p in pages))
    for row_index, page in enumerate(pages):
        cells = "".join("{0:>9.4f}".format(matrix[row_index][col])
                        for col in range(len(pages)))
        print("    {0:<6}{1}".format(page, cells))

    print("\n  Every COLUMN sums to 1.0:")
    for col_index, page in enumerate(pages):
        column_total = sum(matrix[row][col_index] for row in range(len(pages)))
        print("    column {0}: {1:.6f}".format(page, column_total))
    print("  (E's column is all 0.2000 -- the dead end treated as linking everywhere.)")

    # ---- the two independent computations -----------------------------------
    exact_scores = exact_pagerank(example_graph)
    iterative_scores, iterations = pagerank_engine.pagerank(example_graph)

    print("\n" + "-" * 70)
    print("RESULTS  --  two completely different methods, same graph")
    print("-" * 70)
    print("\n    {0:<8} {1:>16} {2:>18} {3:>14}"
          .format("page", "exact (Gauss)", "power iteration", "difference"))
    print("    " + "-" * 58)

    largest_gap = 0.0
    for page in graph_model.all_pages(example_graph):
        gap = abs(exact_scores[page] - iterative_scores[page])
        largest_gap = max(largest_gap, gap)
        print("    {0:<8} {1:>16.12f} {2:>18.12f} {3:>14.2e}"
              .format(page, exact_scores[page], iterative_scores[page], gap))

    print("    " + "-" * 58)
    print("    {0:<8} {1:>16.12f} {2:>18.12f}"
          .format("SUM", sum(exact_scores.values()), sum(iterative_scores.values())))

    print("\n  power iteration converged in {0} iterations".format(iterations))
    print("  largest disagreement between the two methods: {0:.2e}".format(largest_gap))

    # The right bar to judge agreement against is the power-iteration engine's
    # own convergence tolerance. That engine stops once the TOTAL change across
    # all pages falls below 1e-8, so no single page can be expected to be more
    # accurate than that -- demanding tighter agreement would be asking the
    # iterative method for precision it never promised. A gap below the
    # tolerance means the only difference is where iteration chose to stop.
    agreement_bar = pagerank_engine.DEFAULT_TOLERANCE
    print("  power-iteration convergence tolerance:        {0:.2e}".format(agreement_bar))

    if largest_gap < agreement_bar:
        print("\n  AGREEMENT CONFIRMED -- the two methods agree to ~9 decimal places,")
        print("  which is within the tolerance iteration was asked to reach. Power")
        print("  iteration is converging on the exact solution, not something near it.")
    else:
        print("\n  WARNING: the two methods disagree by more than expected.")

    print("=" * 70)
