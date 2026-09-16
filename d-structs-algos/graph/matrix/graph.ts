// The same undirected graph stored as an adjacency matrix: graph[u][v] is true
// when an edge joins u and v. addEdge guards its row lookups because a matrix
// graph is fixed at numVertices and can be handed a vertex outside it.
class Graph {
  graph: boolean[][];

  constructor(numVertices: number) {
    this.graph = Array.from({ length: numVertices }, () =>
      new Array<boolean>(numVertices).fill(false)
    );
  }

  addEdge(u: number, v: number): void {
    const rowU = this.graph[u];
    const rowV = this.graph[v];
    if (rowU === undefined || rowV === undefined) {
      return;
    }
    rowU[v] = true;
    rowV[u] = true;
  }

  // don't touch below this line

  edgeExists(u: number, v: number): boolean {
    if (u < 0 || u >= this.graph.length) {
      return false;
    }
    if (this.graph.length === 0) {
      return false;
    }
    const row1 = this.graph[0];
    if (row1 === undefined || v < 0 || v >= row1.length) {
      return false;
    }
    return this.graph[u][v];
  }
}

export { Graph };
