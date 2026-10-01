# Checkpoint 7–9 Build Guide — Group 81

Coding starts at **Checkpoint 7 (Days 29–33)**. Checkpoints 1–6 are Phase 1 and
Phase 2 documentation only — the shared constraint block is first attached to a
prompt at Checkpoint 7, which opens Phase 3 (Module Coding).

This guide maps every file in the repository to the person who owns it and the
checkpoint it belongs to, so the git history shows steady dated progress rather
than one dump.

---

## What each person owns

| File | Owner | Checkpoints |
|---|---|---|
| `graph_model.py` | Grasit Gandhi | 7 |
| `pagerank_engine.py` | Grasit Gandhi | 8, 9 |
| `test_graph_model.py` | Grasit Gandhi | 8 |
| `crawler.py` | Aaditya Doshi | 7, 8, 9 |
| `page_store.py` | Rudraksh Shah | 7, 8 |
| `search_engine.py` | Rudraksh Shah | 9 |
| `.gitignore` | Rudraksh Shah | 1 (updated at 8) |

---

## Who commits what

No file is co-owned. One person touches a file for the whole project; three
files simply get committed more than once by that same person as they grow.

| File | Owner | Committed at |
|---|---|---|
| `graph_model.py` | Grasit | CP7 |
| `pagerank_engine.py` | Grasit | CP8, CP9 |
| `test_graph_model.py` | Grasit | CP8 |
| `crawler.py` | Aaditya | CP7, CP8, CP9 |
| `edges.txt` | Aaditya | CP9 (regenerated at CP12) |
| `page_store.py` | Rudraksh | CP7, CP8 |
| `search_engine.py` | Rudraksh | CP9 |
| `.gitignore` | Rudraksh | CP1 |

Never `git add .` — it sweeps up a teammate's half-finished file and puts their
work under your name. Always name your own files explicitly, as below.

---

## Commit plan

### Checkpoint 7 — Days 29–33

**Grasit** — `graph_model.py`, whole file as delivered.
```
git add graph_model.py
git commit -m "feat: add graph_model.py adjacency list"
git commit -m "test: add dangling page detection"
```

**Aaditya** — `crawler.py`: the header, the constants, `build_http_get_request`,
`open_connection`, `receive_full_response`, `parse_http_response`, `fetch`, and
DEMO 1. Trim to the plain-HTTP version:
- in `open_connection`, delete everything from the `# ---- Checkpoint 8: TLS` comment down
- delete `decode_chunked_body` and `split_url`
- in `fetch`, delete the `3xx redirect` block and the `un-chunk if needed` block
- delete everything from `extract_wiki_links` onward, and DEMO 2 / DEMO 3
```
git add crawler.py
git commit -m "feat: add raw socket HTTP GET (plain HTTP)"
```

**Rudraksh** — `page_store.py`: header, constants, `_sanitise_field`,
`SimplePageStore.__init__`, `insert`, and DEMO 1. Trim to storage only:
- in `__init__`, delete the `self._build_index()` call
- delete `_build_index`, `get`, `linear_scan_get`, `_parse_record`, `count`, `iter_records`
- in DEMO 1, delete the "in-memory index" print and both `get()` calls
- delete DEMO 2
```
git add page_store.py .gitignore
git commit -m "feat: add page_store.py append-only insert"
```

### Checkpoint 8 — Days 34–38

**Grasit** — `pagerank_engine.py`: header, `DEFAULT_TOLERANCE`,
`DEFAULT_MAX_ITERATIONS`, `_initial_scores`, `_l1_distance`,
`power_iteration_undamped`, `top_pages`, `print_scores`, DEMO 1. Leave out
`DEFAULT_DAMPING`, `pagerank`, DEMO 2 and DEMO 3. Then all of
`test_graph_model.py`.
```
git add pagerank_engine.py
git commit -m "feat: add undamped power iteration"
git add test_graph_model.py
git commit -m "test: add graph_model dangling page test"
```

**Aaditya** — restore the TLS block in `open_connection`, add
`decode_chunked_body`, `split_url`, the redirect and un-chunk blocks inside
`fetch`, and DEMO 2.
```
git add crawler.py
git commit -m "feat: add TLS wrapping to crawler"
git commit -m "fix: handle chunked transfer encoding"
```

**Rudraksh** — restore the `_build_index()` call in `__init__`, add
`_build_index`, `get`, `linear_scan_get`, `_parse_record`, `count`,
`iter_records`, the index/`get` lines in DEMO 1, and DEMO 2.
```
git add page_store.py
git commit -m "feat: add page_store indexing and byte-offset get"
git commit -m "test: add indexed vs linear scan benchmark"
```

### Checkpoint 9 — Days 39–43

**Grasit** — add `DEFAULT_DAMPING`, `pagerank`, DEMO 2 and DEMO 3.
```
git add pagerank_engine.py
git commit -m "feat: add damping factor and dangling score redistribution"
git commit -m "test: verify sum of scores equals 1.0"
```

**Aaditya** — add `WIKI_LINK_PATTERN` and the other CP9 constants,
`extract_wiki_links`, `extract_visible_text`, `crawl`, `write_edges_file`,
`read_edges_file`, DEMO 3. Run the demo to produce `edges.txt` and commit it too.
```
git add crawler.py edges.txt
git commit -m "feat: add breadth-first crawl queue and edges.txt writer"
```

**Rudraksh** — `search_engine.py`, whole file as delivered.
```
git add search_engine.py
git commit -m "feat: add TF-IDF term frequency calculation"
```

### If you would rather not trim

Trimming exists only so a CP7 commit does not contain CP9 code. If the three of
you decide that is more trouble than it is worth, commit each file whole at the
checkpoint where it is first introduced, then make a small real edit at each
later checkpoint. What matters for the final checklist is that
`git log --oneline --graph --all` shows steady dated commits from all three
people, not one burst.

---

## Running everything

```bash
python graph_model.py
python test_graph_model.py
python pagerank_engine.py
python page_store.py
python search_engine.py
python crawler.py
```

Only `crawler.py` needs internet. Every other module runs offline.

Full pipeline check, once `edges.txt` exists:

```bash
python -c "import crawler, graph_model, pagerank_engine; g = graph_model.build_graph(crawler.read_edges_file()); s, i = pagerank_engine.pagerank(g); print('converged in', i, 'iterations'); pagerank_engine.print_scores(s)"
```

---

## Verified results on this build

Values below came from an actual run, not from the design document.

**`graph_model.py` / `test_graph_model.py`** — 7 tests, all pass. Example graph:
5 pages, 7 edges, `E` correctly detected as the only dead end.

**`pagerank_engine.py`** — damped PageRank on the 5-page example converges in
**26 iterations** at d = 0.85, tolerance 1e-8, scores summing to exactly
1.000000. The leak demo shows the undamped total decaying 0.667 → 0.500 → 0.333
→ 0.167 → 0.031 → 0.00098 → 0.00000095 while the damped total holds at
1.00000000 throughout. Those two columns are the numbers to put in the report.

**`page_store.py`** — indexed `get()` against linear scan, 200 random lookups:

| records | file size | indexed | linear | speedup |
|---|---|---|---|---|
| 1,200 | 298 KB | 0.048 ms | 0.093 ms | 1.9× |
| 3,000 | 754 KB | 0.058 ms | 0.210 ms | 3.6× |
| 6,000 | 1,514 KB | 0.071 ms | 0.299 ms | 4.2× |

Read the columns downwards: the indexed cost barely moves while the store grows
five-fold, and the linear cost grows with the file. Be ready for the viva
question about why the indexed column is not flat at zero — `get()` opens the
file on each call, and that fixed per-lookup cost sets the floor. It is a
constant, so the O(1) claim holds.

**`crawler.py`** — a live 12-page crawl from seeds `PageRank` and
`Search_engine` found 4,912 raw links, of which **41** connect two crawled pages
and became graph edges. Running PageRank on that real `edges.txt` converges in
13 iterations with `World_Wide_Web`, `Google_Search` and `PageRank` on top.

**`search_engine.py`** — hand-check passes: `pagerank` occurs 2 times in a
9-token document, and `compute_tf()` returns 2/9 = 0.2222.

---

## Two things to fix before Checkpoint 12's real crawl

1. **Crawl size.** FR1.7 requires 100–300 pages. The committed `edges.txt` is a
   12-page demo crawl. Checkpoint 12 is where Aaditya runs
   `crawl(seeds, max_pages=150)` for real and commits that file. Budget 5–10
   minutes: each page costs the 1-second politeness delay plus however long the
   fetch itself takes, and Wikipedia articles are 300–600 KB. Run it once, well
   before the deadline, not on demo day.

2. **Edge density.** 12 pages produced only 41 internal edges because BFS spends
   its budget going outward. At 150 pages the graph fills in considerably, but
   if it still looks sparse, use 4–5 seeds from one topic (`PageRank`,
   `Search_engine`, `Google_Search`, `Web_crawler`, `Information_retrieval`)
   rather than 2, so the crawl stays inside one neighbourhood.

---

## Two bugs found while testing, worth mentioning in the viva

Both were caught by running the code, not by reading it.

1. **Wikipedia serves absolute hrefs.** The link regex originally matched only
   `href="/wiki/Title"` and found 44 links on a page that contained 455 — the
   rest were written as `href="https://en.wikipedia.org/wiki/Title"`. The
   pattern now accepts both forms.

2. **Language editions leaked into the graph.** The first fix used a wildcard
   host, which then matched `ar.wikipedia.org`, `ja.wikipedia.org` and every
   other sidebar language link, adding ~15 percent-encoded translations of the
   same article as separate nodes. The host is now pinned to `en.wikipedia.org`.

Self-links are also filtered, because a page voting for itself is the simplest
possible way to fake authority.

---

## Constraint compliance

No PyPI packages. Standard library imports used, against the agreed allowance:

| Module | Imports | Allowed? |
|---|---|---|
| `graph_model.py` | none | yes |
| `pagerank_engine.py` | `graph_model` | yes (our own) |
| `crawler.py` | `os`, `re`, `socket`, `ssl`, `time` | yes |
| `page_store.py` | `os`, `random`, `time` | yes |
| `search_engine.py` | `re`, `collections.Counter` | yes |
| `test_graph_model.py` | `graph_model` | yes (our own) |

`collections.deque` was **not** used for the BFS queue, since the allowance
covers only `collections.Counter`. `crawl()` uses a plain list with an integer
read head, which gives the same O(1) dequeue — see the comment in `crawl()`.
