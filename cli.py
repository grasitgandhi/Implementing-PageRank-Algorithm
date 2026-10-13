"""
===============================================================================
 cli.py  --  Command-line front end for the whole pipeline
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 14 (the crawl command)
                15 (the rank and search commands)
 SRS MAPPING  : FR6.1, FR6.2, FR6.3, FR6.4, NFR4
 DAD MAPPING  : Design of Algorithm document, Section 8 "End-to-End Pipeline"

 PURPOSE
 -------
 This is the only file a user ever runs. Everything else in the project is a
 library; this is the program. It wires the five modules together in the order
 the pipeline requires and prints progress as it goes (FR6.2):

     crawl   : crawler.py  ->  edges.txt + pages.db
     rank    : edges.txt   ->  graph_model  ->  pagerank_engine  ->  top pages
     search  : pages.db + edges.txt  ->  search_engine  ->  ranked results

 THREE COMMANDS
 --------------
     python cli.py crawl --seeds "PageRank,Search_engine" --max-pages 150
     python cli.py rank --top 10
     python cli.py search "pagerank algorithm" --alpha 0.5

 Run it with no arguments and it prints a usage summary rather than an error.

 WHY argparse AND NOT A CLI LIBRARY
 ----------------------------------
 argparse is in the Python standard library, so it costs no dependency. It gives
 us subcommands, typed options, validation and a generated --help for free, all
 of which we would otherwise hand-roll badly. Click and Typer would be nicer
 still, but both come from PyPI and the project forbids that.

 ON MISSING DATA
 ---------------
 rank and search both need data that only crawl produces. If it is not there,
 they say so in a sentence that names the command to run, and exit. They do not
 raise a traceback at someone trying to demo the project, and they do not
 silently rank an empty graph and print nothing.

 DEPENDENCIES
 ------------
 Standard library only: argparse, os, sys. Imports our own crawler, graph_model,
 pagerank_engine, page_store and search_engine.

 HOW TO RUN
 ----------
     python cli.py              (usage summary)
     python cli.py --help       (full argparse help)
===============================================================================
"""

import argparse
import os
import sys

import crawler
import graph_model
import page_store
import pagerank_engine
import pipeline
import search_engine


# Default seeds for a crawl, chosen because they sit in one dense topic
# neighbourhood. Seeds scattered across unrelated subjects produce a graph in
# disconnected islands, which makes PageRank far less interesting -- nothing
# links between the islands, so no authority flows between them.
DEFAULT_SEEDS = "PageRank,Search_engine,Google_Search,Web_crawler,Information_retrieval"

# 150 sits inside the 100-300 range FR1.7 requires, and takes 5-10 minutes at
# the crawler's one-second politeness delay.
DEFAULT_MAX_PAGES = 150

# How many rows each command prints by default. Ten is what fits on a terminal
# screen without scrolling, which is what matters during a live demo.
DEFAULT_RANK_TOP = 10
DEFAULT_SEARCH_TOP = 5


def require_file(path, what, fix_command):
    """Exit with a clear instruction if a required data file is missing.

    Args:
        path:        the file that has to exist.
        what:        human-readable description, for the message.
        fix_command: the exact command the user should run instead.

    Returns:
        None if the file exists; otherwise prints and exits with status 1.

    Exiting with 1 rather than 0 matters: a shell script or CI job checking the
    exit status needs to be able to tell a missing-data stop from a clean run.
    """
    if os.path.exists(path):
        return

    print("error: {0} not found ({1})".format(what, path))
    print()
    print("  Run this first:")
    print("      {0}".format(fix_command))
    print()
    print("  Or, if someone else on the team has already crawled, pull their")
    print("  committed {0} from the repository.".format(os.path.basename(path)))
    sys.exit(1)


def load_graph(edges_path):
    """Load edges.txt and build the directed graph from it.

    Args:
        edges_path: the edge list written by the crawler.

    Returns:
        the adjacency-list graph.

    Exits if the file is missing or holds no usable edges. An empty graph is
    worth catching separately: the file existing but being empty means a crawl
    ran and failed, which is a different problem from never having crawled, and
    deserves a different message.
    """
    require_file(edges_path, "the crawled link graph",
                 'python cli.py crawl --seeds "{0}"'.format(DEFAULT_SEEDS))

    edges = crawler.read_edges_file(edges_path)

    if not edges:
        print("error: {0} exists but contains no edges.".format(edges_path))
        print("       The crawl probably failed partway. Try running it again.")
        sys.exit(1)

    return graph_model.build_graph(edges)


# =============================================================================
# CHECKPOINT 14 -- the crawl command
# =============================================================================

def command_crawl(arguments):
    """Crawl from the seed pages, then write edges.txt and pages.db.

    Args:
        arguments: parsed argparse namespace with seeds, max_pages, force.

    This is the only command that touches the network, and the only one that
    writes data. Everything else reads what it leaves behind -- which is what
    makes the offline demo possible (NFR4).
    """
    # Split on commas and drop blanks, so --seeds "A, B," behaves sensibly
    # rather than trying to crawl an article called "" .
    seed_titles = [title.strip() for title in arguments.seeds.split(",") if title.strip()]

    if not seed_titles:
        print("error: no usable seed titles in {0!r}".format(arguments.seeds))
        sys.exit(1)

    if os.path.exists(arguments.edges) and not arguments.force:
        status = crawler.edges_cache_status(arguments.edges)
        print("A crawl already exists: {0} edges across {1} pages in {2}"
              .format(status["edge_count"], status["page_count"], arguments.edges))
        print("Pass --force to crawl again and overwrite it.")
        return

    print("Crawling from {0} seed(s), up to {1} pages"
          .format(len(seed_titles), arguments.max_pages))
    print("  seeds: {0}".format(", ".join(seed_titles)))
    print("  this takes several minutes -- roughly a second per page, plus the")
    print("  download itself. Progress follows.\n")

    summary = pipeline.crawl_and_store(
        seed_titles,
        arguments.max_pages,
        edges_path=arguments.edges,
        db_path=arguments.db,
        verbose=True,
    )

    if not summary or summary["pages"] == 0:
        print("\nerror: the crawl fetched no pages at all.")
        print("       Check your internet connection and try again.")
        sys.exit(1)

    # ---- edges.txt, for ranking ------------------------------------------
    print("\nWrote {0} edges to {1}".format(summary["edges"], arguments.edges))

    # ---- pages.db, for searching ------------------------------------------
    print("Wrote {0} page records to {1}".format(summary["pages"], arguments.db))

    print("\nCrawl complete:")
    print("  pages fetched : {0}".format(summary["pages"]))
    print("  edges kept    : {0}".format(summary["edges"]))
    print("  dangling pages: {0}".format(summary["dangling"]))
    print("\nNext: python cli.py rank")


# =============================================================================
# CHECKPOINT 15 -- the rank and search commands
# =============================================================================

def command_rank(arguments):
    """Compute PageRank over the crawled graph and print the top pages.

    Args:
        arguments: parsed namespace with top, damping, edges.

    Reads only edges.txt, so it runs with no network access at all.
    """
    graph = load_graph(arguments.edges)
    pages = graph_model.all_pages(graph)

    print("Ranking {0} pages, {1} edges (d = {2})"
          .format(len(pages), graph_model.edge_count(graph), arguments.damping))

    dangling = graph_model.find_dangling_pages(graph)
    print("  dangling pages: {0} (their score is redistributed each iteration)"
          .format(len(dangling)))

    scores, iterations = pagerank_engine.pagerank(graph, damping=arguments.damping)

    print("  converged after {0} iterations".format(iterations))
    print("  total of all scores: {0:.6f}  (must be 1.000000)\n"
          .format(sum(scores.values())))

    print("Top {0} pages by PageRank:\n".format(arguments.top))
    print("    {0:<5} {1:<44} {2:>10}".format("rank", "page", "score"))
    print("    " + "-" * 61)

    for position, (page, score) in enumerate(
            pagerank_engine.top_pages(scores, arguments.top), start=1):
        print("    {0:<5} {1:<44} {2:>10.6f}".format(position, page[:44], score))

    print("\nNext: python cli.py search \"your query here\"")


def command_search(arguments):
    """Search the crawled pages, ranking by relevance fused with PageRank.

    Args:
        arguments: parsed namespace with query, alpha, top, edges, db.

    Needs BOTH data files: edges.txt for the authority half and pages.db for the
    text half. Each is checked separately so the error message can name the one
    that is actually missing.
    """
    graph = load_graph(arguments.edges)

    require_file(arguments.db, "the stored page text",
                 'python cli.py crawl --seeds "{0}"'.format(DEFAULT_SEEDS))

    # ---- authority half ----------------------------------------------------
    print("Loading...")
    scores, iterations = pagerank_engine.pagerank(graph)
    print("  PageRank: {0} pages, converged in {1} iterations"
          .format(len(scores), iterations))

    # ---- relevance half ----------------------------------------------------
    store = page_store.SimplePageStore(arguments.db)
    page_texts = {record["id"]: record["text"] for record in store.iter_records()}

    if not page_texts:
        print("error: {0} contains no page records.".format(arguments.db))
        print("       Run the crawl again to rebuild it.")
        sys.exit(1)

    print("  Text index: {0} pages".format(len(page_texts)))

    engine = search_engine.SearchEngine(page_texts, scores)
    print("  Vocabulary: {0} distinct terms\n".format(len(engine.idf)))

    results = engine.search(arguments.query, alpha=arguments.alpha, limit=arguments.top)

    if not results:
        print("No page matched {0!r}.".format(arguments.query))
        print()
        print("  Either none of those words appear in the crawled pages, or they")
        print("  appear in so many that they carry no distinguishing weight.")
        print("  Try more specific terms.")
        return

    print("Results for {0!r}   (alpha = {1}: {2:.0f}% relevance, {3:.0f}% authority)\n"
          .format(arguments.query, arguments.alpha,
                  arguments.alpha * 100, (1 - arguments.alpha) * 100))

    print("    {0:<4} {1:<38} {2:>9} {3:>11} {4:>10}"
          .format("#", "page", "final", "relevance", "pagerank"))
    print("    " + "-" * 75)

    for position, row in enumerate(results, start=1):
        print("    {0:<4} {1:<38} {2:>9.4f} {3:>11.4f} {4:>10.4f}"
              .format(position, row["page_id"][:38], row["final"],
                      row["relevance"], row["pagerank"]))

    print("\n  final = alpha x relevance + (1 - alpha) x pagerank")
    print("  Raise --alpha to trust the text more, lower it to trust the links more.")


def build_parser():
    """Construct the argparse parser with its three subcommands.

    Kept as its own function so the test suite can build a parser and check the
    argument wiring without running any command.
    """
    parser = argparse.ArgumentParser(
        prog="python cli.py",
        description="PageRank search engine, built from scratch (Group 81).")

    # dest="command" so the dispatcher below can tell which subcommand ran.
    subcommands = parser.add_subparsers(dest="command", metavar="COMMAND")

    # ---- crawl ------------------------------------------------------------
    crawl_parser = subcommands.add_parser(
        "crawl", help="fetch pages from the web and store them")
    crawl_parser.add_argument(
        "--seeds", default=DEFAULT_SEEDS,
        help="comma-separated Wikipedia article titles to start from")
    crawl_parser.add_argument(
        "--max-pages", type=int, default=DEFAULT_MAX_PAGES, dest="max_pages",
        help="stop after this many pages (default {0})".format(DEFAULT_MAX_PAGES))
    crawl_parser.add_argument(
        "--force", action="store_true",
        help="crawl again even if edges.txt already exists")

    # ---- rank -------------------------------------------------------------
    rank_parser = subcommands.add_parser(
        "rank", help="compute PageRank over the crawled graph")
    rank_parser.add_argument(
        "--top", type=int, default=DEFAULT_RANK_TOP,
        help="how many pages to print (default {0})".format(DEFAULT_RANK_TOP))
    rank_parser.add_argument(
        "--damping", type=float, default=pagerank_engine.DEFAULT_DAMPING,
        help="damping factor d (default {0})".format(pagerank_engine.DEFAULT_DAMPING))

    # ---- search -----------------------------------------------------------
    search_parser = subcommands.add_parser(
        "search", help="search the crawled pages")
    search_parser.add_argument("query", help="the text to search for")
    search_parser.add_argument(
        "--alpha", type=float, default=search_engine.DEFAULT_ALPHA,
        help="0.0 = PageRank only, 1.0 = relevance only (default {0})"
             .format(search_engine.DEFAULT_ALPHA))
    search_parser.add_argument(
        "--top", type=int, default=DEFAULT_SEARCH_TOP,
        help="how many results to print (default {0})".format(DEFAULT_SEARCH_TOP))

    # ---- shared between all three ----------------------------------------
    # Added to each subparser rather than the top level, because argparse
    # requires options to come after the subcommand name and a top-level option
    # would have to be typed before it, which reads backwards.
    for subparser in (crawl_parser, rank_parser, search_parser):
        subparser.add_argument(
            "--edges", default=crawler.EDGES_FILE,
            help="edge list file (default {0})".format(crawler.EDGES_FILE))
        subparser.add_argument(
            "--db", default=page_store.DEFAULT_DB_PATH,
            help="page store file (default {0})".format(page_store.DEFAULT_DB_PATH))

    return parser


def print_usage_summary():
    """Print a friendly summary when the tool is run with no arguments.

    argparse's own error for a missing subcommand is terse and unhelpful to
    someone running the project for the first time, which during evaluation is
    everyone. This is what they see instead.
    """
    print("=" * 70)
    print("PageRank Search Engine  --  Group 81")
    print("=" * 70)
    print()
    print("  Three commands, in the order you use them:")
    print()
    print("  1. Fetch pages from the web and store them:")
    print('       python cli.py crawl --seeds "PageRank,Search_engine" --max-pages 150')
    print()
    print("  2. Rank the crawled pages by link authority:")
    print("       python cli.py rank --top 10")
    print()
    print("  3. Search them, combining relevance with authority:")
    print('       python cli.py search "pagerank algorithm" --alpha 0.5')
    print()
    print("  Only step 1 needs the internet. Once edges.txt and pages.db exist,")
    print("  ranking and searching work entirely offline.")
    print()
    print("  Full options:  python cli.py --help")
    print("=" * 70)


def main(argv=None):
    """Parse the command line and dispatch to the right command.

    Args:
        argv: argument list, defaulting to the real command line. Passing a list
              explicitly is what lets the end-to-end test drive the CLI directly
              instead of launching a subprocess.

    Returns:
        None. Commands that fail call sys.exit with a non-zero status.
    """
    parser = build_parser()
    arguments = parser.parse_args(argv)

    # No subcommand given: show the friendly summary instead of an argparse error.
    if arguments.command is None:
        print_usage_summary()
        return

    # A plain dict dispatch rather than a chain of if/elif. Adding a fourth
    # command later means adding one line here, not another branch.
    handlers = {
        "crawl": command_crawl,
        "rank": command_rank,
        "search": command_search,
    }
    handlers[arguments.command](arguments)


if __name__ == "__main__":
    main()
