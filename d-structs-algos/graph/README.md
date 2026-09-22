# Graphs

Vertices joined by edges. Both folders here store the *same* undirected graph two
different ways, which is the point: the choice of representation decides what is
cheap.

| Folder | Representation | Space | `edgeExists(u, v)` | Iterate a vertex's neighbours |
|---|---|---|---|---|
| [adjacency-list/](adjacency-list/) | `Map<number, Set<number>>` | O(V + E) | O(1) | O(degree) |
| [matrix/](matrix/) | `boolean[][]` | O(V²) | O(1) | O(V) |

[dijkstra/](dijkstra/) builds on the list form: the same idea with weights on the
edges, and the shortest-path algorithm that needs them.

## Picking one

Count the edges. A graph is **sparse** when E is close to V, **dense** when it is
close to V².

For a sparse graph the matrix is nearly all `false`: a social network with a
million users and a hundred friends each needs 10¹² booleans as a matrix, or
about 10⁸ entries as a list. The list wins by four orders of magnitude, and
listing someone's friends touches only their friends rather than every user.

For a dense graph the matrix stops wasting space and starts paying off: one
contiguous block, no per-vertex allocation, predictable memory access. Weighted
graphs also sit naturally in a matrix — store the weight instead of a boolean.

The list is the default in practice, because most real graphs are sparse.

## What the types tell you

`adjacentNodes` returns `Set<number> | null`, because a vertex you never added
has no neighbour set — and "no such vertex" is a different answer from "a vertex
with no neighbours", which is `unconnectedVertices`'s job. `Map.get` returning
`undefined` is what forces that distinction into the open.

The matrix version is fixed at `numVertices` on construction and its `addEdge`
silently ignores out-of-range vertices. That is the other cost of a matrix: you
have to know how big the graph is before you start, and growing it means
reallocating V².

## Breadth-first search

The adjacency-list version implements BFS: visit everything one hop away, then
two, and so on. It uses a queue — see [queue/](../queue/) — and that is what makes
it breadth-first. Swap the queue for a stack and you get depth-first.

On an unweighted graph, BFS finds the shortest path by number of hops, because it
reaches every vertex at its minimum distance. Add weights and that stops being
true, which is where [dijkstra/](dijkstra/) comes in.

Both traversals keep membership in a `Set` rather than testing an array with
`.includes()`, and the BFS queue walks a head index rather than calling
`shift()`. Either shortcut would put an O(V) scan inside the loop and quietly
turn an O(V + E) traversal into O(V·E) — see [queue/](../queue/) for the same
array-as-queue cost in isolation.

## Run

```bash
npm test -- d-structs-algos/graph
```
