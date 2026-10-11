# ═══════════════════════════════════════════════════════════════════
#  server.py — File-based storage bridge for PageRank Explorer
#
#  This is a lightweight Flask dev server that acts as a bridge
#  between the React frontend and the project's flat files
#  (edges.txt, searches.json). It is NOT a production server.
#
#  Requirements:
#      pip install flask flask-cors
#
#  Run:
#      python server.py
#
#  Endpoints:
#      POST /api/search   → append search event to searches.json
#      GET  /api/history   → return all saved searches as JSON array
#      GET  /api/edges     → parse edges.txt, return { edges: [...] }
# ═══════════════════════════════════════════════════════════════════

import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173'])

# ── File paths (relative to this script's directory) ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEARCHES_FILE = os.path.join(BASE_DIR, 'searches.json')
EDGES_FILE = os.path.join(BASE_DIR, 'edges.txt')


@app.route('/api/search', methods=['POST'])
def save_search():
    """Append a JSON search event as one line to searches.json (NDJSON)."""
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'Empty body'}), 400

    with open(SEARCHES_FILE, 'a', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False) + '\n')

    return jsonify({'status': 'ok'}), 201


@app.route('/api/history', methods=['GET'])
def get_history():
    """Read searches.json (NDJSON) and return all entries as a JSON array."""
    if not os.path.exists(SEARCHES_FILE):
        return jsonify([])

    entries = []
    with open(SEARCHES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue  # skip malformed lines

    return jsonify(entries)


@app.route('/api/edges', methods=['GET'])
def get_edges():
    """Parse edges.txt (tab-separated source→target) and return as JSON."""
    if not os.path.exists(EDGES_FILE):
        return jsonify({'edges': []})

    edges = []
    with open(EDGES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) == 2:
                edges.append({'source': parts[0], 'target': parts[1]})

    return jsonify({'edges': edges})


if __name__ == '__main__':
    print(f'[PageRank Bridge] searches → {SEARCHES_FILE}')
    print(f'[PageRank Bridge] edges    → {EDGES_FILE}')
    app.run(host='127.0.0.1', port=5000, debug=True)
