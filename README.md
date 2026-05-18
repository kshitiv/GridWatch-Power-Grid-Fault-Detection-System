# GridWatch — Power Grid Fault Detection System

A smart infrastructure tool for:
- **MST (Minimum Spanning Tree)** using Prim's and Kruskal's algorithms with full step-by-step tracing
- **Memory Allocation Simulation** using First Fit, Best Fit, and Worst Fit strategies
- **Recommendation Report** comparing both MST algorithms and all three memory strategies

---

## Project Structure

```
gridwatch/
├── app.py               ← Flask web server + API routes
├── graph_loader.py      ← CSV and JSON graph loader
├── mst_algorithms.py    ← Prim's, Kruskal's, comparison report
├── memory_allocator.py  ← First Fit, Best Fit, Worst Fit simulation
├── index.html           ← Full web frontend (single file)
├── requirements.txt     ← Python dependencies
└── samples/
    ├── sample_graph.csv ← 9-node sample city graph (CSV)
    └── sample_graph.json← 9-node sample city graph (JSON)
```

---

## Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the server
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

---

## Using the Application

### Tab 1 — MST Analysis (DAA)
1. Download a sample file (`sample_graph.csv` or `sample_graph.json`) from the UI
2. Or create your own graph file (see formats below)
3. Upload the file and click **▶ ANALYSE GRAPH**
4. View step-by-step traces for both Prim's and Kruskal's
5. Toggle the canvas to visualise Prim's MST / Kruskal's MST / All edges
6. See the comparison: execution time, graph density, MST cost match

### Tab 2 — Memory Allocator (OS)
1. Set total memory size (KB)
2. Add ALLOC and FREE requests for neighbourhood routing tables
3. Click **⬇ LOAD DEFAULTS** to use a preset sequence
4. Click **▶ SIMULATE ALL STRATEGIES**
5. Compare First Fit, Best Fit, Worst Fit:
   - Visual memory maps
   - Per-strategy allocation logs
   - Fragmentation statistics table

### Tab 3 — Report
- Auto-generated recommendation report after running both simulations
- Recommends: best MST algorithm for the graph type and best memory strategy

---

## Graph File Formats

### CSV
```csv
source,destination,weight
A,B,4
A,H,8
B,C,8
...
```

### JSON
```json
{
  "nodes": ["A", "B", "C"],
  "edges": [
    {"source": "A", "destination": "B", "weight": 4},
    {"source": "B", "destination": "C", "weight": 8}
  ]
}
```

---

## Algorithms Implemented

| Algorithm     | Complexity         | Approach               |
|---------------|--------------------|------------------------|
| Prim's        | O((V+E) log V)     | Min-heap greedy        |
| Kruskal's     | O(E log E)         | Union-Find + sort      |

| Strategy      | Best For           | Fragmentation Impact   |
|---------------|--------------------|------------------------|
| First Fit     | Speed              | Low–medium             |
| Best Fit      | Space efficiency   | Can create tiny holes  |
| Worst Fit     | Large allocations  | Reduces tiny fragments |
