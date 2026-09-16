import { describe, test, expect } from "@jest/globals";
import { Graph } from "./graph.js";

type Edge = [number, number];

function buildGraph(edges: Edge[]): Graph {
  const graph = new Graph();
  for (const [u, v] of edges) {
    graph.addEdge(u, v);
  }
  return graph;
}

describe("edgeExists", () => {
  const cases: { edges: Edge[]; checks: Edge[]; expected: boolean[] }[] = [
    {
      edges: [[0, 1], [2, 0]],
      checks: [[1, 0], [1, 2], [2, 0]],
      expected: [true, false, true],
    },
    {
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
      checks: [[0, 1], [1, 2], [0, 4], [2, 5], [5, 0]],
      expected: [true, true, false, false, false],
    },
    {
      edges: [[0, 1], [2, 4], [2, 1], [3, 1], [4, 5]],
      checks: [[5, 4], [1, 5], [0, 4], [2, 5], [1, 3]],
      expected: [true, false, false, false, true],
    },
  ];

  test.each(cases)("checks edges %#", ({ edges, checks, expected }) => {
    const graph = buildGraph(edges);
    const actual = checks.map(([u, v]) => graph.edgeExists(u, v));
    expect(actual).toEqual(expected);
  });
});

describe("breadthFirstSearch", () => {
  const cases: { edges: Edge[]; start: number; expected: number[] }[] = [
    { edges: [[0, 1], [0, 2], [1, 3], [1, 4]], start: 0, expected: [0, 1, 2, 3, 4] },
    { edges: [[0, 1], [1, 2], [2, 3], [3, 0]], start: 0, expected: [0, 1, 3, 2] },
    { edges: [[0, 1], [1, 2], [2, 3]], start: 0, expected: [0, 1, 2, 3] },
    { edges: [[0, 1], [1, 2], [2, 3], [3, 4]], start: 2, expected: [2, 1, 3, 0, 4] },
  ];

  test.each(cases)("BFS %#", ({ edges, start, expected }) => {
    expect(buildGraph(edges).breadthFirstSearch(start)).toEqual(expected);
  });
});

describe("depthFirstSearch", () => {
  const cases: { edges: Edge[]; start: number; expected: number[] }[] = [
    { edges: [[0, 1], [0, 2], [1, 3], [1, 4]], start: 0, expected: [0, 1, 3, 4, 2] },
    { edges: [[0, 1], [1, 2], [2, 3], [3, 0]], start: 0, expected: [0, 1, 2, 3] },
    { edges: [[0, 1], [1, 2], [2, 3]], start: 0, expected: [0, 1, 2, 3] },
    { edges: [[0, 1], [1, 2], [2, 3], [3, 4]], start: 2, expected: [2, 1, 0, 3, 4] },
  ];

  test.each(cases)("DFS %#", ({ edges, start, expected }) => {
    expect(buildGraph(edges).depthFirstSearch(start)).toEqual(expected);
  });
});

describe("adjacentNodes", () => {
  const edges: Edge[] = [[0, 1], [0, 2], [1, 3]];
  const cases: { node: number; expected: number[] | null }[] = [
    { node: 0, expected: [1, 2] },
    { node: 1, expected: [0, 3] },
    { node: 3, expected: [1] },
    { node: 9, expected: null },
  ];

  test.each(cases)("adjacentNodes(%p)", ({ node, expected }) => {
    const result = buildGraph(edges).adjacentNodes(node);
    if (expected === null) {
      expect(result).toBeNull();
    } else {
      expect([...(result ?? [])].sort((a, b) => a - b)).toEqual(expected);
    }
  });
});

describe("unconnectedVertices", () => {
  const cases: { edges: Edge[]; expected: number[] }[] = [
    { edges: [[0, 1], [1, 2]], expected: [] },
    { edges: [[0, 1], [2, 3], [4, 5]], expected: [] },
  ];

  test.each(cases)("unconnectedVertices %#", ({ edges, expected }) => {
    expect(buildGraph(edges).unconnectedVertices()).toEqual(expected);
  });
});
