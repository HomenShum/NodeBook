import { scoreMatch } from "@/lib/utils";

describe("scoreMatch", () => {
  it("should return 1 for exact matches", () => {
    expect(scoreMatch("hello", "hello")).toBe(1);
    expect(scoreMatch("hello", "HELLO")).toBe(1);
    expect(scoreMatch("hello", " hello ")).toBe(1);
    expect(scoreMatch("hello", " hello")).toBe(1);
    expect(scoreMatch("hello", "hello ")).toBe(1);
  });

  it("should return 0 for no matches", () => {
    expect(scoreMatch("hello", "world")).toBe(0);
    expect(scoreMatch("hello", "world ")).toBe(0);
    expect(scoreMatch("hello", " world")).toBe(0);
  });

  it("should rank partial matches by where the query appears in the text", () => {
    // check order of matches
    const query = "hello";
    const texts = ["hello", "hello world", "world hello", "world and helloe"];
    expect(texts.sort((a, b) => scoreMatch(b, query) - scoreMatch(a, query))).toEqual(texts);
  });

  it("should prefer shorter matches", () => {
    const query = "hel";
    const texts = ["hello", "hello world"];
    const scores = texts.map((text) => scoreMatch(text, query));
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });
});
