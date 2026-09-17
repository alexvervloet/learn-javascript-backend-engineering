# Stack

Last in, first out. The only place you can add or remove is the top, and that
restriction is the point: it makes `push`, `pop` and `peek` all O(1), and it
matches any problem where the most recent thing is the one you need next.

| File | What's in it |
|---|---|
| `stack.ts` | `Stack<T>` — push, pop, peek, size |
| `balanced.ts` | `isBalanced(str)` — parenthesis matching, the classic use |

## Reading the types

`pop()` and `peek()` return `T | null`, not `T`. An empty stack has no top
element, and saying so in the return type means every caller has to decide what
to do about it. `balanced.ts` is the payoff: `stack.pop() === null` is how it
detects a closing paren with nothing to match, so the empty case is not an edge
case bolted on afterwards, it is the check.

`Stack<T>` is generic, so `Stack<string>` and `Stack<number>` are different types
and the compiler keeps them apart. That costs nothing at runtime — the generic
is erased.

## Why this shape

Anything that nests uses a stack: matched brackets, HTML tags, JSON, function
calls. Walk left to right, push when something opens, pop when something closes.
If you pop an empty stack you closed something that was never opened; if the
stack is non-empty at the end you opened something you never closed.

The call stack in the error you got this morning is this structure, which is why
deep recursion is a *stack* overflow.

## Run

```bash
npm test -- d-structs-algos/stack
```
