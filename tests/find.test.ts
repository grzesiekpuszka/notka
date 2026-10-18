// @vitest-environment jsdom
import { expect, test } from "vitest";
import { findRanges, MAX_MATCHES } from "../src/find";

test("finds case-insensitively across elements", () => {
  const root = document.createElement("div");
  root.innerHTML = "<p>Foo <b>foo</b> FOO</p>";
  const ranges = findRanges(root, "foo");
  expect(ranges).toHaveLength(3);
  expect(ranges.map((r) => r.toString())).toEqual(["Foo", "foo", "FOO"]);
});

test("empty query finds nothing", () => {
  const root = document.createElement("div");
  root.innerHTML = "<p>Foo</p>";
  expect(findRanges(root, "")).toHaveLength(0);
});

test("caps the number of matches", () => {
  const root = document.createElement("div");
  root.textContent = "a".repeat(20_000);
  expect(findRanges(root, "a")).toHaveLength(MAX_MATCHES);
});
