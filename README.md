# Implementing PageRank Algorithm — PageRank Explorer

**Group 81, SPIT TE Sem V Mini Project I**  
An end-to-end implementation of Google's PageRank algorithm, link graph analysis, and TF-IDF fused search engine, featuring a Python standard library backend and an interactive React web interface.

---

## Architecture Overview

```
Seed Articles (Wikipedia) ──► Raw SSL/Socket Crawler ──► edges.txt (Adjacency List)
                                                       ──► pages.db (SimplePageStore)
                                                                 │
                                                                 ▼
                                                       Power Iteration PageRank
                                                                 │
                                                                 ▼
      React Frontend (Vite/TS/Tailwind) ◄── HTTP API ◄── TF-IDF + PageRank Fusion
      - Crawl Panel (Live Progress)      (server.py)
      - Search Panel (Alpha Slider)
      - D3 Force-Directed Graph
      - Top Authority Pages
```

---

## Crawl-Then-Search Workflow

The application behaves strictly like the CLI reference implementation:

1. **Crawl**: Fetch web pages starting from seed topics (e.g., `PageRank,Search_engine`). Builds the link graph in `edges.txt` and page contents in `pages.db`.
2. **Rank**: Calculates PageRank authority scores via power iteration until numerical convergence ($\sum PR = 1.0$).
3. **Search**: Computes TF-IDF vector cosine relevance and combines it with PageRank using a tunable blend factor ($\alpha$):
   $$\text{final\_score} = \alpha \cdot \text{relevance} + (1 - \alpha) \cdot \text{PageRank}$$
4. **Log**: Records every executed query to `searches.json` (NDJSON format).

If no crawled data exists yet, search is safely gated until a crawl is performed.

---

## How to Run

### 1. Prerequisites
- Python 3.9+ (Standard Library only — no external pip packages required)
- Node.js 18+ and npm

### 2. Start the Backend API Server
In the project root directory:
```bash
python server.py
```
*Listens on `http://127.0.0.1:5000` using standard library `http.server.ThreadingHTTPServer`.*

### 3. Start the Frontend Development Server
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Vite dev server will start at `http://localhost:5173` and automatically proxies `/api` requests to port 5000.*

### 4. Running via the Command Line Interface (CLI)
You can also run all pipeline stages directly from the terminal:
```bash
# 1. Crawl Wikipedia
python cli.py crawl --seeds "PageRank,Search_engine" --max-pages 150

# 2. View top pages by PageRank
python cli.py rank --top 10

# 3. Search with alpha blend
python cli.py search "pagerank algorithm" --alpha 0.5
```

---

## HTTP REST API Reference

All endpoints return JSON responses with CORS configured for `http://localhost:5173`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Returns system status, cache metrics, and current crawl state (`idle`, `running`, `done`, `error`). |
| `POST` | `/api/crawl` | Initiates background crawl. Body: `{ "seeds": string[] \| string, "max_pages": int, "force": bool }`. Returns HTTP 202. |
| `GET` | `/api/search?q=...&alpha=0.5&limit=10` | Fused search combining TF-IDF relevance and PageRank authority scores. Returns HTTP 409 if not crawled. |
| `GET` | `/api/top?n=10` | Top $N$ pages ranked purely by PageRank score. |
| `GET` | `/api/graph?max_nodes=30` | Nodes and directed edges for the top $N$ pages for D3 network visualization. |
| `GET` | `/api/page/<id>` | Detailed metadata, in-links, out-links, and in/out degrees for a single page. |
| `POST` | `/api/search-log` | Appends search telemetry to `searches.json`. |
| `GET` | `/api/history` | Retrieves logged search queries. |

---

## Running the Automated Test Suite

### Python Test Suite (90 tests)
```bash
python test_graph_model.py
python tests/test_data_modules.py
python tests/test_math_modules.py
python tests/test_search_stats_modules.py
python tests/test_end_to_end.py
python -m unittest tests/test_pipeline.py
python -m unittest tests/test_server.py
```

### Frontend Typecheck & Build
```bash
cd frontend
npm run build
```
