import { generateIndex, generateNIndex, parseIndex } from "./fracIndex"; // Adjust the import path as necessary

function expectValidIndices(...indices: string[]) {
  indices.forEach((index) => {
    const parts = parseIndex(index);
    expect(parts.length).toBe(3);
    expect(parts[0]).toHaveLength(10);
    expect(parts[2]).toHaveLength(4);
  });
}

describe("Index Generation", () => {
  describe("generateIndex", () => {
    test("should generate a valid index", () => {
      expectValidIndices(generateIndex());
    });
  });

  describe("generateNIndex", () => {
    test("should generate multiple valid ordered indices", () => {
      const indices = generateNIndex(3);
      expect(indices.length).toBe(3);
      expectValidIndices(...indices);
      expect(indices.slice().sort()).toEqual(indices);
    });
    test("should generate multiple indices between two given indices", () => {
      const [start, end] = generateNIndex(2);
      const indices = generateNIndex(3, start, end);
      expect([start, end, ...indices].sort()).toEqual([start, ...indices, end]);
    });
    test("should handle null start and end parameters", () => {
      const indices = generateNIndex(3, null, null);
      expect(indices.length).toBe(3);
      expect(indices.slice().sort()).toEqual(indices);
    });
  });

  describe("Error Handling", () => {
    test("should throw error for incorrect index format", () => {
      expect(() => parseIndex("incorrect-format")).toThrow("Index should have 3 dash separated parts");
    });

    test("should throw error for incorrect time part length", () => {
      expect(() => parseIndex("12345-a0-4929")).toThrow("Time part should have length 10");
    });

    test("should throw error for incorrect random part length", () => {
      expect(() => parseIndex("1234567890-a0-XYZ")).toThrow("Random part should have length 4");
    });
  });
});
