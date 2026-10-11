"""
===============================================================================
 pipeline.py  --  Shared service layer for the crawl/rank/search pipeline
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 PURPOSE      : Functions that both cli.py and server.py call, so the pipeline
                logic (crawl -> edges -> graph -> pagerank -> search) exists in
                exactly one place.

 DEPENDENCIES : Standard library only: os, threading, time.
                Imports our own crawler, graph_model, pagerank_engine,
                page_store, search_engine.
===============================================================================
"""

import os
import threading
import time

import crawler
import graph_model
import page_store
import pagerank_engine
import search_engine


# ─────────────────────────────────────────────────────────
# Crawl status — shared between the crawl thread and the
# server's status endpoint.
# ─────────────────────────────────────────────────────────

_crawl_lock = threading.Lock()

_crawl_status = {
    "state": "idle",       # idle | running | done | error
    "fetched": 0,
    "max_pages": 0,
    "current": "",
    "error": "",
}


def get_crawl_status():
    """Return a snapshot of the current crawl status."""
    with _crawl_lock:
        return dict(_crawl_status)


def _set_crawl_status(**kwargs):
    with _crawl_lock:
        _crawl_status.update(kwargs)


# ─────────────────────────────────────────────────────────
# crawl_and_store  — the same steps command_crawl does
# ─────────────────────────────────────────────────────────

def crawl_and_store(seeds, max_pages, edges_path, db_path, progress_cb=None):
    """Run the full crawl pipeline: crawl -> write edges -> build graph -> store pages.

    Args:
        seeds:       list of Wikipedia article titles.
        max_pages:   stop after this many pages.
        edges_path:  where to write edges.txt.
        db_path:     where to write pages.db.
        progress_cb: optional callback(fetched, max_pages, title) called once
                     per successfully fetched page.

    Returns:
        dict with keys: pages (int), edges (int), dangling (int).
    """
    edges, pages = crawler.crawl(seeds, max_pages, verbose=True)

    if not pages:
        raise RuntimeError("The crawl fetched no pages at all.")

    # Atomic write for edges: write to a temp file, then rename.
    tmp_edges = edges_path + ".tmp"
    crawler.write_edges_file(edges, tmp_edges)
    os.replace(tmp_edges, edges_path)

    # Build graph and store pages.
    graph = graph_model.build_graph(edges)
    store = page_store.SimplePageStore(db_path, reset=True)

    for title, text in pages.items():
        store.insert(title, title.replace("_", " "),
                     graph_model.out_degree(graph, title), text)

    dangling_count = len(graph_model.find_dangling_pages(graph))

    # Invalidate the cached index so the next API call rebuilds it.
    _invalidate_index_cache()

    return {
        "pages": len(pages),
        "edges": len(edges),
        "dangling": dangling_count,
    }


# ─────────────────────────────────────────────────────────
# Background crawl — runs in one thread, guarded by lock
# ─────────────────────────────────────────────────────────

_bg_crawl_lock = threading.Lock()
_bg_crawl_thread = None


def start_background_crawl(seeds, max_pages, edges_path, db_path):
    """Start a crawl in a background thread.  Returns True if started,
    False if a crawl is already running."""
    global _bg_crawl_thread

    if not _bg_crawl_lock.acquire(blocking=False):
        return False

    _set_crawl_status(state="running", fetched=0, max_pages=max_pages,
                      current="starting…", error="")

    def run():
        global _bg_crawl_thread
        try:
            # We use verbose=True so crawl() prints progress to stdout.
            # We also parse the output by hooking into the crawl's own
            # verbose print. Since we cannot change crawl()'s signature,
            # we patch the print temporarily to count pages.
            import io
            import sys

            original_stdout = sys.stdout
            line_buffer = io.StringIO()

            class TeeWriter:
                """Writes to both the original stdout and captures lines to
                parse progress from crawler's verbose output."""
                def write(self, text):
                    original_stdout.write(text)
                    line_buffer.write(text)
                    # Parse lines like: "  [  3/150] PageRank  (187 links, queue 455)"
                    for line in text.split('\n'):
                        line = line.strip()
                        if line.startswith('[') and '/' in line and ']' in line:
                            try:
                                bracket_content = line[1:line.index(']')]
                                parts = bracket_content.split('/')
                                fetched = int(parts[0].strip())
                                title_part = line[line.index(']')+1:].strip()
                                title = title_part.split('(')[0].strip() if '(' in title_part else title_part
                                _set_crawl_status(fetched=fetched, current=title)
                            except (ValueError, IndexError):
                                pass
                def flush(self):
                    original_stdout.flush()

            sys.stdout = TeeWriter()
            try:
                result = crawl_and_store(seeds, max_pages, edges_path, db_path)
                _set_crawl_status(state="done", fetched=result["pages"],
                                  current="complete")
            finally:
                sys.stdout = original_stdout

        except Exception as exc:
            _set_crawl_status(state="error", error=str(exc))
        finally:
            _bg_crawl_thread = None
            _bg_crawl_lock.release()

    _bg_crawl_thread = threading.Thread(target=run, daemon=True)
    _bg_crawl_thread.start()
    return True


# ─────────────────────────────────────────────────────────
# Cached index — built lazily, invalidated after a crawl
# ─────────────────────────────────────────────────────────

_index_cache = {
    "engine": None,      # SearchEngine instance
    "scores": None,      # dict page -> score
    "graph": None,       # adjacency-list dict
    "store": None,       # SimplePageStore instance
    "edges_mtime": 0,
    "db_mtime": 0,
}
_index_lock = threading.Lock()


def _invalidate_index_cache():
    with _index_lock:
        _index_cache["engine"] = None
        _index_cache["scores"] = None
        _index_cache["graph"] = None
        _index_cache["store"] = None
        _index_cache["edges_mtime"] = 0
        _index_cache["db_mtime"] = 0


def load_index(edges_path, db_path):
    """Build graph, run PageRank, load page texts, build SearchEngine.

    Caches the result in memory and invalidates when edges.txt/pages.db
    mtime changes.

    Returns:
        dict with keys: engine, scores, graph, store
        or None if the data files don't exist.
    """
    with _index_lock:
        if not os.path.exists(edges_path):
            return None

        edges_mtime = os.path.getmtime(edges_path)
        db_mtime = os.path.getmtime(db_path) if os.path.exists(db_path) else 0

        # Cache hit?
        if (_index_cache["engine"] is not None
                and _index_cache["edges_mtime"] == edges_mtime
                and _index_cache["db_mtime"] == db_mtime):
            return {
                "engine": _index_cache["engine"],
                "scores": _index_cache["scores"],
                "graph": _index_cache["graph"],
                "store": _index_cache["store"],
            }

        # Rebuild
        edges = crawler.read_edges_file(edges_path)
        if not edges:
            return None

        graph = graph_model.build_graph(edges)
        scores, _iters = pagerank_engine.pagerank(graph)

        store = page_store.SimplePageStore(db_path) if os.path.exists(db_path) else None
        engine = None

        if store and store.count() > 0:
            page_texts = {rec["id"]: rec["text"] for rec in store.iter_records()}
            engine = search_engine.SearchEngine(page_texts, scores)

        _index_cache["engine"] = engine
        _index_cache["scores"] = scores
        _index_cache["graph"] = graph
        _index_cache["store"] = store
        _index_cache["edges_mtime"] = edges_mtime
        _index_cache["db_mtime"] = db_mtime

        return {
            "engine": engine,
            "scores": scores,
            "graph": graph,
            "store": store,
        }


def do_search(query, alpha, limit, edges_path, db_path):
    """Run a search using the cached index.

    Returns:
        list of result dicts, or None if not crawled yet.
    """
    idx = load_index(edges_path, db_path)
    if idx is None or idx["engine"] is None:
        return None

    engine = idx["engine"]
    graph = idx["graph"]
    scores = idx["scores"]

    results = engine.search(query, alpha=alpha, limit=limit)

    # Enrich with extra fields the frontend needs.
    enriched = []
    for row in results:
        pid = row["page_id"]
        in_links = []
        for src, targets in graph.items():
            if pid in targets:
                in_links.append(src)
        out_links = graph.get(pid, [])

        enriched.append({
            "page_id": pid,
            "title": pid.replace("_", " "),
            "url": "https://en.wikipedia.org/wiki/" + pid,
            "final": row["final"],
            "relevance": row["relevance"],
            "pagerank": row["pagerank"],
            "cosine": row["relevance"],   # raw cosine IS the relevance score
            "inLinks": in_links,
            "outLinks": out_links,
            "rank": 0,  # filled below
        })

    # Assign global rank by pagerank score
    sorted_scores = pagerank_engine.top_pages(scores, len(scores))
    rank_map = {page: i + 1 for i, (page, _) in enumerate(sorted_scores)}
    for r in enriched:
        r["rank"] = rank_map.get(r["page_id"], 0)

    return enriched


def get_top_pages(n, edges_path, db_path):
    """Return the top N pages by PageRank."""
    idx = load_index(edges_path, db_path)
    if idx is None:
        return None

    top = pagerank_engine.top_pages(idx["scores"], n)
    graph = idx["graph"]
    result = []
    for rank, (page, score) in enumerate(top, start=1):
        in_links = [src for src, targets in graph.items() if page in targets]
        out_links = graph.get(page, [])
        result.append({
            "page_id": page,
            "title": page.replace("_", " "),
            "url": "https://en.wikipedia.org/wiki/" + page,
            "pagerank": score,
            "rank": rank,
            "inLinks": in_links,
            "outLinks": out_links,
        })
    return result


def get_graph_snapshot(max_nodes, edges_path, db_path):
    """Return nodes and links for the graph panel."""
    idx = load_index(edges_path, db_path)
    if idx is None:
        return None

    scores = idx["scores"]
    graph = idx["graph"]

    top = pagerank_engine.top_pages(scores, max_nodes)
    top_ids = {page for page, _ in top}

    nodes = []
    for rank, (page, score) in enumerate(top, start=1):
        in_links = [src for src, targets in graph.items() if page in targets]
        out_links = graph.get(page, [])
        nodes.append({
            "id": page,
            "title": page.replace("_", " "),
            "pagerank": score,
            "rank": rank,
            "inLinks": [l for l in in_links if l in top_ids],
            "outLinks": [l for l in out_links if l in top_ids],
        })

    links = []
    for page, targets in graph.items():
        if page not in top_ids:
            continue
        for target in targets:
            if target in top_ids:
                links.append({"source": page, "target": target})

    return {"nodes": nodes, "links": links}


def get_page_detail(page_id, edges_path, db_path):
    """Return detailed info for a single page."""
    idx = load_index(edges_path, db_path)
    if idx is None:
        return None

    scores = idx["scores"]
    graph = idx["graph"]
    store = idx["store"]

    if page_id not in scores:
        return None

    in_links = [src for src, targets in graph.items() if page_id in targets]
    out_links = graph.get(page_id, [])

    sorted_scores = pagerank_engine.top_pages(scores, len(scores))
    rank = 0
    for i, (page, _) in enumerate(sorted_scores, start=1):
        if page == page_id:
            rank = i
            break

    result = {
        "page_id": page_id,
        "title": page_id.replace("_", " "),
        "url": "https://en.wikipedia.org/wiki/" + page_id,
        "pagerank": scores[page_id],
        "rank": rank,
        "inLinks": in_links,
        "outLinks": out_links,
        "inDegree": len(in_links),
        "outDegree": len(out_links),
    }

    if store:
        record = store.get(page_id)
        if record:
            result["title"] = record["title"]

    return result
