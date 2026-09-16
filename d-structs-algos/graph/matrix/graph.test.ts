import { test, expect } from "@jest/globals";
import { Graph } from "./graph.js";

type Edge = [number, number];

const cases: {
  numVertices: number;
  edges: Edge[];
  checks: Edge[];
  expected: boolean[];
}[] = [
  {
    numVertices: 3,
    edges: [[0, 1], [2, 0]],
    checks: [[1, 0], [1, 2], [2, 0]],
    expected: [true, false, true],
  },
  {
    numVertices: 6,
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    checks: [[0, 1], [1, 2], [0, 4], [2, 5], [5, 0]],
    expected: [true, true, false, false, false],
  },
  {
    numVertices: 6,
    edges: [[0, 1], [2, 4], [2, 1], [3, 1], [4, 5]],
    checks: [[5, 4], [1, 5], [0, 4], [2, 5], [1, 3]],
    expected: [true, false, false, false, true],
  },
];

test.each(cases)("edgeExists matrix %#", ({ numVertices, edges, checks, expected }) => {
  const graph = new Graph(numVertices);
  for (const [u, v] of edges) {
    graph.addEdge(u, v);
  }
  const actual = checks.map(([u, v]) => graph.edgeExists(u, v));
  expect(actual).toEqual(expected);
});
