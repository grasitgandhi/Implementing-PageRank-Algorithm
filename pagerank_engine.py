"""
===============================================================================
 pagerank_engine.py  --  PageRank by power iteration (undamped and damped)
===============================================================================

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
 Standard library only: no imports beyond graph_model, which is our own file.
===============================================================================
"""

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
    print("=" * 70)