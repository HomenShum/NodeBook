import { generatePositionsForInsert } from "@/app/graph/FractionalPositionedList";
import { comparePositions, Position } from "@/app/util";

function expectUniquePositions(positions: Position[]) {
  expect(new Set(positions.map((p) => p.int + p.frac)).size).toBe(positions.length);
}

function expectPositionsSorted(positions: Position[]) {
  expect(positions).toEqual(positions.sort((a, b) => comparePositions(a, b)));
}

describe("insertPositions", () => {
  it("should insert positions into an empty list", () => {
    const result = generatePositionsForInsert([], 0, 3);
    expect(result.addedPositions.length).toBe(3);
    expect(result.updatedPositions.size).toBe(0);
    expect(result.addedPositions).toEqual(result.addedPositions.sort((a, b) => comparePositions(a, b)));
  });

  it("should insert positions after a specified index", () => {
    const items = [
      { id: "1", position: { int: 1000, frac: "a0" } },
      { id: "2", position: { int: 1000, frac: "a1" } },
    ];
    const result = generatePositionsForInsert(items, 0, 1);
    const expectedOrder = [items[0].position, ...result.addedPositions];
    expectPositionsSorted(expectedOrder);
    expectUniquePositions(expectedOrder);
    expect(result.updatedPositions.size).toBe(0);
  });
  it("should handle insertion between items with different integer parts", () => {
    const items = [
      { id: "1", position: { int: 1000, frac: "a0" } },
      { id: "2", position: { int: 1001, frac: "a0" } },
    ];
    const result = generatePositionsForInsert(items, 0, 1);
    const expectedOrder = [items[0].position, ...result.addedPositions, items[1].position];
    expectPositionsSorted(expectedOrder);
    expectUniquePositions(expectedOrder);
    expect(result.updatedPositions.size).toBe(0);
  });

  it("should update subsequent positions when necessary", () => {
    const items = [
      { id: "1", position: { int: 1000, frac: "a0" } },
      { id: "2", position: { int: 1000, frac: "a0" } },
      { id: "3", position: { int: 1000, frac: "a0" } },
    ];
    const result = generatePositionsForInsert(items, 0, 1);
    const expectedOrder = [
      items[0].position,
      ...result.addedPositions,
      ...items.slice(1).map(({ id }) => result.updatedPositions.get(id)!),
    ];
    expectPositionsSorted(expectedOrder);
    expectUniquePositions(expectedOrder);
  });

  it("should handle insertion at the end of the list", () => {
    const items = [{ id: "1", position: { int: 1000, frac: "a1" } }];
    const result = generatePositionsForInsert(items, 0, 2);
    const expectedOrder = [items[0].position, ...result.addedPositions];
    expectPositionsSorted(expectedOrder);
    expectUniquePositions(expectedOrder);
  });

  it("should throw an error for out of bounds index", () => {
    const items = [{ id: "1", position: { int: 1000, frac: "a0" } }];
    expect(() => generatePositionsForInsert(items, 1, 1)).toThrow();
    expect(() => generatePositionsForInsert(items, -1, 1)).toThrow();
  });

  it("should throw an error for non-positive number of positions", () => {
    const items = [{ id: "1", position: { int: 1000, frac: "a0" } }];
    expect(() => generatePositionsForInsert(items, 0, 0)).toThrow();
    expect(() => generatePositionsForInsert(items, 0, -1)).toThrow();
  });
});
