import { describe, test, expect } from "@jest/globals";
import { LinkedList } from "./linked_list.js";
import { Node } from "./node.js";

function buildList(vals: string[]): LinkedList<string> {
  const ll = new LinkedList<string>();
  for (const v of vals) {
    ll.addToTail(new Node(v));
  }
  return ll;
}

function listToVals(ll: LinkedList<string>): string[] {
  return [...ll].map((node) => node.val);
}

describe("addToHead / addToTail", () => {
  test("addToHead reverses insertion order and tracks head/tail", () => {
    const ll = new LinkedList<string>();
    for (const v of ["A", "B", "C"]) {
      ll.addToHead(new Node(v));
    }
    expect(listToVals(ll)).toEqual(["C", "B", "A"]);
    // head and tail are `Node<string> | null`, so reaching for .val needs ?.
    expect(ll.head?.val).toBe("C");
    expect(ll.tail?.val).toBe("A");
  });

  test("addToTail preserves insertion order and tracks head/tail", () => {
    const ll = buildList(["A", "B", "C"]);
    expect(listToVals(ll)).toEqual(["A", "B", "C"]);
    expect(ll.head?.val).toBe("A");
    expect(ll.tail?.val).toBe("C");
  });

  test("handles a large number of nodes with the expected length", () => {
    const count = 12000;
    const ll = new LinkedList<string>();
    for (let i = 0; i < count; i++) {
      ll.addToHead(new Node(`node-${i}`));
    }
    expect(listToVals(ll).length).toBe(count);
    expect(ll.head?.val).toBe(`node-${count - 1}`);
    expect(ll.tail?.val).toBe("node-0");
  });
});

describe("removeFromHead / removeFromTail", () => {
  interface RemovalCase {
    vals: string[];
    end: "head" | "tail";
    removed: string;
    remaining: string[];
    head: string | null;
    tail: string | null;
  }

  const cases: RemovalCase[] = [
    {
      vals: ["A", "B", "C"],
      end: "head",
      removed: "A",
      remaining: ["B", "C"],
      head: "B",
      tail: "C",
    },
    {
      vals: ["A", "B", "C"],
      end: "tail",
      removed: "C",
      remaining: ["A", "B"],
      head: "A",
      tail: "B",
    },
    { vals: ["X"], end: "head", removed: "X", remaining: [], head: null, tail: null },
    { vals: ["X"], end: "tail", removed: "X", remaining: [], head: null, tail: null },
  ];

  test.each(cases)(
    "remove from $end of $vals",
    ({ vals, end, removed, remaining, head, tail }) => {
      const ll = buildList(vals);
      const removedNode =
        end === "head" ? ll.removeFromHead() : ll.removeFromTail();

      expect(removedNode ? removedNode.val : null).toBe(removed);
      expect(listToVals(ll)).toEqual(remaining);
      expect(ll.head ? ll.head.val : null).toBe(head);
      expect(ll.tail ? ll.tail.val : null).toBe(tail);
    }
  );
});
