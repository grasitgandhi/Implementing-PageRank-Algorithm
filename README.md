# Implementing PageRank Algorithm — Group 81

A complete search engine and link analysis system built from scratch without external web or database frameworks, featuring a Python standard library backend and a React/TypeScript/Vite/Tailwind exploratory frontend.

---

## 🚀 Quick Start

### 1. Start the Backend Server
The backend runs on Python's standard library `http.server.ThreadingHTTPServer` on port **5000** (no Flask or external dependencies required):

```bash
python server.py
```

### 2. Start the Frontend Application
In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`. Vite automatically proxies `/api` requests to `http://127.0.0.1:5000`.

To build the production bundle:
```bash
cd frontend
npm run build
```

---

## 🔄 The Crawl-Then-Search Pipeline

The system enforces a file-based pipeline where searching operates on real crawled data:

1. **Crawl**: A breadth-first web crawler starts from seed Wikipedia articles (e.g. `PageRank,Search_engine`), adheres to polite crawl delays (1.0 s), extracts hyperlinks and clean visible text, and atomically writes `edges.txt` and `pages.db`.
2. **Rank**: Damped power iteration computes stationary PageRank scores over the directed adjacency-list graph, handling dangling rank-sink nodes without leaking probability mass.
3. **Search**: Combines inverted-index TF-IDF cosine relevance with PageRank authority using the blend formula:
   $$\text{final} = \alpha \times \text{relevance} + (1 - \alpha) \times \text{pagerank}$$
   - $\alpha = 1.0$: pure keyword relevance
   - $\alpha = 0.0$: pure PageRank link authority
   - $\alpha = 0.5$: balanced score fusion

---

## 💻 Command Line Interface (CLI)

The CLI provides the reference behavior:

```bash
# 1. Fetch pages and construct data files
python cli.py crawl --seeds "PageRank,Search_engine" --max-pages 150

# 2. Compute PageRank and display top pages
python cli.py rank --top 10

# 3. Search crawled pages with score fusion
python cli.py search "pagerank algorithm" --alpha 0.5
```

---

## 🌐 REST API Endpoints

All responses are formatted in JSON:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Returns pipeline state (`crawled: bool`, `edge_count`, `page_count`) and background crawl progress (`state`, `fetched`, `max_pages`, `current`, `error`). |
| `POST` | `/api/crawl` | Initiates a background crawl thread. Body: `{"seeds": string[] \| string, "max_pages": int, "force": bool}`. Returns `202 Accepted` or `409 Conflict`. |
| `GET` | `/api/search` | Search query endpoint with `?q=...&alpha=0.5&limit=10`. Returns ranked results with relevance, PageRank, final score, cosine, inLinks, outLinks, and rank. Returns `409` if not crawled. |
| `GET` | `/api/top` | Top $N$ pages ranked by PageRank (`?n=10`). |
| `GET` | `/api/graph` | Subgraph snapshot (`?max_nodes=30`) returning nodes and directed links for D3 force visualization. |
| `GET` | `/api/page/<id>` | Full record details for an individual page (in-links, out-links, rank, raw text). |
| `GET` | `/api/history` | Retrieves logged search queries from `searches.json` (NDJSON). |
| `POST` | `/api/search-log` | Appends a search query event to `searches.json`. |

---

## 🧪 Testing

Run the Python test suites from the project root:

```bash
python test_graph_model.py
python tests/test_data_modules.py
python tests/test_math_modules.py
python tests/test_search_stats_modules.py
python tests/test_end_to_end.py
python tests/test_pipeline.py
```

Run TypeScript and bundle verification:
```bash
cd frontend
npm run build
```
