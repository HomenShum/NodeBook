import { Chip } from "@/app/graph/GraphNode";
import { sliceChips } from "@/app/graph/utils";

describe("sliceChips", () => {
  it("should return empty array for empty input", () => {
    expect(sliceChips([], 0, 1)).toEqual([]);
  });

  it("should handle basic text slicing", () => {
    const chips: Chip[] = [{ type: "text", value: "hello world" }];
    expect(sliceChips(chips, 0, 5)).toEqual([{ type: "text", value: "hello" }]);
  });

  it("should handle negative indices", () => {
    const chips: Chip[] = [{ type: "text", value: "hello world" }];
    expect(sliceChips(chips, -5)).toEqual([{ type: "text", value: "world" }]);
  });

  it("should delete mention atomically", () => {
    const chips: Chip[] = [
      { type: "text", value: "hello " },
      { type: "mention", value: "user-id" },
    ];
    expect(sliceChips(chips, 0, -1)).toEqual([{ type: "text", value: "hello " }]);
  });

  it("should handle mentions as length 1", () => {
    const chips: Chip[] = [
      { type: "text", value: "hello " },
      { type: "mention", value: "user-id" },
      { type: "text", value: " world" },
    ];
    expect(sliceChips(chips, 4, 8)).toEqual([
      { type: "text", value: "o " },
      { type: "mention", value: "user-id" },
      { type: "text", value: " " },
    ]);
  });

  it("should handle links with protocols", () => {
    const chips: Chip[] = [
      {
        type: "link",
        value: "example.com",
        url: "https://example.com",
      },
    ];
    expect(sliceChips(chips, 0, 7)).toEqual([
      {
        type: "link",
        value: "example",
        url: "https://example",
      },
    ]);
  });

  it("should handle multiple chip types", () => {
    const chips: Chip[] = [
      { type: "text", value: "hello " },
      { type: "linebreak", value: "\n" },
      { type: "text", value: "world" },
    ];
    expect(sliceChips(chips, 3, 8)).toEqual([
      { type: "text", value: "lo " },
      { type: "linebreak", value: "\n" },
      { type: "text", value: "w" },
    ]);
  });

  it("should return empty array when start >= end", () => {
    const chips: Chip[] = [{ type: "text", value: "hello" }];
    expect(sliceChips(chips, 3, 2)).toEqual([]);
  });
});
