"""
===============================================================================
 pipeline.py  --  Shared service layer for CLI and Web Server
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Grasit Gandhi (2024300059)
 CHECKPOINT   : 17 (Shared pipeline service layer)
 SRS MAPPING  : FR1.1-FR6.4, NFR4

 PURPOSE
 -------
 Single source of truth for the crawl, rank, and search pipeline. Both cli.py
 and server.py call this service layer so that crawling, indexing, ranking,
 and querying logic is implemented exactly once.

 DEPENDENCIES
 ------------
 Python standard library only: os, threading, time.
 Project modules: crawler, graph_model, page_store, pagerank_engine, search_engine.
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


class NotCrawledError(Exception):
    """Raised when an operation requires crawled data that is not present."""
    pass


# In-memory cache for the indexed graph and search engine
_index_lock = threading.Lock()
_cached_index = None


def invalidate_cache():
    """Invalidate the cached in-memory search index and graph."""
    global _cached_index
    with _index_lock:
        _cached_index = None


def crawl_and_store(seeds,
                    max_pages,
                    edges_path=crawler.EDGES_FILE,
                    db_path=page_store.DEFAULT_DB_PATH,
                    progress_cb=None,
                    verbose=False):
    """Crawl web pages from seeds, then atomically store edges and page content.

    Args:
        seeds:       list of seed article titles or comma-separated string.
        max_pages:   maximum number of pages to fetch.
        edges_path:  path to save the edge list (default edges.txt).
        db_path:     path to save page records (default pages.db).
        progress_cb: optional progress callback receiving progress dicts.
        verbose:     whether to print crawler stdout lines.

    Returns:
        dict: summary with 'pages', 'edges', and 'dangling' counts.
    """
    if isinstance(seeds, str):
        import re
        seed_titles = [s.strip() for s in re.split(r"[,;\n\r]+", seeds) if s.strip()]
    else:
        seed_titles = [str(s).strip() for s in seeds if str(s).strip()]

    if not seed_titles:
        return {"pages": 0, "edges": 0, "dangling": 0}

    edges, pages = crawler.crawl(
        seed_titles,
        max_pages,
        verbose=verbose,
        progress_cb=progress_cb,
    )

    if not pages:
        return {"pages": 0, "edges": 0, "dangling": 0}

    # 1. Atomic write for edges file via temporary file
    temp_edges = edges_path + ".tmp"
    crawler.write_edges_file(edges, temp_edges)
    if os.path.exists(temp_edges):
        os.replace(temp_edges, edges_path)

    # 2. Atomic write for pages.db via temporary file
    graph = graph_model.build_graph(edges)
    temp_db = db_path + ".tmp"
    store = page_store.SimplePageStore(temp_db, reset=True)
    for title, text in pages.items():
        store.insert(
            title,
            title.replace("_", " "),
            graph_model.out_degree(graph, title),
            text,
        )
    if os.path.exists(temp_db):
        os.replace(temp_db, db_path)

    dangling = graph_model.find_dangling_pages(graph)

    # Invalidate cached index so new data is picked up immediately
    invalidate_cache()

    return {
        "pages": len(pages),
        "edges": len(edges),
        "dangling": len(dangling),
    }


def get_pipeline_status(edges_path=crawler.EDGES_FILE, db_path=page_store.DEFAULT_DB_PATH):
    """Return status of crawled data files on disk."""
    has_edges = os.path.exists(edges_path) and os.path.getsize(edges_path) > 0
    has_db = os.path.exists(db_path) and os.path.getsize(db_path) > 0

    if not (has_edges and has_db):
        return {
            "crawled": False,
            "edge_count": 0,
            "page_count": 0,
        }

    status = crawler.edges_cache_status(edges_path)
    store = page_store.SimplePageStore(db_path)
    page_count = store.count()

    is_crawled = status["exists"] and status["edge_count"] > 0 and page_count > 0
    return {
        "crawled": is_crawled,
        "edge_count": status["edge_count"],
        "page_count": page_count,
    }


def load_index(edges_path=crawler.EDGES_FILE, db_path=page_store.DEFAULT_DB_PATH):
    """Load the graph, compute PageRank, and initialize SearchEngine.

    Caches the loaded index in memory and invalidates if mtime on edges.txt or
    pages.db changes.

    Returns:
        dict containing graph, scores, store, engine, incoming index, and ranks.
        Returns None if data files are missing or hold no usable data.
    """
    global _cached_index

    if not (os.path.exists(edges_path) and os.path.exists(db_path)):
        return None

    try:
        mtime_edges = os.path.getmtime(edges_path)
        mtime_db = os.path.getmtime(db_path)
    except OSError:
        return None

    with _index_lock:
        if _cached_index is not None:
            cached_mtimes = _cached_index.get("mtimes")
            if (
                cached_mtimes == (mtime_edges, mtime_db)
                and _cached_index.get("edges_path") == edges_path
                and _cached_index.get("db_path") == db_path
            ):
                return _cached_index

        edges = crawler.read_edges_file(edges_path)
        if not edges:
            return None

        graph = graph_model.build_graph(edges)
        scores, _ = pagerank_engine.pagerank(graph)

        store = page_store.SimplePageStore(db_path)
        page_texts = {record["id"]: record["text"] for record in store.iter_records()}
        if not page_texts:
            return None

        engine = search_engine.SearchEngine(page_texts, scores)

        # Build reverse index: page -> list of pages linking to it
        incoming = {page: [] for page in graph}
        for source, targets in graph.items():
            for target in targets:
                if target in incoming:
                    incoming[target].append(source)

        # Rank pages by PageRank descending
        sorted_by_pr = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
        pr_ranks = {page_id: rank for rank, (page_id, _) in enumerate(sorted_by_pr, start=1)}

        _cached_index = {
            "graph": graph,
            "scores": scores,
            "store": store,
            "page_texts": page_texts,
            "engine": engine,
            "incoming": incoming,
            "pr_ranks": pr_ranks,
            "edges_path": edges_path,
            "db_path": db_path,
            "mtimes": (mtime_edges, mtime_db),
        }
        return _cached_index


def search(query,
           alpha=search_engine.DEFAULT_ALPHA,
           limit=10,
           edges_path=crawler.EDGES_FILE,
           db_path=page_store.DEFAULT_DB_PATH):
    """Search crawled pages by fusing TF-IDF cosine relevance with PageRank.

    Returns:
        list of dicts matching the search result contract with page details.
    """
    index = load_index(edges_path, db_path)
    if index is None:
        raise NotCrawledError("not_crawled")

    engine = index["engine"]
    raw_results = engine.search(query, alpha=alpha, limit=limit)

    results = []
    for row in raw_results:
        page_id = row["page_id"]
        in_links = index["incoming"].get(page_id, [])
        out_links = index["graph"].get(page_id, [])
        rank = index["pr_ranks"].get(page_id, 0)
        title = page_id.replace("_", " ")
        url = "https://en.wikipedia.org/wiki/{0}".format(page_id)

        results.append({
            "page_id": page_id,
            "title": title,
            "url": url,
            "final": round(row["final"], 6),
            "relevance": round(row["relevance"], 6),
            "pagerank": round(row["pagerank"], 6),
            "raw_cosine": round(row["relevance"], 6),
            "inLinks": in_links,
            "outLinks": out_links,
            "rank": rank,
        })

    return results


def top_pages(n=10,
              edges_path=crawler.EDGES_FILE,
              db_path=page_store.DEFAULT_DB_PATH):
    """Retrieve the top n pages sorted by PageRank."""
    index = load_index(edges_path, db_path)
    if index is None:
        raise NotCrawledError("not_crawled")

    ranked = pagerank_engine.top_pages(index["scores"], count=n)
    results = []
    for position, (page_id, score) in enumerate(ranked, start=1):
        in_links = index["incoming"].get(page_id, [])
        out_links = index["graph"].get(page_id, [])
        results.append({
            "rank": position,
            "id": page_id,
            "title": page_id.replace("_", " "),
            "url": "https://en.wikipedia.org/wiki/{0}".format(page_id),
            "pagerank": round(score, 6),
            "inLinks": in_links,
            "outLinks": out_links,
        })
    return results


def graph_snapshot(max_nodes=30,
                   edges_path=crawler.EDGES_FILE,
                   db_path=page_store.DEFAULT_DB_PATH):
    """Return nodes and links for the top max_nodes by PageRank."""
    index = load_index(edges_path, db_path)
    if index is None:
        raise NotCrawledError("not_crawled")

    ranked = pagerank_engine.top_pages(index["scores"], count=max_nodes)
    top_ids = {page_id for page_id, _ in ranked}

    nodes = []
    for rank, (page_id, score) in enumerate(ranked, start=1):
        in_links = index["incoming"].get(page_id, [])
        out_links = index["graph"].get(page_id, [])
        nodes.append({
            "id": page_id,
            "title": page_id.replace("_", " "),
            "url": "https://en.wikipedia.org/wiki/{0}".format(page_id),
            "pagerank": round(score, 6),
            "inDegree": len(in_links),
            "outDegree": len(out_links),
            "inLinks": in_links,
            "outLinks": out_links,
            "rank": rank,
        })

    links = []
    for source in top_ids:
        for target in index["graph"].get(source, []):
            if target in top_ids:
                links.append({"source": source, "target": target})

    return {
        "nodes": nodes,
        "links": links,
        "total_pages": len(index["scores"]),
    }


def page_detail(page_id,
                edges_path=crawler.EDGES_FILE,
                db_path=page_store.DEFAULT_DB_PATH):
    """Retrieve detailed link and ranking metadata for a specific page."""
    index = load_index(edges_path, db_path)
    if index is None:
        raise NotCrawledError("not_crawled")

    if page_id not in index["scores"]:
        return None

    score = index["scores"][page_id]
    rank = index["pr_ranks"].get(page_id, 0)
    in_links = index["incoming"].get(page_id, [])
    out_links = index["graph"].get(page_id, [])

    # Order in/out links by the neighbor's PageRank score descending
    sorted_in = sorted(in_links, key=lambda p: -index["scores"].get(p, 0))
    sorted_out = sorted(out_links, key=lambda p: -index["scores"].get(p, 0))

    record = index["store"].get(page_id)
    text = record["text"] if record else ""
    title = record["title"] if record else page_id.replace("_", " ")

    return {
        "id": page_id,
        "title": title,
        "url": "https://en.wikipedia.org/wiki/{0}".format(page_id),
        "pagerank": round(score, 6),
        "rank": rank,
        "inDegree": len(in_links),
        "outDegree": len(out_links),
        "inLinks": sorted_in,
        "outLinks": sorted_out,
        "text": text,
    }
