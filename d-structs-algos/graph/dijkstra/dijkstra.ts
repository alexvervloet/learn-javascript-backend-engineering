// Dijkstra's algorithm: cheapest path from one source to every other vertex, on
// a graph whose edges carry non-negative weights.
//
// BFS (see ../adjacency-list/) already finds shortest paths when every edge
// costs the same, because "fewest hops" and "cheapest" are the same thing then.
// Add weights and they come apart: a two-hop route over cheap edges can beat a
// one-hop route over an expensive one, and BFS would return the one-hop answer.
//
// The idea is to keep a best-known distance to every vertex, start them all at
// Infinity, and repeatedly take the closest vertex that has not been settled
// yet. Because weights are non-negative, that vertex's distance cannot improve
// later — nothing reachable from further away can loop back more cheaply — so it
// can be marked settled and never revisited. That argument is exactly where the
// non-negative requirement comes from; see the note at the bottom.
//
// "Repeatedly take the closest unsettled vertex" is a priority queue, which is
// why this sits next to ../../heap/.

import { MinHeap } from "../../heap/heap.js";

interface Edge {
  to: number;
  weight: number;
}

// One entry per vertex reachable from the source.
interface Result {
  // Cheapest total cost from the source. Infinity when unreachable.
  distances: Map<number, number>;
  // Each vertex's predecessor on its cheapest path, for reconstructing routes.
  previous: Map<number, number | null>;
}

// A weighted, directed graph. Directed is the more general case: an undirected
// edge is just two directed ones, which is what addUndirectedEdge does.
class WeightedGraph {
  private adjacency = new Map<number, Edge[]>();

  addEdge(from: number, to: number, weight: number): void {
    if (weight < 0) {
      // Refusing here rather than returning a wrong answer later. Dijkstra's
      // correctness argument assumes non-negative weights; with one negative
      // edge it does not fail loudly, it quietly returns a path that is not the
      // cheapest. Bellman-Ford is the algorithm for graphs that need them.
      throw new Error(`Dijkstra requires non-negative weights, got ${weight}`);
    }
    this.ensure(from).push({ to, weight });
    this.ensure(to); // so an edge's target is a known vertex even with no outgoing edges
  }

  addUndirectedEdge(a: number, b: number, weight: number): void {
    this.addEdge(a, b, weight);
    this.addEdge(b, a, weight);
  }

  neighbours(vertex: number): Edge[] {
    return this.adjacency.get(vertex) ?? [];
  }

  vertices(): number[] {
    return [...this.adjacency.keys()];
  }

  has(vertex: number): boolean {
    return this.adjacency.has(vertex);
  }

  private ensure(vertex: number): Edge[] {
    let edges = this.adjacency.get(vertex);
    if (edges === undefined) {
      edges = [];
      this.adjacency.set(vertex, edges);
    }
    return edges;
  }
}

// O((V + E) log V) with a binary heap.
function dijkstra(graph: WeightedGraph, source: number): Result {
  const distances = new Map<number, number>();
  const previous = new Map<number, number | null>();

  for (const vertex of graph.vertices()) {
    distances.set(vertex, Infinity);
    previous.set(vertex, null);
  }
  if (!graph.has(source)) {
    return { distances, previous };
  }
  distances.set(source, 0);

  // The queue holds (vertex, distance) pairs ordered by distance.
  const queue = new MinHeap<{ vertex: number; distance: number }>((a, b) => a.distance - b.distance);
  queue.push({ vertex: source, distance: 0 });

  // A binary heap cannot cheaply lower the priority of something already in it,
  // so instead of updating an entry we push a second one and ignore the stale
  // copy when it surfaces. This is "lazy deletion". It costs at most one heap
  // entry per edge, which is why the bound is log V per edge rather than log E —
  // and it is far simpler than the indexed heap the textbook version wants.
  const settled = new Set<number>();

  for (;;) {
    const next = queue.pop();
    if (next === null) {
      break;
    }
    if (settled.has(next.vertex)) {
      continue; // a stale duplicate; the real one was processed already
    }
    settled.add(next.vertex);

    for (const edge of graph.neighbours(next.vertex)) {
      if (settled.has(edge.to)) {
        continue;
      }
      // "Relaxing" an edge: is going through this vertex cheaper than the best
      // route found so far?
      const candidate = next.distance + edge.weight;
      const best = distances.get(edge.to) ?? Infinity;
      if (candidate < best) {
        distances.set(edge.to, candidate);
        previous.set(edge.to, next.vertex);
        queue.push({ vertex: edge.to, distance: candidate });
      }
    }
  }

  return { distances, previous };
}

// Walk the `previous` chain backwards from the target to rebuild the route.
// Returns [] when the target is unreachable, which is a different answer from
// [source] (the target being the source itself).
function shortestPath(graph: WeightedGraph, source: number, target: number): number[] {
  const { distances, previous } = dijkstra(graph, source);
  if ((distances.get(target) ?? Infinity) === Infinity) {
    return [];
  }
  const path: number[] = [];
  let current: number | null = target;
  while (current !== null) {
    path.push(current);
    current = previous.get(current) ?? null;
  }
  return path.reverse();
}

export { WeightedGraph, dijkstra, shortestPath };
export type { Edge, Result };
