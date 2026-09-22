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

  // Both traversals keep two structures rather than one: `order` is the answer,
  // in visit order, and `seen` is the membership test. An array cannot do both
  // jobs — `order.includes(x)` is a linear scan, and doing it once per edge
  // turns an O(V+E) traversal into O(V*E). On a dense graph that is the
  // difference between a thousand steps and a million.
  breadthFirstSearch(v: number): number[] {
    if (!this.graph.has(v)) {
      return [];
    }
    const order: number[] = [];
    const seen = new Set<number>([v]);
    const queue: number[] = [v];
    // A head index instead of queue.shift(): shift() re-indexes the whole array
    // on every dequeue, which would put the O(V) step back in a different place.
    let head = 0;
    while (head < queue.length) {
      const node = queue[head];
      head += 1;
      if (node === undefined) {
        continue;
      }
      order.push(node);
      for (const neighbor of this.sortedNeighbors(node)) {
        // Marked on enqueue, not on dequeue, so a vertex reached from two
        // neighbours is only ever queued once.
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return order;
  }

  depthFirstSearch(startVertex: number): number[] {
    if (!this.graph.has(startVertex)) {
      return [];
    }
    const order: number[] = [];
    this.depthFirstSearchR(new Set<number>(), order, startVertex);
    return order;
  }

  depthFirstSearchR(seen: Set<number>, order: number[], currentVertex: number): void {
    seen.add(currentVertex);
    order.push(currentVertex);
    for (const neighbor of this.sortedNeighbors(currentVertex)) {
      if (!seen.has(neighbor)) {
        this.depthFirstSearchR(seen, order, neighbor);
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
