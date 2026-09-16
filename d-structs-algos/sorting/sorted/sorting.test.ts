import { test, expect } from "@jest/globals";
import { Influencer, vanitySort } from "./sorting.js";

const theprimeagen = new Influencer(100, 1);
const pokimane = new Influencer(800, 2);
const spambot = new Influencer(0, 200);
const lane = new Influencer(10, 2);
const badcop = new Influencer(1, 2);

const cases: [Influencer[], Influencer[]][] = [
  [[badcop, lane], [badcop, lane]],
  [[lane, badcop, pokimane], [badcop, lane, pokimane]],
  [[spambot, theprimeagen], [theprimeagen, spambot]],
  [[], []],
  [[lane], [lane]],
  [
    [pokimane, theprimeagen, spambot, badcop, lane],
    [badcop, lane, theprimeagen, pokimane, spambot],
  ],
];

test.each(cases)("vanitySort orders by vanity (case %#)", (input, expected) => {
  expect(vanitySort(input)).toEqual(expected);
});
