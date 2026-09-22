# Dijkstra's Algorithm

Cheapest path from one source to everywhere else, on a graph whose edges carry
non-negative weights.

| | Cost |
|---|---|
| With a binary heap (here) | O((V + E) log V) |
| Scanning an array for the minimum | O(V²) |
| Space | O(V) |

## Why BFS is not enough

[BFS](../adjacency-list/) already finds shortest paths — when every edge costs
the same. Then "fewest hops" and "cheapest" are the same question.

Add weights and they separate:

```
        4        1
    0 ------ 1 ----- 3
    |       /
   1|     2/
    |     /
    2 ---+
```

BFS from 0 reaches 1 in one hop and stops thinking about it. But 0 → 2 → 1 costs
1 + 2 = 3, and the direct edge costs 4. The two-hop route is cheaper. BFS has no
way to know, because it counts hops and the weights are invisible to it.

## The idea

Keep a best-known distance to every vertex, all starting at `Infinity` except
the source at 0. Then repeatedly:

1. Take the unsettled vertex with the smallest known distance.
2. Mark it settled. Its distance is final.
3. For each of its neighbours, check whether going through it is cheaper than
   the best route found so far. If it is, write down the new distance and how
   you got there. This step is called **relaxing** the edge.

Step 2 is the load-bearing claim: once a vertex is the closest unsettled one,
nothing can improve it later. Any other route to it would have to leave through
some further-away vertex and come back, and since no edge has negative weight,
leaving can only add cost. That argument is the whole algorithm, and it is also
exactly where the non-negative requirement comes from.

## Negative weights break it, quietly

Give one edge a negative weight and step 2's argument collapses: a later, longer
detour really can come back cheaper. Dijkstra does not detect this. It settles a
vertex early, never reconsiders, and returns a path that is simply not the
shortest — no error, no warning.

`addEdge` throws on a negative weight for that reason. A loud failure at insert
beats a wrong answer at query time. If you need negative edges, the algorithm
you want is **Bellman-Ford**: O(V·E) instead of O((V+E) log V), and it detects
negative cycles rather than looping forever on them.

## Why the heap matters

"Take the unsettled vertex with the smallest distance" is a
[priority queue](../../heap/). Do it by scanning an array and each step is O(V),
so the whole algorithm is O(V²). With a binary heap each step is O(log V) and
you get O((V + E) log V).

On a sparse graph that is the difference between usable and not. A road network
with a million intersections and four million roads: about 10¹² operations
scanning, versus about 10⁸ with a heap.

### Lazy deletion

A binary heap cannot cheaply lower the priority of an item already inside it.
The textbook fix is an indexed heap that tracks where each vertex lives; the
practical fix, used here, is to push a second entry with the better distance and
ignore the stale one when it surfaces:

```ts
if (settled.has(next.vertex)) continue;   // a duplicate — already handled
```

It costs at most one heap entry per edge and is far less code. The test named
`stale heap entries do not corrupt the result` builds a graph that forces a
vertex's distance to improve twice, so a stale entry is guaranteed to be popped.

## Where this shows up

Routing and map directions are the obvious one. Less obviously: network packet
routing (OSPF is Dijkstra), dependency resolution when upgrades have costs,
game pathfinding (A* is Dijkstra plus a heuristic that biases it toward the
goal), and anything phrased as "cheapest sequence of steps from here to there".

## Run

```bash
npm test -- d-structs-algos/graph/dijkstra
```
