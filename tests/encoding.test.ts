import { expect, test } from "vitest";
import { decode, encode } from "../electron/encoding";

test("round-trips utf8bom crlf", () => {
  const b = Buffer.from("﻿a\r\nż\r\n");
  const { text, meta } = decode(b);
  expect(meta).toEqual({ encoding: "utf8bom", eol: "\r\n" });
  expect(text).toBe("a\nż\n");
  expect(encode(text.replace("a", "b"), meta)).toEqual(Buffer.from("﻿b\r\nż\r\n"));
});

test("plain utf8 lf", () => {
  expect(decode(Buffer.from("x\ny"))).toEqual({ text: "x\ny", meta: { encoding: "utf8", eol: "\n" } });
});

test("utf16le with bom", () => {
  const b = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
  const { text, meta } = decode(b);
  expect(text).toBe("A");
  expect(meta.encoding).toBe("utf16le");
  expect(encode("A", meta)).toEqual(b);
});

test("utf16be with bom", () => {
  const b = Buffer.from([0xfe, 0xff, 0x00, 0x41]);
  const { text, meta } = decode(b);
  expect(text).toBe("A");
  expect(meta.encoding).toBe("utf16be");
  expect(encode("A", meta)).toEqual(b);
});

test("cp1250 fallback", () => {
  const { text, meta } = decode(Buffer.from([0xb9, 0x9c]));
  expect(text).toBe("ąś");
  expect(meta.encoding).toBe("cp1250");
  expect(encode("ąś", meta)).toEqual(Buffer.from("ąś"));
});
