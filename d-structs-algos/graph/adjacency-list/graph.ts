// An undirected graph stored as an adjacency list: every vertex maps to the set
// of vertices it is joined to. Map.get returns `Set<number> | undefined`, so the
// places that used to reach straight through a .get() now have to say what
// happens when the vertex is not there.
class Graph {
  graph = new Map<number, Set<number>>();

  addEdge(u: number, v: number): void {
    const uNeighbors = this.ensureVertex(u);
    const vNeighbors = this.ensureVertex(v);
    uNeighbors.add(v);
    vNeighbors.add(u);
  }

  adjacentNodes(node: number): Set<number> | null {
    return this.graph.get(node) ?? null;
  }

  unconnectedVertices(): number[] {
    const unconnected: number[] = [];
    for (const [key, neighbors] of this.graph) {
      if (neighbors.size === 0) {
        unconnected.push(key);
      }
    }
    return unconnected;
  }

  edgeExists(u: number, v: number): boolean {
    const uNeighbors = this.graph.get(u);
    const vNeighbors = this.graph.get(v);
    if (uNeighbors !== undefined && vNeighbors !== undefined) {
      return uNeighbors.has(v) && vNeighbors.has(u);
    }
    return false;
  }

  breadthFirstSearch(v: number): number[] {
    if (!this.graph.has(v)) {
      return [];
    }
    const visited: number[] = [];
    const explore: number[] = [v];
    while (explore.length > 0) {
      const node = explore.shift();
      if (node === undefined || visited.includes(node)) {
        continue;
      }
      visited.push(node);
      for (const neighbor of this.sortedNeighbors(node)) {
        if (!visited.includes(neighbor)) {
          explore.push(neighbor);
        }
      }
    }
    return visited;
  }

  depthFirstSearch(startVertex: number): number[] {
    const visited: number[] = [];
    this.depthFirstSearchR(visited, startVertex);
    return visited;
  }

  depthFirstSearchR(visited: number[], currentVertex: number): void {
    visited.push(currentVertex);
    for (const neighbor of this.sortedNeighbors(currentVertex)) {
      if (!visited.includes(neighbor)) {
        this.depthFirstSearchR(visited, neighbor);
      }
    }
  }

  // Both traversals visit neighbors in ascending order so their output is
  // deterministic. Pulling that out also gives the `undefined` case one home.
  private sortedNeighbors(node: number): number[] {
    return [...(this.graph.get(node) ?? [])].sort((a, b) => a - b);
  }

  private ensureVertex(node: number): Set<number> {
    let neighbors = this.graph.get(node);
    if (neighbors === undefined) {
      neighbors = new Set<number>();
      this.graph.set(node, neighbors);
    }
    return neighbors;
  }
}

export { Graph };
