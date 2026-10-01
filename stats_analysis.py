"""
===============================================================================
 stats_analysis.py  --  Random graph generation and hand-written statistics
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 11 (Days 49-53)
 COURSE       : CE205 Statistical Methods in Computer Science
 DAD MAPPING  : supports the complexity and data-characterisation sections

 PURPOSE
 -------
 Two jobs, both needed to say anything quantitative about our graph in the report.

 1. A RANDOM GRAPH GENERATOR. The crawl gives us exactly one graph, and one
    sample tells you nothing about whether a result is typical or a fluke. The
    Erdos-Renyi model generates graphs of any size on demand, which lets us
    benchmark the PageRank engine at sizes we never crawled and gives us a
    baseline to compare the real crawl against.

 2. MEAN, VARIANCE AND STANDARD DEVIATION, written out by hand. Python's
    statistics module would do this in one import, but the point of the course
    mapping is to show the formulas, not to call them.

 THE ERDOS-RENYI MODEL  G(n, p)
 ------------------------------
 The simplest possible random graph. For n pages and a probability p, consider
 every one of the n*(n-1) possible directed edges in turn and include it with
 probability p, independently of every other edge.

 Two consequences worth knowing:

   - The expected out-degree of every page is  p * (n-1),  the same for all
     pages. Real web graphs are nothing like this -- a handful of pages have
     enormous in-degree and most have almost none. That difference is the whole
     reason PageRank is interesting, and comparing our crawl's degree spread
     against this model's is how we show it numerically.

   - The expected number of edges is  p * n * (n-1),  so p controls density
     directly. p = 0.05 on 50 pages gives roughly 122 edges.

 THE FORMULAS
 ------------
     mean      = (sum of all values) / n
     variance  = (sum of (value - mean)^2) / n
     std_dev   = sqrt(variance)

 Variance is the average squared distance from the mean. Squaring is what stops
 values above and below the mean cancelling out to zero. Standard deviation is
 its square root, which puts the answer back into the same units as the original
 data -- "out-degree varies by about 2.2 links" rather than "about 4.8 links
 squared", which means nothing to a reader.

 DEPENDENCIES
 ------------
 Standard library only: math, random. No statistics module, by design.
 Imports graph_model, which is ours.

 HOW TO RUN
 ----------
     python stats_analysis.py
===============================================================================
"""

import math
import random

import graph_model


# Fixed seed so that every run of this file produces the same graphs and the
# same numbers. A benchmark or a report figure that changes every time it is
# run cannot be checked by anyone, including us.
DEFAULT_SEED = 81


def mean(values):
    """Arithmetic mean: the sum divided by how many there are.

    Args:
        values: list of numbers.

    Returns:
        float, or 0.0 for an empty list.

    Returning 0.0 rather than raising on empty input, because the callers here
    are describing data that may legitimately be empty (a graph with no pages),
    and a crash in a statistics helper would be a silly way to lose a demo.
    """
    if not values:
        return 0.0

    # sum() and len() are builtins, not the statistics module, so this is still
    # the formula written out rather than a library call doing the thinking.
    return sum(values) / len(values)


def variance(values):
    """Population variance: the average squared distance from the mean.

    Args:
        values: list of numbers.

    Returns:
        float, or 0.0 for a list of fewer than two values.

    POPULATION, not sample. We divide by n, not by (n - 1). The distinction
    matters and is worth being able to defend: dividing by (n-1) is the right
    choice when your numbers are a SAMPLE drawn from a larger population whose
    variance you are trying to estimate. Here the numbers ARE the whole
    population -- we have every page in the graph, not a sample of them -- so
    there is nothing to estimate and n is correct.
    """
    if len(values) < 2:
        # A single value has no spread, and an empty list has nothing to spread.
        return 0.0

    average = mean(values)

    # The mean is computed once, outside the comprehension. Calling mean()
    # inside it would recompute the same average for every value, turning an
    # O(n) pass into O(n^2) for no reason.
    squared_deviations = [(value - average) ** 2 for value in values]

    return sum(squared_deviations) / len(values)


def std_dev(values):
    """Standard deviation: the square root of the variance.

    Args:
        values: list of numbers.

    Returns:
        float.

    Why bother, when variance already measures spread: variance is in SQUARED
    units. If out-degrees are counted in links, variance is in links-squared,
    which nobody can picture. The square root puts it back into links, so it can
    be compared against the mean directly.
    """
    return math.sqrt(variance(values))


def erdos_renyi_graph(page_count, edge_probability, seed=DEFAULT_SEED):
    """Generate a random directed graph under the G(n, p) model.

    Args:
        page_count:       n, how many pages.
        edge_probability: p, the chance of each possible edge existing, 0 to 1.
        seed:             fixed for reproducibility; pass None for true variety.

    Returns:
        adjacency-list dict in the same shape graph_model produces, so every
        other module in the project accepts it without modification.

    Raises:
        ValueError: if p is outside [0, 1], which would not be a probability.

    The loop considers each ordered pair (source, target) exactly once, giving
    n*(n-1) independent coin flips. Self-links are skipped: a page linking to
    itself is not evidence of anything, and the crawler filters them out of the
    real graph too, so the model should match.
    """
    if not 0.0 <= edge_probability <= 1.0:
        raise ValueError("edge_probability must be between 0 and 1, got {0!r}"
                         .format(edge_probability))

    if seed is not None:
        random.seed(seed)

    names = ["page{0:03d}".format(index) for index in range(page_count)]
    graph = {name: [] for name in names}

    for source in names:
        for target in names:
            if source == target:
                continue  # no self-links, matching the real crawler

            # One independent trial per possible edge. random.random() returns a
            # float in [0, 1), so it lands below p exactly p of the time.
            if random.random() < edge_probability:
                graph[source].append(target)

    return graph


def out_degree_list(graph):
    """Return every page's out-degree as a plain list of numbers.

    Sorted by page name first, so the list order is reproducible and the
    statistics computed from it are identical on every run and every machine.
    """
    return [len(graph[page]) for page in graph_model.all_pages(graph)]


def in_degree_list(graph):
    """Return every page's in-degree -- how many pages link TO it.

    In-degree is the more interesting of the two for this project: out-degree is
    roughly whatever the page author chose, while in-degree is the raw popularity
    signal PageRank refines. On a random graph the two look alike; on a real
    crawl they do not, and that contrast is the point of the demo below.
    """
    incoming_counts = {page: 0 for page in graph_model.all_pages(graph)}

    for targets in graph.values():
        for target in targets:
            if target in incoming_counts:
                incoming_counts[target] += 1

    return [incoming_counts[page] for page in graph_model.all_pages(graph)]


def describe(values, label):
    """Print mean, variance, standard deviation, min and max for a list.

    Kept as one function because every demo below needs exactly this block, and
    three copies of the same format string would drift apart.
    """
    print("    {0}".format(label))
    print("      count     : {0}".format(len(values)))
    print("      mean      : {0:.4f}".format(mean(values)))
    print("      variance  : {0:.4f}".format(variance(values)))
    print("      std dev   : {0:.4f}".format(std_dev(values)))
    if values:
        print("      min / max : {0} / {1}".format(min(values), max(values)))


def histogram(values, label, width=40):
    """Print a text histogram of how often each value occurs.

    A table of numbers hides the shape of a distribution; a histogram shows it
    at a glance, which is what makes the random-vs-real contrast obvious rather
    than something the reader has to work out.
    """
    if not values:
        return

    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1

    tallest = max(counts.values())

    print("    {0}".format(label))
    for value in sorted(counts):
        # Scale the longest bar to `width`, so the shape is readable whether the
        # tallest bar represents 3 pages or 300.
        bar_length = int(round(width * counts[value] / tallest))
        print("      {0:>3} | {1:<{2}} {3}"
              .format(value, "#" * bar_length, width, counts[value]))


if __name__ == "__main__":
    print("=" * 70)
    print("stats_analysis.py  --  demo")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # DEMO 1 -- the statistics functions, hand-checked.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 1  --  mean, variance and standard deviation, checked by hand")
    print("-" * 70)

    SAMPLE = [2, 4, 4, 4, 5, 5, 7, 9]

    print("\n  data: {0}".format(SAMPLE))
    print("\n  By hand:")
    print("    mean      = (2+4+4+4+5+5+7+9) / 8 = 40 / 8 = 5.0")
    print("    deviations from the mean : [-3, -1, -1, -1, 0, 0, 2, 4]")
    print("    squared                  : [ 9,  1,  1,  1, 0, 0, 4, 16] = 32")
    print("    variance  = 32 / 8 = 4.0")
    print("    std dev   = sqrt(4.0) = 2.0")

    print("\n  From the functions:")
    print("    mean      = {0}".format(mean(SAMPLE)))
    print("    variance  = {0}".format(variance(SAMPLE)))
    print("    std dev   = {0}".format(std_dev(SAMPLE)))

    # Asserting rather than only printing: a demo that prints a wrong number
    # still looks fine, while a failed assert cannot be read past.
    assert mean(SAMPLE) == 5.0
    assert variance(SAMPLE) == 4.0
    assert std_dev(SAMPLE) == 2.0
    print("\n  All three match the hand calculation exactly.")

    # Edge cases, stated openly rather than left to be discovered later.
    print("\n  Edge cases:")
    print("    mean([])        = {0}".format(mean([])))
    print("    variance([7])   = {0}   (one value has no spread)".format(variance([7])))

    # -------------------------------------------------------------------------
    # DEMO 2 -- a small Erdos-Renyi graph, printed in full.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 2  --  erdos_renyi_graph(): a small graph you can read")
    print("-" * 70)

    SMALL_PAGES = 8
    SMALL_PROBABILITY = 0.25

    small_graph = erdos_renyi_graph(SMALL_PAGES, SMALL_PROBABILITY)

    print("\n  G(n = {0}, p = {1})".format(SMALL_PAGES, SMALL_PROBABILITY))
    print("  expected out-degree per page = p * (n-1) = {0} * {1} = {2:.2f}\n"
          .format(SMALL_PROBABILITY, SMALL_PAGES - 1,
                  SMALL_PROBABILITY * (SMALL_PAGES - 1)))
    graph_model.print_graph(small_graph)

    print("\n  edges generated : {0}".format(graph_model.edge_count(small_graph)))
    print("  edges expected  : p * n * (n-1) = {0:.2f}"
          .format(SMALL_PROBABILITY * SMALL_PAGES * (SMALL_PAGES - 1)))
    print("  dangling pages  : {0}".format(graph_model.find_dangling_pages(small_graph)))

    # -------------------------------------------------------------------------
    # DEMO 3 -- statistics on a larger generated graph.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 3  --  degree statistics on a larger random graph")
    print("-" * 70)

    LARGE_PAGES = 200
    LARGE_PROBABILITY = 0.05

    large_graph = erdos_renyi_graph(LARGE_PAGES, LARGE_PROBABILITY)
    out_degrees = out_degree_list(large_graph)
    in_degrees = in_degree_list(large_graph)

    print("\n  G(n = {0}, p = {1}), {2} edges generated\n"
          .format(LARGE_PAGES, LARGE_PROBABILITY, graph_model.edge_count(large_graph)))

    describe(out_degrees, "out-degree:")
    print()
    describe(in_degrees, "in-degree:")

    expected_degree = LARGE_PROBABILITY * (LARGE_PAGES - 1)
    print("\n  Theory says the mean degree should be p * (n-1) = {0:.2f}."
          .format(expected_degree))
    print("  Measured out-degree mean: {0:.2f}.".format(mean(out_degrees)))
    print("  The generator is behaving as the model predicts.")

    print()
    histogram(in_degrees, "in-degree distribution:")

    print("\n  Notice the shape: a single hump centred on the mean, falling away")
    print("  evenly on both sides. Every page is about equally popular, because")
    print("  every edge was an independent coin flip.")
    print("\n  A real crawl looks nothing like this. A few pages collect huge")
    print("  in-degree while most collect almost none, and that lopsidedness is")
    print("  precisely the signal PageRank exists to measure. Run this against")
    print("  the crawled graph from edges.txt to see the contrast directly.")
    print("=" * 70)
