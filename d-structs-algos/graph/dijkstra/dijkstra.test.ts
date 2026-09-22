import { describe, test, expect } from "@jest/globals";
import { WeightedGraph, dijkstra, shortestPath } from "./dijkstra.js";

// The graph used by most tests below.
//
//        4        1
//    0 ------ 1 ----- 3
//    |       /        |
//   1|     2/         |5
//    |     /          |
//    2 ---+           4
//
// 0-1 = 4, 0-2 = 1, 1-2 = 2, 1-3 = 1, 3-4 = 5
//
// The point of the 0-2-1 route is that it costs 3 and the direct 0-1 edge costs
// 4, so a correct implementation must prefer two hops over one.
function sample(): WeightedGraph {
  const graph = new WeightedGraph();
  graph.addUndirectedEdge(0, 1, 4);
  graph.addUndirectedEdge(0, 2, 1);
  graph.addUndirectedEdge(1, 2, 2);
  graph.addUndirectedEdge(1, 3, 1);
  graph.addUndirectedEdge(3, 4, 5);
  return graph;
}

describe("dijkstra", () => {
  test("prefers a cheap two-hop route over an expensive one-hop route", () => {
    const { distances } = dijkstra(sample(), 0);
    expect(distances.get(0)).toBe(0);
    expect(distances.get(2)).toBe(1); // direct
    expect(distances.get(1)).toBe(3); // 0 -> 2 -> 1 beats the direct edge of 4
    expect(distances.get(3)).toBe(4); // 0 -> 2 -> 1 -> 3
    expect(distances.get(4)).toBe(9); // ... -> 4
  });

  test("reconstructs the path, not just the cost", () => {
    expect(shortestPath(sample(), 0, 3)).toEqual([0, 2, 1, 3]);
    expect(shortestPath(sample(), 0, 4)).toEqual([0, 2, 1, 3, 4]);
  });

  test("the path from a vertex to itself is just that vertex", () => {
    expect(shortestPath(sample(), 0, 0)).toEqual([0]);
  });

  test("unreachable vertices are Infinity, with no path", () => {
    const graph = new WeightedGraph();
    graph.addUndirectedEdge(0, 1, 1);
    graph.addUndirectedEdge(5, 6, 1); // a separate component
    const { distances } = dijkstra(graph, 0);
    expect(distances.get(1)).toBe(1);
    expect(distances.get(5)).toBe(Infinity);
    expect(shortestPath(graph, 0, 5)).toEqual([]);
  });

  test("a source that is not in the graph reaches nothing", () => {
    const { distances } = dijkstra(sample(), 99);
    expect(distances.get(99)).toBeUndefined();
    expect([...distances.values()].every((d) => d === Infinity)).toBe(true);
  });

  test("direction is respected on a directed graph", () => {
    const graph = new WeightedGraph();
    graph.addEdge(0, 1, 1);
    graph.addEdge(1, 2, 1);
    // No way back from 2.
    expect(dijkstra(graph, 0).distances.get(2)).toBe(2);
    expect(dijkstra(graph, 2).distances.get(0)).toBe(Infinity);
  });

  test("picks the cheaper of two parallel edges", () => {
    const graph = new WeightedGraph();
    graph.addEdge(0, 1, 10);
    graph.addEdge(0, 1, 3);
    expect(dijkstra(graph, 0).distances.get(1)).toBe(3);
  });

  test("a zero-weight edge is allowed", () => {
    const graph = new WeightedGraph();
    graph.addUndirectedEdge(0, 1, 0);
    expect(dijkstra(graph, 0).distances.get(1)).toBe(0);
  });

  test("a negative weight is rejected at insert, not silently mis-solved", () => {
    const graph = new WeightedGraph();
    expect(() => graph.addEdge(0, 1, -1)).toThrow(/non-negative/);
  });

  // The lazy-deletion scheme leaves stale entries in the heap. This graph forces
  // vertex 3's distance to improve twice, so at least one stale entry is popped
  // and must be ignored rather than acted on.
  test("stale heap entries do not corrupt the result", () => {
    const graph = new WeightedGraph();
    graph.addEdge(0, 1, 1);
    graph.addEdge(0, 2, 2);
    graph.addEdge(0, 3, 100); // first, bad estimate for 3
    graph.addEdge(1, 3, 50); //  better
    graph.addEdge(2, 3, 1); //   best: 0 -> 2 -> 3 = 3
    const { distances } = dijkstra(graph, 0);
    expect(distances.get(3)).toBe(3);
    expect(shortestPath(graph, 0, 3)).toEqual([0, 2, 3]);
  });

  test("agrees with a brute-force search on a larger random graph", () => {
    // Floyd-Warshall over the same graph, as an independent implementation to
    // check against. O(V^3), which is fine at this size and would not be at any
    // size worth using Dijkstra for.
    const V = 40;
    const rng = mulberry32(3);
    const graph = new WeightedGraph();
    const matrix: number[][] = Array.from({ length: V }, () => new Array<number>(V).fill(Infinity));
    for (let i = 0; i < V; i++) {
      matrix[i]![i] = 0;
      graph.addEdge(i, i, 0);
    }
    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        if (i !== j && rng() < 0.12) {
          const w = 1 + Math.floor(rng() * 20);
          graph.addEdge(i, j, w);
          matrix[i]![j] = Math.min(matrix[i]![j]!, w);
        }
      }
    }
    for (let k = 0; k < V; k++) {
      for (let i = 0; i < V; i++) {
        for (let j = 0; j < V; j++) {
          const through = matrix[i]![k]! + matrix[k]![j]!;
          if (through < matrix[i]![j]!) matrix[i]![j] = through;
        }
      }
    }

    const { distances } = dijkstra(graph, 0);
    for (let j = 0; j < V; j++) {
      expect(distances.get(j) ?? Infinity).toBe(matrix[0]![j]!);
    }
  });
});

function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
