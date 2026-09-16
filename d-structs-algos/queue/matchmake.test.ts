import { test, expect } from "@jest/globals";
import { Queue } from "./custom_queue.js";
import { matchmake } from "./matchmake.js";
import type { UserEvent } from "./matchmake.js";

const cases: [UserEvent, string[], string][] = [
  [["Ted", "join"], ["Ted"], "No match found"],
  [["Barney", "join"], ["Barney", "Ted"], "No match found"],
  [["Marshall", "join"], ["Marshall", "Barney", "Ted"], "No match found"],
  [["Lily", "join"], ["Lily", "Marshall"], "Ted matched Barney!"],
  [["Robin", "join"], ["Robin", "Lily", "Marshall"], "No match found"],
  [["Carl", "join"], ["Carl", "Robin"], "Marshall matched Lily!"],
  [["Carl", "leave"], ["Robin"], "No match found"],
  [["Robin", "leave"], [], "No match found"],
  [["Ranjit", "join"], ["Ranjit"], "No match found"],
  [["Ranjit", "leave"], [], "No match found"],
  [["Victoria", "join"], ["Victoria"], "No match found"],
  [["Quinn", "join"], ["Quinn", "Victoria"], "No match found"],
  [["Zoey", "join"], ["Zoey", "Quinn", "Victoria"], "No match found"],
  [["Stella", "join"], ["Stella", "Zoey"], "Victoria matched Quinn!"],
];

test("matchmake processes a sequence of joins and leaves", () => {
  const queue = new Queue<string>();
  for (const [user, expectedItems, expectedReturn] of cases) {
    const result = matchmake(queue, user);
    expect(result).toBe(expectedReturn);
    expect(queue.items).toEqual(expectedItems);
  }
});
