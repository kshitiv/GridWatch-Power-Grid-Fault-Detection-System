"""
GridWatch - Flask Backend
Serves the HTML frontend and exposes REST API endpoints.
"""

import os
import json
import tempfile
from flask import Flask, request, jsonify, send_from_directory

from graph_loader      import load_graph
from mst_algorithms    import prims, kruskals, compare_and_recommend
from memory_allocator  import simulate_all_strategies, recommend_strategy

# Serve static files from the workspace root so index.html, style.css and app.js
# are available at '/'.
app = Flask(__name__, static_folder='.', static_url_path='')

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR  = os.path.join(BASE_DIR, "samples")


# ─────────────────────────────────────────────
#  SERVE FRONTEND
# ─────────────────────────────────────────────
@app.route('/')
def home():
    return app.send_static_file('index.html')


# ─────────────────────────────────────────────
#  UPLOAD & RUN MST
# ─────────────────────────────────────────────
@app.route("/api/mst", methods=["POST"])
def run_mst():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f    = request.files["file"]
    ext  = os.path.splitext(f.filename)[1].lower()

    if ext not in (".csv", ".json"):
        return jsonify({"error": "Only .csv or .json files are supported"}), 400

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False, mode="wb") as tmp:
        tmp.write(f.read())
        tmp_path = tmp.name

    try:
        nodes, edges = load_graph(tmp_path)
    except Exception as e:
        os.unlink(tmp_path)
        return jsonify({"error": f"Graph parse error: {str(e)}"}), 400
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not nodes or not edges:
        return jsonify({"error": "Graph is empty"}), 400

    # Run algorithms
    p_edges, p_cost, p_steps, p_ms = prims(nodes, edges)
    k_edges, k_cost, k_steps, k_ms = kruskals(nodes, edges)
    report = compare_and_recommend(nodes, edges, p_cost, p_ms, k_cost, k_ms)

    return jsonify({
        "nodes":   nodes,
        "edges":   [{"from": u, "to": v, "weight": w} for w, u, v in edges],
        "prims": {
            "mst_edges":  p_edges,
            "total_cost": p_cost,
            "steps":      p_steps,
            "time_ms":    p_ms
        },
        "kruskals": {
            "mst_edges":  k_edges,
            "total_cost": k_cost,
            "steps":      k_steps,
            "time_ms":    k_ms
        },
        "report": report
    })


# ─────────────────────────────────────────────
#  MEMORY SIMULATION
# ─────────────────────────────────────────────
@app.route("/api/memory", methods=["POST"])
def run_memory():
    data = request.get_json()

    total_memory = data.get("total_memory", 512)
    requests_raw = data.get("requests", [])

    if not requests_raw:
        return jsonify({"error": "No memory requests provided"}), 400

    if total_memory <= 0 or total_memory > 65536:
        return jsonify({"error": "total_memory must be between 1 and 65536 KB"}), 400

    results    = simulate_all_strategies(total_memory, requests_raw)
    rec        = recommend_strategy(results)

    return jsonify({
        "total_memory": total_memory,
        "requests":     requests_raw,
        "results":      results,
        "recommendation": rec
    })


# ─────────────────────────────────────────────
#  LOAD SAMPLE FILES
# ─────────────────────────────────────────────
@app.route("/api/sample/<fmt>")
def get_sample(fmt):
    """Return contents of a sample graph file."""
    fname = f"sample_graph.{fmt}"
    path  = os.path.join(SAMPLE_DIR, fname)
    if not os.path.exists(path):
        return jsonify({"error": "Sample not found"}), 404
    with open(path) as f:
        return f.read(), 200, {"Content-Type": "text/plain"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
