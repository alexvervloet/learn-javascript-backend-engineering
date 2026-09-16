import { describe, test, expect } from "@jest/globals";
import { Queue } from "./custom_queue.js";

describe("peek", () => {
  const cases: [string[], string | null][] = [
    [[], null],
    [["alice"], "alice"],
    [["alice", "bob"], "alice"],
    [["alice", "bob", "carol"], "alice"],
  ];

  test.each(cases)("peek after pushing %p", (pushes, expected) => {
    const q = new Queue<string>();
    for (const item of pushes) {
      q.push(item);
    }
    expect(q.peek()).toBe(expected);
  });
});

describe("queue mechanics", () => {
  test("pop returns the oldest item (FIFO)", () => {
    const q = new Queue<string>();
    q.push("alice");
    q.push("bob");
    expect(q.pop()).toBe("alice");
    expect(q.pop()).toBe("bob");
    expect(q.pop()).toBeNull();
  });

  test("searchAndRemove removes a present item and returns null otherwise", () => {
    const q = new Queue<string>();
    q.push("alice");
    q.push("bob");
    expect(q.searchAndRemove("alice")).toBe("alice");
    expect(q.size()).toBe(1);
    expect(q.searchAndRemove("missing")).toBeNull();
  });
});
