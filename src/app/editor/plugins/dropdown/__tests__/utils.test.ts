import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { getMatches } from "@/app/editor/plugins/dropdown/utils";

// Mock the GraphStore
jest.mock("@/app/contexts/GraphStoreContext", () => ({
  useGraphStore: jest.fn(),
}));

describe("getMatches", () => {
  const mockGraphStore = {
    search: jest.fn(),
  };

  beforeEach(() => {
    (useGraphStore as jest.Mock).mockReturnValue(mockGraphStore);
  });

  const SEARCH_TERM = "test";

  it("should return matches sorted correctly", () => {
    const maxResults = 10;

    const mockNodes = [
      { id: "nodeA", text: `${SEARCH_TERM} node A`, createdAt: new Date(2023, 0, 1) },
      { id: "nodeB", text: `${SEARCH_TERM} node B`, createdAt: new Date(2023, 0, 2) },
      { id: "nodeC", text: `${SEARCH_TERM} node C`, createdAt: new Date(2023, 0, 2) },
    ];
    const mockRelations = [
      { id: "relAB", from: { id: "nodeA" }, to: { id: "nodeB" }, createdAt: new Date(2023, 0, 3) },
      { id: "relYZ", from: { id: "nodeY" }, to: { id: "nodeZ" }, createdAt: new Date(2023, 0, 3) },
    ];
    const mockRelationTypes = [
      {
        id: "relTypeA",
        label: `${SEARCH_TERM} forward`,
        reverseLabel: `${SEARCH_TERM} reverse`,
        createdAt: new Date(2023, 0, 4),
      },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: mockNodes.map((node) => ({ node, score: 0.5 })),
      relations: mockRelations.map((relation) => ({ relation, score: 0.6 })),
      relationTypes: mockRelationTypes.map((relationType) => ({ relationType, score: 0.7 })),
    });

    // @ts-ignore: Suppress type error for mockGraphStore
    const matches = getMatches(mockGraphStore, SEARCH_TERM, undefined, maxResults);

    expect(matches).toHaveLength(7);
    const expectedMatchIds = ["relTypeA", "relTypeA-rev", "relYZ", "nodeB", "nodeC", "nodeA", "relAB"];
    expect(matches.map((match) => match.key)).toEqual(expectedMatchIds);
  });

  it("should respect maxResults", () => {
    const maxResults = 2;

    const mockNodes = [
      { id: "node1", text: `${SEARCH_TERM} node 1`, createdAt: new Date(2023, 0, 1) },
      { id: "node2", text: `${SEARCH_TERM} node 2`, createdAt: new Date(2023, 0, 2) },
      { id: "node3", text: `${SEARCH_TERM} node 3`, createdAt: new Date(2023, 0, 3) },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: mockNodes.map((node) => ({ node, score: 1 })),
      relations: [],
      relationTypes: [],
    });

    // @ts-ignore: Suppress type error for mockGraphStore
    const matches = getMatches(mockGraphStore, SEARCH_TERM, undefined, maxResults);

    expect(matches).toHaveLength(2);
  });

  it("should handle empty search results", () => {
    const maxResults = 10;

    mockGraphStore.search.mockReturnValue({
      nodes: [],
      relations: [],
      relationTypes: [],
    });

    // @ts-ignore: Suppress type error for mockGraphStore
    const matches = getMatches(mockGraphStore, SEARCH_TERM, undefined, maxResults);

    expect(matches).toHaveLength(0);
  });
});
