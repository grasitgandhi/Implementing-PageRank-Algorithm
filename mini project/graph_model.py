"""
===============================================================================
 graph_model.py  --  Directed web-graph model (adjacency list)
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 7 (Days 29-33)  --  first coding checkpoint
 SRS MAPPING  : FR3.1, FR3.2, FR3.3   (see SRS Section 4.3 "Graph Construction")
 DAD MAPPING  : Design of Algorithm document, Section 5 "Adjacency-List Build"

 PURPOSE
 -------
 Every later module in this project consumes a graph, so this file defines the
 one and only graph representation the whole team agrees on. A crawled web is a
 directed graph G = (V, E):

     V  =  the set of crawled pages           (each page is a string identifier)
     E  =  the set of hyperlinks between them (an edge u -> v means "u links to v")

 We store it as an ADJACENCY LIST, which in Python is simply:

     graph = { "PageA": ["PageB", "PageC"],
               "PageB": ["PageC"],
               "PageC": [] }

 WHY AN ADJACENCY LIST AND NOT AN N x N MATRIX
 ---------------------------------------------
 A real crawl of 300 pages would need a 300 x 300 = 90,000-cell matrix, but a
 typical page links to maybe 10 others, so ~97% of that matrix would be zeros
 that we would still have to allocate and loop over. The adjacency list stores
 only the edges that actually exist, so memory is O(V + E) instead of O(V^2),
 and one PageRank iteration costs O(V + E) instead of O(V^2). This is the single
 most important data-structure decision in the project and it is what makes the
 sparse-vs-dense benchmark in Checkpoint 11 possible.

 KEY DEFINITION -- DANGLING PAGE
 -------------------------------
 A dangling page (also called a dead end or a rank sink) is a page with ZERO
 outgoing links. It matters because of the PageRank formula:

     r(i) = sum over all j linking to i of  r(j) / outdeg(j)

 A dangling page has outdeg = 0, so it receives score every iteration but never
 passes any on. Left untreated, the total score of the graph leaks away towards
 zero. This file only DETECTS dangling pages; pagerank_engine.py (Checkpoint 9)
 is what actually redistributes their trapped score.

 DEPENDENCIES
 ------------
 Python 3.8+ standard library only. This file imports nothing at all -- it is
 pure Python data-structure code, which is exactly why it is the easiest module
 in the project to unit-test in isolation (SRS NFR8).

 HOW TO RUN
 ----------
     python graph_model.py

 The __main__ block at the bottom builds a small 5-page example graph, prints
 the adjacency list, prints the out-degree of every page, and reports which
 pages are dangling.
===============================================================================
"""


def build_graph(edges):
    """Build an adjacency-list graph from a list of (source, target) pairs.

    Args:
        edges: an iterable of 2-tuples (source_page, target_page), each being a
               string. Duplicate pairs are allowed in the input; they are
               collapsed into a single edge (see add_edge for why).

    Returns:
        dict mapping every known page -> list of pages it links to.

    Example:
        >>> build_graph([("A", "B"), ("B", "A")])
        {'A': ['B'], 'B': ['A']}
    """
    graph = {}
    for source, target in edges:
        # add_edge (not direct dict writes) so that the "register the target as
        # a node too" rule lives in exactly one place and can never be forgotten.
        add_edge(graph, source, target)
    return graph


def add_edge(graph, source, target):
    """Add a single directed edge source -> target to an existing graph.

    Args:
        graph:  the adjacency-list dict to modify, changed in place.
        source: page the link is written on.
        target: page the link points at.

    Returns:
        None. The graph is modified in place, which is the cheaper option when
        the crawler calls this once per hyperlink on a few hundred pages.
    """
    # setdefault, not graph[source] = [], because the page may already be in the
    # graph from an earlier edge and we must not wipe the links we already found.
    graph.setdefault(source, [])

    # A target page is still a NODE of the graph even if we have not seen its own
    # outgoing links yet. If we skipped this line, a page that is only ever
    # linked TO would silently vanish from the graph, PageRank would never assign
    # it a score, and worse, find_dangling_pages() would never see it -- so its
    # trapped score would leak with nothing to detect it. Registering it now with
    # an empty list means "known page, no outgoing links found (yet)".
    graph.setdefault(target, [])

    # Ignore a repeated hyperlink to the same target. Real web pages link to the
    # same article several times (navigation box, body text, footer). PageRank
    # treats a link as one vote, so counting it three times would let a page
    # inflate the score of its friends just by repeating the same href.
    if target not in graph[source]:
        graph[source].append(target)


def all_pages(graph):
    """Return a sorted list of every page in the graph.

    Sorted (not raw dict order) so that printed output and test assertions are
    reproducible across runs and machines -- SRS NFR9 asks for every result to be
    reproducible by hand, and that is impossible if the page order shuffles.
    """
    return sorted(graph.keys())


def out_degree(graph, page):
    """Return how many distinct pages the given page links to.

    An unknown page returns 0 rather than raising, because the callers that need
    this (the PageRank engine) treat "unknown" and "no outgoing links" the same
    way: nothing to divide the score across.
    """
    return len(graph.get(page, []))


def edge_count(graph):
    """Return the total number of directed edges E in the graph.

    Used in the report's complexity analysis, where the sparse PageRank cost is
    stated as O(k * E) for k iterations.
    """
    return sum(len(targets) for targets in graph.values())


def find_dangling_pages(graph):
    """Return a sorted list of pages that have no outgoing links (FR3.3).

    These are the dead ends that would otherwise leak PageRank score out of the
    system. pagerank_engine.pagerank() collects their score every iteration and
    redistributes it evenly across all pages.

    Returns:
        list of page identifiers, sorted for reproducible output.
    """
    # A page qualifies if its adjacency list is empty. Because add_edge()
    # registers link TARGETS as nodes too, a page we linked to but never crawled
    # correctly shows up here instead of being invisible.
    return sorted(page for page, targets in graph.items() if len(targets) == 0)


def print_graph(graph):
    """Print the adjacency list in a readable, aligned form.

    Kept in this module rather than in the CLI because every module's __main__
    demo block needs to dump a graph, and three copies of the same formatting
    code would drift apart over 12 weeks.
    """
    pages = all_pages(graph)

    # Pad every page name to the width of the longest one so the arrows line up.
    # max() on an empty sequence raises, hence the "or 1" fallback for an empty graph.
    width = max((len(p) for p in pages), default=1)

    for page in pages:
        targets = graph[page]
        # "(dangling)" is printed instead of an empty list so a reader scanning
        # the output does not have to notice the absence of something.
        shown = ", ".join(targets) if targets else "(dangling -- no outgoing links)"
        print("  {0:<{1}}  ->  {2}".format(page, width, shown))


if __name__ == "__main__":
    # -------------------------------------------------------------------------
    # Standalone demo: a hand-drawn 5-page example graph.
    #
    # This exact graph is the one used in the report and in the test files, so
    # the numbers printed here can be checked against a hand calculation.
    #
    #        A ---> B ---> E          E has no outgoing links  -> dangling
    #        |      |
    #        v      v
    #        C <--- +        and      C ---> A   (a cycle A -> C -> A)
    #        ^
    #        |
    #        D              D links into the cycle but nothing links to D
    # -------------------------------------------------------------------------
    EXAMPLE_EDGES = [
        ("A", "B"),
        ("A", "C"),
        ("B", "C"),
        ("B", "E"),
        ("C", "A"),
        ("D", "A"),
        ("D", "C"),
    ]

    example_graph = build_graph(EXAMPLE_EDGES)

    print("=" * 70)
    print("graph_model.py  --  example graph")
    print("=" * 70)

    print("\nAdjacency list:")
    print_graph(example_graph)

    print("\nBasic counts:")
    print("  pages (V) :", len(all_pages(example_graph)))
    print("  edges (E) :", edge_count(example_graph))

    print("\nOut-degree of each page:")
    for page_name in all_pages(example_graph):
        print("  outdeg({0}) = {1}".format(page_name, out_degree(example_graph, page_name)))

    dangling = find_dangling_pages(example_graph)
    print("\nDangling pages (zero outgoing links):")
    print("  ", dangling if dangling else "(none)")
    print("\nE is dangling because it was only ever a link TARGET (B -> E); we")
    print("registered it as a node so its trapped score can be redistributed")
    print("later by pagerank_engine.py instead of leaking out of the system.")
    print("=" * 70)
