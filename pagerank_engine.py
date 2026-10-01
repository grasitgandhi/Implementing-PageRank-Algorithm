"""
===============================================================================
 pagerank_engine.py  --  PageRank by power iteration (undamped and damped)
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 8  (undamped power iteration)
                9  (damping factor + dangling-score redistribution + leak demo)
                11 (reverse-adjacency sparse iteration + sparse/dense benchmark)
 SRS MAPPING  : FR4.1, FR4.2, FR4.3, FR4.4, FR4.5
 DAD MAPPING  : Design of Algorithm document, Section 6 "PageRank Engine"

 PURPOSE
 -------
 Given the directed graph built by graph_model.py, assign every page a score
 between 0 and 1 that measures how important the LINK STRUCTURE alone says that
 page is. No text, no keywords, no machine learning -- only who links to whom.

 THE FORMULAS, IN THE ORDER WE BUILT THEM
 ----------------------------------------
 (1) Undamped (Checkpoint 8). The original eigenvector idea r = M*r. A page
     hands its whole score to the pages it links to, split equally:

         r(i)  =  sum over every j that links to i  of  r(j) / outdeg(j)

     This is the honest first version, and it is BROKEN on real graphs -- see
     the leak demo at the bottom of this file. We kept it in the codebase on
     purpose so the report can show the failure, not just describe it.

 (2) Damped (Checkpoint 9). The formula Page and Brin actually published, which
     models a "random surfer" who follows a link with probability d and gets
     bored and jumps to a random page with probability (1 - d):

         r(i)  =  (1 - d)/N  +  d * ( sum of r(j)/outdeg(j) for j linking to i
                                      + dangling_share )

     where     dangling_share = (total score sitting on dangling pages) / N

     The (1 - d)/N term is the random jump. The dangling_share term is what
     stops the score of dead-end pages from disappearing. Together they keep
     the invariant   sum of all r(i) = 1.0   exactly, every iteration.

 (3) Power iteration. Start every page equal at 1/N, apply the formula above to
     get a new score vector, measure how much the vector moved, and repeat
     until it stops moving (below a tolerance) or we hit an iteration cap.

 WHY ITERATE INSTEAD OF SOLVING THE EQUATIONS DIRECTLY
 ----------------------------------------------------
 The damped formula is an N-equation linear system and could be solved exactly
 by Gaussian elimination, which is what linear_solve_pagerank.py does in
 Checkpoint 10. But exact elimination costs O(N^3) time and O(N^2) memory,
 while one power iteration costs O(V + E) on a sparse adjacency list. For a
 300-page crawl the iterative version converges in well under a second; the
 exact solve exists only as a correctness oracle on tiny hand-checkable graphs.

 DEPENDENCIES
 ------------
 Standard library only: random and time, used by the Checkpoint 11 benchmark.
 Imports graph_model, which is our own file.

 HOW TO RUN
 ----------
     python pagerank_engine.py

 The __main__ block runs four demos: undamped iteration (Checkpoint 8), damped
 PageRank (Checkpoint 9), the score-leak contrast (Checkpoint 9), and the
 sparse-vs-dense timing benchmark (Checkpoint 11).
===============================================================================
"""

import random
import time

import graph_model


# -----------------------------------------------------------------------------
# TUNABLE CONSTANTS -- every one of these is a deliberate choice, explained.
# -----------------------------------------------------------------------------

# Damping factor d: the probability that the imaginary random surfer follows an
# actual hyperlink on the current page, rather than typing a fresh URL. 0.85 is
# the value from the original 1998 Page/Brin paper and it is the value we use
# because it balances two effects: higher d (say 0.95) trusts the link structure
# more but converges much more slowly, while lower d (say 0.5) converges fast
# but flattens every page towards the same score, destroying the ranking signal.
DEFAULT_DAMPING = 0.85

# Convergence tolerance: we stop when the total absolute change across all pages
# between two successive iterations (the L1 distance) drops below this. 1e-8 is
# far tighter than we need for ranking -- the top-10 order stops changing after
# roughly 20 iterations -- but it is still cheap here, and a tight tolerance lets
# the Checkpoint 10 cross-check against the exact Gaussian solve agree to about
# 8 decimal places, which is what makes that test meaningful.
DEFAULT_TOLERANCE = 1e-8

# Hard iteration cap, so a pathological graph can never hang the program.
# The error of power iteration shrinks by roughly a factor of d each step, so
# reaching tolerance 1e-8 needs about  ln(1e-8) / ln(0.85)  ~= 113 iterations in
# the worst case. 200 leaves comfortable headroom above that bound while still
# finishing instantly. If a run ever reports "max iterations reached", something
# is wrong with the graph, not with this number.
DEFAULT_MAX_ITERATIONS = 200


def _initial_scores(pages):
    """Give every page an equal starting score of 1/N (FR4.1).

    Args:
        pages: list of page identifiers.

    Returns:
        dict page -> float, every value equal, summing to 1.0.

    Why equal and not random: power iteration converges to the same answer from
    any starting vector whose entries sum to 1, so we pick the one that assumes
    nothing about the graph and is trivial to reproduce by hand in the viva.
    """
    page_count = len(pages)
    starting_score = 1.0 / page_count
    return {page: starting_score for page in pages}


def _l1_distance(old_scores, new_scores):
    """Total absolute change across all pages between two score vectors.

    This is the L1 norm  sum of |new(i) - old(i)|.

    Why L1 and not the largest single change (L-infinity) or a squared distance:
    L1 measures how much probability mass moved in total, which is exactly the
    quantity that has to settle for a random-walk distribution to be stationary,
    and it is the one a person can recompute by hand on a 4-page example.
    """
    return sum(abs(new_scores[page] - old_scores[page]) for page in old_scores)


# =============================================================================
# CHECKPOINT 8 -- undamped power iteration (the deliberately broken version)
# =============================================================================

def power_iteration_undamped(graph,
                             tolerance=DEFAULT_TOLERANCE,
                             max_iterations=DEFAULT_MAX_ITERATIONS,
                             report_at=()):
    """Run plain, undamped power iteration:  r(i) = sum r(j)/outdeg(j).

    Args:
        graph:          adjacency-list dict from graph_model.
        tolerance:      stop when the L1 change falls below this.
        max_iterations: stop unconditionally after this many iterations.
        report_at:      iteration numbers at which to print a progress line.
                        Empty by default so the function stays silent when it is
                        called from other modules; the demo block passes
                        (1, 5, 20) to satisfy the Checkpoint 8 requirement.

    Returns:
        (scores, iterations_run) where scores is a dict page -> float.

    IMPORTANT: this function intentionally does NOT renormalise the scores.
    The whole point of keeping it is to show the total sum collapsing towards
    zero whenever the graph contains a dangling page. Normalising would hide
    the bug that Checkpoint 9 exists to fix.
    """
    pages = graph_model.all_pages(graph)
    scores = _initial_scores(pages)
    iterations_run = 0

    for iteration in range(1, max_iterations + 1):
        iterations_run = iteration

        # Start from zero: with no damping there is no constant term to seed.
        new_scores = {page: 0.0 for page in pages}

        # PUSH formulation -- walk each source page once and push its score out
        # along its own links. This touches each edge exactly once, giving
        # O(V + E) per iteration. A dense matrix version would instead test all
        # V*V possible pairs, almost all of which are non-edges.
        for source in pages:
            targets = graph[source]
            if not targets:
                # Dangling page: outdeg is 0, so there is nothing to divide the
                # score across and its score is simply dropped. THIS IS THE LEAK.
                continue
            share = scores[source] / len(targets)
            for target in targets:
                new_scores[target] += share

        delta = _l1_distance(scores, new_scores)
        scores = new_scores

        if iteration in report_at:
            print("    iteration {0:>3}: sum = {1:.6f}   L1 change = {2:.3e}"
                  .format(iteration, sum(scores.values()), delta))

        if delta < tolerance:
            break

    return scores, iterations_run


# =============================================================================
# CHECKPOINT 9 -- the real thing: damping + dangling redistribution
# =============================================================================

def pagerank(graph,
             damping=DEFAULT_DAMPING,
             tolerance=DEFAULT_TOLERANCE,
             max_iterations=DEFAULT_MAX_ITERATIONS,
             report_at=()):
    """Compute damped PageRank for every page in the graph (FR4.2 - FR4.5).

    Implements

        r(i) = (1 - d)/N + d * ( sum of r(j)/outdeg(j) over j linking to i
                                 + dangling_mass / N )

    Args:
        graph:          adjacency-list dict from graph_model.
        damping:        d, the probability of following a link (default 0.85).
        tolerance:      convergence threshold on the L1 change (default 1e-8).
        max_iterations: safety cap on the number of iterations (default 200).
        report_at:      iteration numbers at which to print a progress line.

    Returns:
        (scores, iterations_run) where scores is a dict page -> float whose
        values sum to 1.0 (to within floating-point rounding).

    Raises:
        ValueError: if the graph is empty, since 1/N is undefined for N = 0, or
                    if damping is outside [0, 1), where the maths stops being a
                    probability and convergence is no longer guaranteed.
    """
    pages = graph_model.all_pages(graph)
    page_count = len(pages)

    if page_count == 0:
        raise ValueError("cannot rank an empty graph: N = 0 makes 1/N undefined")
    if not 0.0 <= damping < 1.0:
        raise ValueError("damping must be in [0, 1); got {0!r}".format(damping))

    scores = _initial_scores(pages)

    # The constant random-jump term is the same for every page and never changes
    # between iterations, so compute it once outside the loop instead of doing
    # the same division N times per iteration.
    teleport_term = (1.0 - damping) / page_count

    iterations_run = 0

    for iteration in range(1, max_iterations + 1):
        iterations_run = iteration

        # Seed every page with the random-jump term. This is what guarantees no
        # page can ever reach exactly zero, which in turn is what makes the
        # underlying Markov chain irreducible and the answer unique.
        new_scores = {page: teleport_term for page in pages}

        # Collected first, applied after the push loop: the score trapped on
        # pages with no outgoing links. Gathering it in the same pass costs
        # nothing extra and keeps the whole iteration at O(V + E).
        dangling_mass = 0.0

        for source in pages:
            targets = graph[source]
            if not targets:
                # FR4.4: a dead end is treated as if it linked to EVERY page,
                # which is exactly what a bored surfer does when there is
                # nothing to click -- type a random URL. Bank the score now.
                dangling_mass += scores[source]
                continue
            share = damping * scores[source] / len(targets)
            for target in targets:
                new_scores[target] += share

        # Spread the trapped score evenly over all N pages. It is multiplied by
        # d for the same reason every other link-following term is: the surfer
        # only does this when they did NOT decide to teleport, and the teleport
        # case is already covered by teleport_term above. Getting this wrong is
        # the classic bug -- the sum would come out above or below 1.0.
        if dangling_mass > 0.0:
            dangling_share = damping * dangling_mass / page_count
            for page in pages:
                new_scores[page] += dangling_share

        delta = _l1_distance(scores, new_scores)
        scores = new_scores

        if iteration in report_at:
            print("    iteration {0:>3}: sum = {1:.6f}   L1 change = {2:.3e}"
                  .format(iteration, sum(scores.values()), delta))

        # FR4.5: converged. Stopping early is not just a speed-up -- once the
        # vector stops moving, further iterations only add floating-point noise.
        if delta < tolerance:
            break

    return scores, iterations_run


# =============================================================================
# CHECKPOINT 11 -- sparse computation via a reverse-adjacency index
# =============================================================================
#
# The pagerank() above already avoids a dense matrix: it walks each page's own
# out-links and PUSHES score along them, touching each edge exactly once. That
# is O(V + E) per iteration already.
#
# This checkpoint builds the other half of the picture -- a reverse-adjacency
# index, incoming[i] = the list of pages linking TO i -- and iterates by PULLING
# instead. Both are O(V + E), but pulling matches the formula as written:
#
#     r(i) = (1-d)/N + d * ( sum of r(j)/outdeg(j) for j linking to i + ... )
#
# so the code reads the way the maths reads, one page's new score computed in
# one place. It also makes the contrast with the dense version below exact: same
# loop structure, only the lookup differs.


def build_incoming_index(graph):
    """Build the reverse adjacency: for each page, who links to it.

    Args:
        graph: adjacency-list dict (page -> pages it links to).

    Returns:
        (incoming, out_degree) where incoming[page] is the list of pages linking
        to it, and out_degree[page] is how many links that page sends out.

    Built ONCE and reused across every iteration. Rebuilding it inside the loop
    would multiply the cost by the iteration count for no benefit, since the
    graph never changes while we are ranking it.
    """
    incoming = {page: [] for page in graph}
    out_degree = {page: len(targets) for page, targets in graph.items()}

    for source, targets in graph.items():
        for target in targets:
            incoming[target].append(source)

    return incoming, out_degree


def pagerank_sparse(graph,
                    damping=DEFAULT_DAMPING,
                    tolerance=DEFAULT_TOLERANCE,
                    max_iterations=DEFAULT_MAX_ITERATIONS):
    """Damped PageRank computed by pulling along a reverse-adjacency index.

    Args:
        graph:          adjacency-list dict.
        damping:        d, probability of following a link.
        tolerance:      stop when the total change drops below this.
        max_iterations: hard cap on iterations.

    Returns:
        (scores, iterations_run). Identical results to pagerank(); only the
        traversal direction differs.

    Cost per iteration is O(V + E): the inner loop runs once per incoming edge
    across the whole graph, and every page is visited once for the dangling and
    teleport terms. It never looks at a pair of pages that are not connected.
    """
    pages = graph_model.all_pages(graph)
    page_count = len(pages)

    if page_count == 0:
        raise ValueError("cannot rank an empty graph: N = 0 makes 1/N undefined")

    incoming, out_degree = build_incoming_index(graph)
    dangling_pages = [page for page in pages if out_degree[page] == 0]

    scores = _initial_scores(pages)
    teleport_term = (1.0 - damping) / page_count
    iterations_run = 0

    for iteration in range(1, max_iterations + 1):
        iterations_run = iteration

        # All the score currently sitting on dead ends, gathered before the main
        # loop so every page's new value can include its share in one pass.
        dangling_mass = sum(scores[page] for page in dangling_pages)
        dangling_share = damping * dangling_mass / page_count

        new_scores = {}
        for page in pages:
            # PULL: ask only the pages that actually link here. A dense version
            # would instead test all N possible sources, almost all non-edges.
            incoming_total = 0.0
            for source in incoming[page]:
                incoming_total += scores[source] / out_degree[source]

            new_scores[page] = teleport_term + damping * incoming_total + dangling_share

        delta = _l1_distance(scores, new_scores)
        scores = new_scores

        if delta < tolerance:
            break

    return scores, iterations_run


def pagerank_dense(graph,
                   damping=DEFAULT_DAMPING,
                   tolerance=DEFAULT_TOLERANCE,
                   max_iterations=DEFAULT_MAX_ITERATIONS):
    """The same PageRank, computed with a dense N x N matrix. Deliberately slow.

    Args:
        graph:          adjacency-list dict.
        damping:        d, probability of following a link.
        tolerance:      stop when the total change drops below this.
        max_iterations: hard cap on iterations.

    Returns:
        (scores, iterations_run). The same answer as pagerank_sparse().

    This exists ONLY as the control group for the benchmark. It is the obvious
    textbook implementation -- write the transition matrix out in full, multiply
    it by the score vector -- and it is what the sparse version is defended
    against. Nothing in the real pipeline calls it.

    The cost is O(N^2) per iteration no matter how few links the graph has: the
    inner loop runs N times for every one of the N pages, and on a crawl where
    the average page links to maybe ten others, over 95% of those multiplications
    are by a zero that was never going to contribute anything.
    """
    pages = graph_model.all_pages(graph)
    page_count = len(pages)

    if page_count == 0:
        raise ValueError("cannot rank an empty graph")

    position = {page: index for index, page in enumerate(pages)}

    # The full N x N transition matrix, zeros and all. This allocation alone is
    # O(N^2) memory -- 250,000 floats for a 500-page graph, against roughly
    # 500 + E list entries for the adjacency form.
    matrix = [[0.0] * page_count for _ in range(page_count)]

    for source, targets in graph.items():
        column = position[source]
        if not targets:
            # Dangling column spread uniformly, matching the sparse version's
            # redistribution of trapped score.
            for row in range(page_count):
                matrix[row][column] = 1.0 / page_count
        else:
            share = 1.0 / len(targets)
            for target in targets:
                matrix[position[target]][column] = share

    vector = [1.0 / page_count] * page_count
    teleport_term = (1.0 - damping) / page_count
    iterations_run = 0

    for iteration in range(1, max_iterations + 1):
        iterations_run = iteration

        new_vector = []
        for row in range(page_count):
            # The full dot product of one matrix row with the score vector --
            # every single column touched, zero or not. This is the line the
            # sparse version exists to avoid.
            total = 0.0
            for column in range(page_count):
                total += matrix[row][column] * vector[column]
            new_vector.append(teleport_term + damping * total)

        delta = sum(abs(new_vector[i] - vector[i]) for i in range(page_count))
        vector = new_vector

        if delta < tolerance:
            break

    return {page: vector[position[page]] for page in pages}, iterations_run


def make_random_graph(page_count, links_per_page, seed=81):
    """Build a synthetic graph for benchmarking.

    Args:
        page_count:     how many pages.
        links_per_page: roughly how many out-links each page gets.
        seed:           fixed so every run benchmarks the identical graph and
                        the timings in the report are reproducible.

    Returns:
        adjacency-list dict.

    Sparse on purpose: links_per_page stays constant as page_count grows, which
    is how real web graphs behave -- a page does not link to more things just
    because the web got bigger. That is exactly the condition under which O(k*E)
    and O(k*N^2) pull apart.
    """
    random.seed(seed)
    names = ["p{0:04d}".format(index) for index in range(page_count)]

    graph = {name: [] for name in names}
    for source in names:
        for _ in range(links_per_page):
            target = names[random.randrange(page_count)]
            if target != source and target not in graph[source]:
                graph[source].append(target)

    return graph


def top_pages(scores, count=10):
    """Return the highest-scoring pages as a list of (page, score) pairs.

    Args:
        scores: dict page -> float, as returned by pagerank().
        count:  how many to return.

    Sorting key is (-score, page): score descending, then page name ascending.
    The page name is included so that pages with identical scores -- which is
    common on small symmetric test graphs -- always come out in the same order
    instead of shuffling between runs and breaking test assertions.
    """
    ranked = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked[:count]


def print_scores(scores, count=10, label="PageRank"):
    """Print a ranked, aligned table of the top pages and the total score."""
    print("    rank  {0:<28} {1}".format("page", label))
    for position, (page, score) in enumerate(top_pages(scores, count), start=1):
        print("    {0:>4}. {1:<28} {2:.6f}".format(position, page, score))
    # Printing the sum every time is a cheap, permanent sanity check: for damped
    # PageRank it must read 1.000000, and any other value means a bug.
    print("    {0:>4}  {1:<28} {2:.6f}".format("", "SUM OF ALL SCORES", sum(scores.values())))


if __name__ == "__main__":
    # The same 5-page example graph used in graph_model.py, so the two demos can
    # be read side by side. E is dangling (B links to it, it links to nothing).
    EXAMPLE_EDGES = [
        ("A", "B"),
        ("A", "C"),
        ("B", "C"),
        ("B", "E"),
        ("C", "A"),
        ("D", "A"),
        ("D", "C"),
    ]
    example_graph = graph_model.build_graph(EXAMPLE_EDGES)

    print("=" * 70)
    print("pagerank_engine.py  --  demo")
    print("=" * 70)
    print("\nGraph under test:")
    graph_model.print_graph(example_graph)
    print("  dangling pages:", graph_model.find_dangling_pages(example_graph))

    # -------------------------------------------------------------------------
    # DEMO 1 (Checkpoint 8) -- undamped power iteration
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 1  --  UNDAMPED power iteration   r(i) = sum r(j)/outdeg(j)")
    print("-" * 70)
    undamped_scores, undamped_iters = power_iteration_undamped(
        example_graph, report_at=(1, 5, 20))
    print("\n  final state after {0} iterations:".format(undamped_iters))
    print_scores(undamped_scores, label="score")
    print("\n  Note the sum: it is NOT 1.0. Page E swallows score every")
    print("  iteration and returns none of it. This is the bug Checkpoint 9 fixes.")

    # -------------------------------------------------------------------------
    # DEMO 2 (Checkpoint 9) -- damped PageRank
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 2  --  DAMPED PageRank (d = {0}, tolerance = {1})"
          .format(DEFAULT_DAMPING, DEFAULT_TOLERANCE))
    print("-" * 70)
    damped_scores, damped_iters = pagerank(example_graph, report_at=(1, 5, 20))
    print("\n  converged after {0} iterations:".format(damped_iters))
    print_scores(damped_scores)
    print("\n  The sum stays at 1.000000 on every single iteration, because the")
    print("  score trapped on E is handed back out across all 5 pages each time.")

    # -------------------------------------------------------------------------
    # DEMO 3 (Checkpoint 9) -- the leak demo, side by side
    # -------------------------------------------------------------------------
    # A tiny graph with a two-page cycle feeding a dead end:
    #     LeakA <-> LeakB,  and  LeakB -> LeakC,  where LeakC links nowhere.
    # The cycle is there on purpose: with a plain chain the score would hit
    # exactly zero in three steps, which looks like a special case. The cycle
    # keeps recirculating score while LeakC skims some off every iteration, so
    # the decay is visibly geometric -- the general behaviour, not a corner case.
    print("\n" + "-" * 70)
    print("DEMO 3  --  SCORE LEAK: undamped vs damped on a graph with a dead end")
    print("-" * 70)
    leak_graph = graph_model.build_graph([
        ("LeakA", "LeakB"),
        ("LeakB", "LeakA"),
        ("LeakB", "LeakC"),
    ])
    print("\n  Graph:")
    graph_model.print_graph(leak_graph)

    print("\n  Total score after each iteration:\n")
    print("    {0:>9}  {1:>16}  {2:>16}".format("iteration", "undamped sum", "damped sum"))

    # Both versions are re-run from scratch with a rising iteration cap and a
    # tolerance of 0.0, so neither can stop early. That keeps the two columns
    # aligned on the same iteration numbers, which is the whole point of the
    # comparison. Re-running from scratch is O(k^2) work overall, which is
    # irrelevant on a 3-page graph and keeps the demo code readable.
    for step in (1, 2, 3, 5, 10, 20, 40):
        leaked, _ = power_iteration_undamped(
            leak_graph, tolerance=0.0, max_iterations=step)
        held, _ = pagerank(
            leak_graph, tolerance=0.0, max_iterations=step)
        print("    {0:>9}  {1:>16.8f}  {2:>16.8f}"
              .format(step, sum(leaked.values()), sum(held.values())))

    print("\n  The undamped column decays towards 0.00000000 -- every page's")
    print("  score eventually drains into the dead end and is destroyed.")
    print("  The damped column holds at exactly 1.00000000, which is what makes")
    print("  the scores comparable as probabilities and rankable against each other.")
    # -------------------------------------------------------------------------
    # DEMO 4 (Checkpoint 11) -- sparse vs dense, across growing graphs
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 4  --  sparse adjacency vs dense matrix, as the graph grows")
    print("-" * 70)

    # Each page keeps ~10 out-links regardless of graph size, so E grows
    # linearly with N while N^2 grows quadratically. That gap is the point.
    LINKS_PER_PAGE = 10
    BENCHMARK_SIZES = (50, 200, 500)

    print("\n  Every page has ~{0} out-links at every size.\n".format(LINKS_PER_PAGE))
    print("    {0:>7} {1:>9} {2:>13} {3:>13} {4:>10} {5:>9}"
          .format("pages", "edges", "sparse (s)", "dense (s)", "speedup", "agree?"))
    print("    " + "-" * 66)

    for size in BENCHMARK_SIZES:
        benchmark_graph = make_random_graph(size, LINKS_PER_PAGE)
        edge_total = graph_model.edge_count(benchmark_graph)

        sparse_start = time.perf_counter()
        sparse_scores, _ = pagerank_sparse(benchmark_graph)
        sparse_seconds = time.perf_counter() - sparse_start

        dense_start = time.perf_counter()
        dense_scores, _ = pagerank_dense(benchmark_graph)
        dense_seconds = time.perf_counter() - dense_start

        # Both methods must produce the same ranking, or the speed comparison is
        # meaningless -- a fast wrong answer is not an optimisation.
        largest_gap = max(abs(sparse_scores[page] - dense_scores[page])
                          for page in benchmark_graph)
        agree = "yes" if largest_gap < 1e-9 else "NO"

        speedup = ("{0:.1f} x".format(dense_seconds / sparse_seconds)
                   if sparse_seconds > 0 else "n/a")

        print("    {0:>7} {1:>9} {2:>13.4f} {3:>13.4f} {4:>10} {5:>9}"
              .format(size, edge_total, sparse_seconds, dense_seconds, speedup, agree))

    print("\n  The speedup grows with the graph, which is the whole claim:")
    print("    sparse  = O(k * E)    edges grow linearly with pages")
    print("    dense   = O(k * N^2)  work grows with the SQUARE of pages")
    print("\n  Ten times the pages means ten times the work for sparse, but a")
    print("  hundred times the work for dense. At 500 pages the dense version is")
    print("  spending over 95% of its multiplications on zeros -- pairs of pages")
    print("  with no link between them, which the adjacency list never visits.")
    print("=" * 70)
