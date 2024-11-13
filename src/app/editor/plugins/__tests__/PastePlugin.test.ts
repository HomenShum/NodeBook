import { getDepthFromTextOffset, getLinesFromPlainText, normalizeDepth } from "@/app/editor/plugins/PastePlugin";

const INDENTED_TEXT = `1
			2
				3
	4
5`;

describe("PastePlugin", () => {
  it("should get depth from text offset correctly", () => {
    const { depth, remainingText } = getDepthFromTextOffset("\t123");
    expect(depth).toBe(1);
    expect(remainingText).toBe("123");
  });
  it("should get depth from text offset correctly", () => {
    const { depth, remainingText } = getDepthFromTextOffset("    123\t123"); // 4 spaces = 2 tabs
    expect(depth).toBe(2);
    expect(remainingText).toBe("123\t123");
  });

  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [] },
      { depth: 1, chips: [] },
      { depth: 2, chips: [] },
      { depth: 1, chips: [] },
      { depth: 0, chips: [] },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [] },
      { depth: 1, chips: [] },
      { depth: 2, chips: [] },
      { depth: 1, chips: [] },
      { depth: 0, chips: [] },
    ]);
  });
  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [] },
      { depth: 2, chips: [] },
      { depth: 4, chips: [] },
      { depth: 2, chips: [] },
      { depth: 0, chips: [] },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [] },
      { depth: 1, chips: [] },
      { depth: 2, chips: [] },
      { depth: 1, chips: [] },
      { depth: 0, chips: [] },
    ]);
  });
  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [] },
      { depth: 4, chips: [] },
      { depth: 4, chips: [] },
      { depth: 0, chips: [] },
      { depth: 0, chips: [] },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [] },
      { depth: 1, chips: [] },
      { depth: 1, chips: [] },
      { depth: 0, chips: [] },
      { depth: 0, chips: [] },
    ]);
  });

  it("should parse text and normalize depth", () => {
    const lines = getLinesFromPlainText(INDENTED_TEXT, false);
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { chips: [{ type: "text", value: "1" }], depth: 0 },
      { chips: [{ type: "text", value: "2" }], depth: 1 },
      { chips: [{ type: "text", value: "3" }], depth: 2 },
      { chips: [{ type: "text", value: "4" }], depth: 1 },
      { chips: [{ type: "text", value: "5" }], depth: 0 },
    ]);
  });
});
