import { observable, runInAction } from "mobx";

import { CappedKeywordIndex } from "@/lib/trie";

describe("CappedKeywordIndex", () => {
  let index: CappedKeywordIndex;

  beforeEach(() => {
    index = new CappedKeywordIndex(3); // maxPrefixLength of 3
  });

  afterEach(() => {
    index.clear();
  });

  test("add and getIds with single word", () => {
    const obj = observable({ text: "hello" });
    index.add("1", () => obj.text);

    expect(index.getIds("hel")).toEqual(["1"]);
    expect(index.getIds("hello")).toEqual(["1"]);
    expect(index.getIds("h")).toEqual(["1"]);
    expect(index.getIds("help")).toEqual(["1"]);
    expect(index.getIds("world")).toEqual([]);
  });

  test("add and getIds with multiple words", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("hel wor")).toEqual(["1"]);
    expect(index.getIds("hello world")).toEqual(["1"]);
    expect(index.getIds("h w")).toEqual(["1"]);
    expect(index.getIds("hello universe")).toEqual([]);
  });

  test("add multiple objects", () => {
    const obj1 = observable({ text: "hello world" });
    const obj2 = observable({ text: "hello universe" });
    index.add("1", () => obj1.text);
    index.add("2", () => obj2.text);

    expect(index.getIds("hel")).toContain("1");
    expect(index.getIds("hel")).toContain("2");
    expect(index.getIds("wor")).toEqual(["1"]);
    expect(index.getIds("uni")).toEqual(["2"]);
  });

  test("remove id from deep branch", () => {
    const index = new CappedKeywordIndex(5);
    const obj1 = observable({ text: "abcde fghij" });
    const obj2 = observable({ text: "abcde klmno" });
    index.add("1", () => obj1.text);
    index.add("2", () => obj2.text);

    index.delete("1");

    expect(index.getIds("abcde")).toEqual(["2"]);
    expect(index.getIds("fghij")).toEqual([]);
    expect(index.getIds("klmno")).toEqual(["2"]);
  });

  test("update object text", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("hel")).toEqual(["1"]);
    expect(index.getIds("uni")).toEqual([]);

    runInAction(() => {
      obj.text = "hello universe";
    });

    expect(index.getIds("wor")).toEqual([]);
    expect(index.getIds("uni")).toEqual(["1"]);
  });

  test("delete object", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("hel")).toEqual(["1"]);

    index.delete("1");

    expect(index.getIds("hel")).toEqual([]);
  });

  test("clear index", () => {
    const obj1 = observable({ text: "hello world" });
    const obj2 = observable({ text: "hello universe" });
    index.add("1", () => obj1.text);
    index.add("2", () => obj2.text);

    expect(index.getIds("hel")).toHaveLength(2);

    index.clear();

    expect(index.getIds("hel")).toEqual([]);
  });

  test("case insensitivity", () => {
    const obj = observable({ text: "Hello World" });
    index.add("1", () => obj.text);

    expect(index.getIds("hello")).toEqual(["1"]);
    expect(index.getIds("WORLD")).toEqual(["1"]);
    expect(index.getIds("HeLLo wOrLd")).toEqual(["1"]);
  });

  test("maxPrefixLength respect", () => {
    const index = new CappedKeywordIndex(2);
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("he")).toEqual(["1"]);
    expect(index.getIds("hel")).toEqual(["1"]); // still matches due to prefix
    expect(index.getIds("help")).toEqual(["1"]); // still matches due to prefix
    expect(index.getIds("wo")).toEqual(["1"]);
    expect(index.getIds("wor")).toEqual(["1"]); // still matches due to prefix
  });

  test("whitespace around query", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds(" hello ")).toEqual(["1"]);
    expect(index.getIds("  hello  world  ")).toEqual(["1"]);
  });

  test("empty query", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("")).toEqual([]);
  });

  test("query with only spaces", () => {
    const obj = observable({ text: "hello world" });
    index.add("1", () => obj.text);

    expect(index.getIds("   ")).toEqual([]);
  });
});
