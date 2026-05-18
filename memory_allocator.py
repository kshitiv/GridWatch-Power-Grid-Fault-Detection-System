"""
GridWatch - Memory Allocator Simulation
Simulates contiguous memory allocation for routing tables.
Strategies: First Fit, Best Fit, Worst Fit
"""

import copy


# ─────────────────────────────────────────────
#  MEMORY BLOCK MODEL
# ─────────────────────────────────────────────
class MemoryBlock:
    def __init__(self, start, size, free=True, label=None):
        self.start = start
        self.size  = size
        self.free  = free
        self.label = label   # neighbourhood name

    def to_dict(self):
        return {
            "start": self.start,
            "size":  self.size,
            "free":  self.free,
            "label": self.label,
            "end":   self.start + self.size - 1
        }


# ─────────────────────────────────────────────
#  MEMORY SIMULATOR
# ─────────────────────────────────────────────
class MemorySimulator:
    def __init__(self, total_size):
        self.total_size = total_size
        self.blocks     = [MemoryBlock(0, total_size, free=True)]
        self.log        = []   # step-by-step allocation log
        self.alloc_map  = {}   # label -> block index (for deallocation)

    def _snapshot(self):
        return [b.to_dict() for b in self.blocks]

    def _merge_free_blocks(self):
        """Coalesce adjacent free blocks."""
        merged = [self.blocks[0]]
        for b in self.blocks[1:]:
            last = merged[-1]
            if last.free and b.free:
                last.size += b.size
            else:
                merged.append(b)
        self.blocks = merged

    def allocate(self, label, size, strategy):
        """
        Allocate `size` units for `label` using the given strategy.
        strategy: 'first_fit' | 'best_fit' | 'worst_fit'
        """
        free_blocks = [(i, b) for i, b in enumerate(self.blocks) if b.free and b.size >= size]

        if not free_blocks:
            self.log.append({
                "action": "FAIL",
                "label":  label,
                "size":   size,
                "strategy": strategy,
                "detail": f"✗ Cannot allocate {size} KB for '{label}' — no suitable block found (External Fragmentation).",
                "snapshot": self._snapshot()
            })
            return False

        # Strategy selection
        if strategy == "first_fit":
            idx, chosen = free_blocks[0]
        elif strategy == "best_fit":
            idx, chosen = min(free_blocks, key=lambda x: x[1].size)
        elif strategy == "worst_fit":
            idx, chosen = max(free_blocks, key=lambda x: x[1].size)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        # Split the block
        remaining = chosen.size - size
        new_alloc  = MemoryBlock(chosen.start, size, free=False, label=label)

        if remaining > 0:
            leftover = MemoryBlock(chosen.start + size, remaining, free=True)
            self.blocks[idx:idx+1] = [new_alloc, leftover]
        else:
            self.blocks[idx] = new_alloc

        self.alloc_map[label] = chosen.start

        internal_frag = 0   # Contiguous allocation has no internal fragmentation
        self.log.append({
            "action": "ALLOC",
            "label":  label,
            "size":   size,
            "strategy": strategy,
            "block_start": chosen.start,
            "remaining_in_block": remaining,
            "detail": (
                f"✔ Allocated {size} KB for '{label}' at block [{chosen.start}–{chosen.start+size-1}] "
                f"using {strategy.replace('_',' ').title()}. "
                f"Leftover in this block: {remaining} KB."
            ),
            "snapshot": self._snapshot()
        })
        return True

    def deallocate(self, label):
        """Free a previously allocated block."""
        for b in self.blocks:
            if not b.free and b.label == label:
                b.free  = True
                b.label = None
                self._merge_free_blocks()
                self.log.append({
                    "action": "FREE",
                    "label":  label,
                    "detail": f"↩ Freed block for '{label}'. Merging adjacent free blocks.",
                    "snapshot": self._snapshot()
                })
                return True
        return False

    def compact(self):
        """
        Memory compaction: slide all allocated blocks to the left,
        merging all free space into one contiguous block at the end.
        Returns a dict with before/after snapshots and a log of moves.
        """
        before_snapshot = self._snapshot()

        used_blocks = [b for b in self.blocks if not b.free]
        total_free  = sum(b.size for b in self.blocks if b.free)

        moves = []
        cursor = 0
        new_blocks = []

        for b in used_blocks:
            if b.start != cursor:
                moves.append({
                    "label": b.label,
                    "from":  b.start,
                    "to":    cursor,
                    "size":  b.size
                })
            new_b = MemoryBlock(cursor, b.size, free=False, label=b.label)
            new_blocks.append(new_b)
            cursor += b.size

        # Single free block at the end (if any free space)
        if total_free > 0:
            new_blocks.append(MemoryBlock(cursor, total_free, free=True))

        self.blocks = new_blocks
        after_snapshot = self._snapshot()

        self.log.append({
            "action":   "COMPACT",
            "detail":   f"▣ Compaction complete. Moved {len(moves)} block(s). "
                        f"Free space consolidated: {total_free} KB contiguous.",
            "moves":    moves,
            "snapshot": after_snapshot
        })

        return {
            "before":      before_snapshot,
            "after":       after_snapshot,
            "moves":       moves,
            "total_free":  total_free,
            "detail":      f"Moved {len(moves)} block(s). {total_free} KB consolidated into one free block."
        }

    def stats(self):
        """Compute fragmentation and usage statistics."""
        total_free      = sum(b.size for b in self.blocks if b.free)
        total_used      = sum(b.size for b in self.blocks if not b.free)
        free_blocks     = [b for b in self.blocks if b.free]
        num_free_blocks = len(free_blocks)
        largest_free    = max((b.size for b in free_blocks), default=0)

        # External fragmentation = free memory that cannot satisfy a large request
        # measured as: 1 - (largest_free / total_free) if total_free > 0
        ext_frag_ratio = (
            round(1.0 - (largest_free / total_free), 4)
            if total_free > 0 else 0.0
        )

        return {
            "total_size":         self.total_size,
            "used":               total_used,
            "free":               total_free,
            "num_free_blocks":    num_free_blocks,
            "largest_free_block": largest_free,
            "external_frag_ratio": ext_frag_ratio,
            "utilization_pct":    round(total_used / self.total_size * 100, 2),
            "snapshot":           self._snapshot()
        }


# ─────────────────────────────────────────────
#  RUN ALL THREE STRATEGIES ON SAME REQUESTS
# ─────────────────────────────────────────────
def simulate_all_strategies(total_memory, requests):
    """
    requests: list of dicts
        { "action": "alloc", "label": "NH-1", "size": 40 }
        { "action": "free",  "label": "NH-1" }
    
    Returns results dict keyed by strategy name.
    """
    strategies = ["first_fit", "best_fit", "worst_fit"]
    results    = {}

    for strategy in strategies:
        sim = MemorySimulator(total_memory)

        for req in requests:
            if req["action"] == "alloc":
                sim.allocate(req["label"], req["size"], strategy)
            elif req["action"] == "free":
                sim.deallocate(req["label"])

        results[strategy] = {
            "log":   sim.log,
            "stats": sim.stats()
        }

    return results


def recommend_strategy(results):
    """Pick the best strategy based on external fragmentation and utilization."""
    best    = None
    best_score = float("inf")
    reasoning  = []

    for name, data in results.items():
        s = data["stats"]
        # Score = external fragmentation ratio (lower is better)
        score = s["external_frag_ratio"]
        reasoning.append(
            f"{name.replace('_',' ').title()}: "
            f"Ext. Frag = {s['external_frag_ratio']*100:.1f}%, "
            f"Utilisation = {s['utilization_pct']}%, "
            f"Free blocks = {s['num_free_blocks']}, "
            f"Largest free = {s['largest_free_block']} KB"
        )
        if score < best_score:
            best_score = score
            best       = name

    explanation = {
        "first_fit":  "First Fit is fast (O(n)) and tends to keep large free blocks at the end.",
        "best_fit":   "Best Fit minimises wasted space per allocation but can create tiny unusable fragments.",
        "worst_fit":  "Worst Fit leaves the largest possible remnant, reducing tiny-fragment problems."
    }

    return {
        "recommended": best.replace("_", " ").title() if best else "N/A",
        "reasoning":   reasoning,
        "explanation": explanation.get(best, ""),
        "scores":      {k: v["stats"]["external_frag_ratio"] for k, v in results.items()}
    }


# ─────────────────────────────────────────────
#  COMPACT A SPECIFIC STRATEGY'S FINAL STATE
# ─────────────────────────────────────────────
def compact_strategy(total_memory, requests, strategy):
    """
    Re-run simulation for one strategy, then compact.
    Returns before/after snapshots plus move log.
    """
    sim = MemorySimulator(total_memory)
    for req in requests:
        if req["action"] == "alloc":
            sim.allocate(req["label"], req["size"], strategy)
        elif req["action"] == "free":
            sim.deallocate(req["label"])

    stats_before = sim.stats()
    compaction   = sim.compact()
    stats_after  = sim.stats()

    return {
        "strategy":      strategy,
        "stats_before":  stats_before,
        "stats_after":   stats_after,
        "compaction":    compaction
    }
