"""
GridWatch - MST Algorithms
Implements Prim's and Kruskal's algorithms with full step-by-step tracing.
"""

import heapq
import time


# ─────────────────────────────────────────────
#  UNION-FIND for Kruskal's
# ─────────────────────────────────────────────
class UnionFind:
    def __init__(self, nodes):
        self.parent = {n: n for n in nodes}
        self.rank   = {n: 0  for n in nodes}

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])   # path compression
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True


# ─────────────────────────────────────────────
#  PRIM'S ALGORITHM
# ─────────────────────────────────────────────
def prims(nodes, edges, start=None):
    """
    Prim's MST from adjacency representation.
    Returns:
        mst_edges   : list of dicts with step info
        total_cost  : float
        steps       : detailed trace list
        elapsed_ms  : time in milliseconds
    """
    from graph_loader import build_adjacency
    adj = build_adjacency(nodes, edges)

    if start is None:
        start = nodes[0]

    visited   = set()
    heap      = []   # (weight, from_node, to_node)
    mst_edges = []
    steps     = []
    total     = 0.0
    step_num  = 0

    visited.add(start)
    steps.append({
        "step": 0,
        "action": "START",
        "detail": f"Begin at neighbourhood '{start}'. Mark as visited.",
        "edge": None,
        "accepted": None,
        "visited": list(visited),
        "mst_cost_so_far": 0
    })

    for w, nbr in adj[start]:
        heapq.heappush(heap, (w, start, nbr))

    t_start = time.perf_counter()

    while heap and len(mst_edges) < len(nodes) - 1:
        w, u, v = heapq.heappop(heap)
        step_num += 1

        if v in visited:
            steps.append({
                "step": step_num,
                "action": "SKIP",
                "detail": f"Edge ({u} → {v}, cost={w:.1f}) skipped — '{v}' already in MST.",
                "edge": {"from": u, "to": v, "weight": w},
                "accepted": False,
                "visited": list(visited),
                "mst_cost_so_far": total
            })
            continue

        # Accept edge
        visited.add(v)
        mst_edges.append({"from": u, "to": v, "weight": w})
        total += w

        steps.append({
            "step": step_num,
            "action": "ACCEPT",
            "detail": f"✔ Edge ({u} → {v}, cost={w:.1f}) added. Running total: {total:.1f} km",
            "edge": {"from": u, "to": v, "weight": w},
            "accepted": True,
            "visited": list(visited),
            "mst_cost_so_far": total
        })

        for nw, nbr in adj[v]:
            if nbr not in visited:
                heapq.heappush(heap, (nw, v, nbr))

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    steps.append({
        "step": step_num + 1,
        "action": "DONE",
        "detail": f"Prim's complete. Total MST cost = {total:.1f} km | Edges = {len(mst_edges)}",
        "edge": None,
        "accepted": None,
        "visited": list(visited),
        "mst_cost_so_far": total
    })

    return mst_edges, total, steps, elapsed_ms


# ─────────────────────────────────────────────
#  KRUSKAL'S ALGORITHM
# ─────────────────────────────────────────────
def kruskals(nodes, edges):
    """
    Kruskal's MST using Union-Find.
    Returns:
        mst_edges   : list of dicts with step info
        total_cost  : float
        steps       : detailed trace list
        elapsed_ms  : time in milliseconds
    """
    sorted_edges = sorted(edges, key=lambda x: x[0])
    uf       = UnionFind(nodes)
    mst_edges = []
    steps    = []
    total    = 0.0

    steps.append({
        "step": 0,
        "action": "START",
        "detail": f"Sort all {len(sorted_edges)} edges by weight (ascending). Begin greedy selection.",
        "edge": None,
        "accepted": None,
        "mst_cost_so_far": 0
    })

    t_start = time.perf_counter()

    for i, (w, u, v) in enumerate(sorted_edges):
        step_num = i + 1

        if uf.find(u) == uf.find(v):
            steps.append({
                "step": step_num,
                "action": "SKIP",
                "detail": f"Edge ({u} — {v}, cost={w:.1f}) skipped — would form a CYCLE.",
                "edge": {"from": u, "to": v, "weight": w},
                "accepted": False,
                "mst_cost_so_far": total
            })
        else:
            uf.union(u, v)
            mst_edges.append({"from": u, "to": v, "weight": w})
            total += w
            steps.append({
                "step": step_num,
                "action": "ACCEPT",
                "detail": f"✔ Edge ({u} — {v}, cost={w:.1f}) added. Running total: {total:.1f} km",
                "edge": {"from": u, "to": v, "weight": w},
                "accepted": True,
                "mst_cost_so_far": total
            })

        if len(mst_edges) == len(nodes) - 1:
            break

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    steps.append({
        "step": len(sorted_edges) + 1,
        "action": "DONE",
        "detail": f"Kruskal's complete. Total MST cost = {total:.1f} km | Edges = {len(mst_edges)}",
        "edge": None,
        "accepted": None,
        "mst_cost_so_far": total
    })

    return mst_edges, total, steps, elapsed_ms


# ─────────────────────────────────────────────
#  COMPARISON & RECOMMENDATION
# ─────────────────────────────────────────────
def compare_and_recommend(nodes, edges,
                           p_cost, p_ms,
                           k_cost, k_ms):
    """Generate a recommendation report comparing both algorithms."""
    n = len(nodes)
    e = len(edges)
    density = e / (n * (n - 1) / 2) if n > 1 else 0
    density_label = "Dense" if density > 0.5 else "Sparse"

    cost_match = abs(p_cost - k_cost) < 1e-6

    report = {
        "graph_stats": {
            "nodes": n,
            "edges": e,
            "density": round(density, 3),
            "density_label": density_label
        },
        "cost_match": cost_match,
        "prims_ms": round(p_ms, 4),
        "kruskals_ms": round(k_ms, 4),
        "faster": "Prim's" if p_ms < k_ms else "Kruskal's",
        "recommendation": "",
        "reasoning": []
    }

    reasoning = []

    if density_label == "Dense":
        reasoning.append(
            "The graph is DENSE (many edges). Prim's with a min-heap runs in O((V+E) log V), "
            "which is efficient when E is large relative to V."
        )
        reasoning.append(
            "Kruskal's sorts all edges first — O(E log E) — which becomes costly on dense graphs."
        )
        rec = "Prim's Algorithm"
    else:
        reasoning.append(
            "The graph is SPARSE (few edges). Kruskal's O(E log E) sort is cheap here."
        )
        reasoning.append(
            "Kruskal's Union-Find approach handles disconnected components naturally — "
            "ideal for sparse city topologies."
        )
        rec = "Kruskal's Algorithm"

    reasoning.append(
        f"Both algorithms produced identical MST cost = {p_cost:.1f} km, "
        f"confirming correctness." if cost_match else
        f"WARNING: Cost mismatch — Prim's={p_cost:.1f}, Kruskal's={k_cost:.1f}. "
        f"Check for disconnected graph."
    )

    reasoning.append(
        f"On this run, {report['faster']} was faster "
        f"({min(p_ms, k_ms):.4f} ms vs {max(p_ms, k_ms):.4f} ms)."
    )

    report["recommendation"] = rec
    report["reasoning"] = reasoning

    return report
