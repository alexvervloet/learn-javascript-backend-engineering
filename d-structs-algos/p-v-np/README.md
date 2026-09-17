# P vs NP

Two problems where finding an answer looks hard and checking one is easy. That
gap is the whole subject.

| Folder | Problem | Solve | Verify |
|---|---|---|---|
| [subset-sum/](subset-sum/) | Is there a subset of these numbers adding to the target? | O(2ⁿ) | O(n) |
| [traveling-salesman/](traveling-salesman/) | Is there a route visiting every city under this budget? | O(n!) | O(n) |

## The idea

**P** is the set of problems solvable in polynomial time. **NP** is the set whose
*solutions can be checked* in polynomial time. Every problem in P is in NP —
solving it is one way of checking. Whether the reverse holds, whether P = NP, is
open, and is the thing the million-dollar prize is attached to.

Both problems here are NP-complete: in NP, and at least as hard as everything
else in it. If anyone finds a polynomial algorithm for either one, every problem
in NP falls, and P = NP.

The asymmetry is easiest to feel with the numbers. `tsp` searches every ordering
of the cities: 10 cities is 3.6 million routes, 15 is over a trillion, 20 is
longer than the universe has existed. `verifyTsp` takes a route someone hands you
and adds up the edges — one pass, done.

## Why a backend engineer should care

Not because you will be asked to prove anything. Because recognising that a
problem is NP-complete tells you to stop looking for the exact algorithm and
start negotiating:

- **Approximate.** Nearest-neighbour gets within ~25% of the optimal tour
  instantly. Most routing software ships a heuristic.
- **Constrain.** Exponential in n is fine when n is 12. Cap the input.
- **Change the question.** "The cheapest bundle" is often NP-hard; "a bundle
  under £50" usually is not.

Scheduling, bin packing, resource allocation and dependency resolution are all in
this family, and all of them turn up in ordinary backend work. npm's resolver is
solving an NP-complete problem every time you install something.

## A naming note

The travelling salesman problem properly asks for a *tour* — return to the
starting city. The implementation here decides the open variant, a Hamiltonian
path with no return leg, matching its test cases. Both are NP-complete and the
lesson is identical; the file says so and shows the one line that would close the
tour.

## Run

```bash
npm test -- d-structs-algos/p-v-np
```
