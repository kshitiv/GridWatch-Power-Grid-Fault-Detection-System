"""
GridWatch - Graph Loader
Supports loading neighbourhood graphs from CSV and JSON files.
"""

import csv
import json
import os


def load_graph_from_csv(filepath):
    """
    Load graph from CSV file.
    Expected format: source,destination,weight
    Returns: (nodes set, edges list of (weight, u, v))
    """
    edges = []
    nodes = set()
    
    with open(filepath, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            u = row['source'].strip()
            v = row['destination'].strip()
            w = float(row['weight'].strip())
            edges.append((w, u, v))
            nodes.add(u)
            nodes.add(v)
    
    return sorted(nodes), edges


def load_graph_from_json(filepath):
    """
    Load graph from JSON file.
    Expected format:
    {
        "nodes": ["A", "B", ...],
        "edges": [{"source": "A", "destination": "B", "weight": 4}, ...]
    }
    Returns: (nodes list, edges list of (weight, u, v))
    """
    with open(filepath) as f:
        data = json.load(f)
    
    nodes = data.get("nodes", [])
    raw_edges = data.get("edges", [])
    edges = []
    node_set = set(nodes)
    
    for e in raw_edges:
        u = e["source"]
        v = e["destination"]
        w = float(e["weight"])
        edges.append((w, u, v))
        node_set.add(u)
        node_set.add(v)
    
    return sorted(node_set), edges


def load_graph(filepath):
    """Auto-detect format and load graph."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".csv":
        return load_graph_from_csv(filepath)
    elif ext == ".json":
        return load_graph_from_json(filepath)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Use .csv or .json")


def build_adjacency(nodes, edges):
    """Build adjacency dict from edge list."""
    adj = {n: [] for n in nodes}
    for w, u, v in edges:
        adj[u].append((w, v))
        adj[v].append((w, u))
    return adj
