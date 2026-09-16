import { test, expect } from "@jest/globals";
import { HashMap } from "./hashmap.js";

interface HashMapCase {
  size: number;
  items: [string, string][];
}

const cases: HashMapCase[] = [
  {
    size: 2,
    items: [
      ["Billy Beane", "General Manager"],
      ["Peter Brand", "Assistant GM"],
    ],
  },
  {
    size: 3,
    items: [
      ["Art Howe", "Manager"],
      ["Ron Washington", "Coach"],
      ["David Justice", "Designated Hitter"],
    ],
  },
  {
    size: 2,
    items: [
      ["Paul DePodesta", "Analyst"],
      ["Ron Washington", "Coach"],
      ["Chad Bradford", "Pitcher"],
      ["Scott Hatteberg", "First Base"],
      ["David Justice", "Designated Hitter"],
    ],
  },
];

test.each(cases)("inserts and retrieves all items %#", ({ size, items }) => {
  const hm = new HashMap<string>(size);
  for (const [key, val] of items) {
    expect(() => hm.insert(key, val)).not.toThrow();
  }
  for (const [key, val] of items) {
    expect(hm.get(key)).toBe(val);
  }
});

test("throws when getting a missing key", () => {
  const hm = new HashMap<string>(4);
  hm.insert("present", "value");
  expect(() => hm.get("absent")).toThrow("sorry, key not found");
});
