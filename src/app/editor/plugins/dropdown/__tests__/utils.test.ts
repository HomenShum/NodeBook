import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { getMatches } from "@/app/editor/plugins/dropdown/utils";
import { GraphStore } from "@/app/graph/GraphStore";

// Mock the GraphStore
jest.mock("@/app/contexts/GraphStoreContext", () => ({
  useGraphStore: jest.fn(),
}));

describe("getMatches", () => {
  const mockGraphStore = {
    search: jest.fn(),
    getRelations: jest.fn(),
    user: { id: "testUserId" },
  };

  beforeEach(() => {
    (useGraphStore as jest.Mock).mockReturnValue(mockGraphStore);
    mockGraphStore.search.mockReset();
    mockGraphStore.getRelations.mockReset();
  });

  const SEARCH_TERM = "test";
  const SEARCH_TYPES_FILTER = undefined;

  it("should return matches sorted correctly", () => {
    const maxResults = 10;

    const mockNodes = [
      {
        id: "nodeA",
        text: `${SEARCH_TERM} node A`,
        createdAt: new Date(2023, 0, 1),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "nodeB",
        text: `${SEARCH_TERM} node B`,
        createdAt: new Date(2023, 0, 2),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "nodeC",
        text: `${SEARCH_TERM} node C`,
        createdAt: new Date(2023, 0, 2),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
    ];
    const mockRelations = [
      {
        id: "relAB",
        from: { id: "nodeA" },
        to: { id: "nodeB" },
        createdAt: new Date(2023, 0, 3),
        relationType: { id: "ABC" },
      },
      {
        id: "relYZ",
        from: { id: "nodeY" },
        to: { id: "nodeZ" },
        createdAt: new Date(2023, 0, 3),
        relationType: { id: "ABC" },
      },
    ];
    const mockRelationTypes = [
      {
        id: "ABC",
        label: `${SEARCH_TERM} forward`,
        reverseLabel: `${SEARCH_TERM} reverse`,
        createdAt: new Date(2023, 0, 4),
        authorId: "testUserId",
      },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: mockNodes.map((node) => ({ node, score: 0.5 })),
      relations: mockRelations.map((relation) => ({ relation, score: 0.6 })),
      relationTypes: mockRelationTypes.map((relationType) => ({ relationType, score: 0.7 })),
    });
    mockGraphStore.getRelations.mockReturnValue(mockRelations);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, SEARCH_TERM, SEARCH_TYPES_FILTER, maxResults);

    expect(matches).toHaveLength(7);
    const expectedMatchIds = ["ABC-rel-type", "ABC-rel-type-rev", "relYZ", "nodeB", "nodeC", "nodeA", "relAB"];
    expect(matches.map((match) => match.key)).toEqual(expectedMatchIds);
  });

  it("should respect maxResults", () => {
    const maxResults = 2;

    const mockNodes = [
      {
        id: "node1",
        text: `${SEARCH_TERM} node 1`,
        createdAt: new Date(2023, 0, 1),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "node2",
        text: `${SEARCH_TERM} node 2`,
        createdAt: new Date(2023, 0, 2),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "node3",
        text: `${SEARCH_TERM} node 3`,
        createdAt: new Date(2023, 0, 3),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: mockNodes.map((node) => ({ node, score: 1 })),
      relations: [],
      relationTypes: [],
    });
    mockGraphStore.getRelations.mockReturnValue([]);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, SEARCH_TERM, SEARCH_TYPES_FILTER, maxResults);

    expect(matches).toHaveLength(2);
  });

  it("should handle empty search results", () => {
    const maxResults = 10;

    mockGraphStore.search.mockReturnValue({
      nodes: [],
      relations: [],
      relationTypes: [],
    });
    mockGraphStore.getRelations.mockReturnValue([]);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, SEARCH_TERM, SEARCH_TYPES_FILTER, maxResults);

    expect(matches).toHaveLength(0);
  });

  it("should sort nodes with more relations first", () => {
    const maxResults = 10;

    const mockNodes = [
      {
        id: "node1",
        text: `${SEARCH_TERM} node 1`,
        createdAt: new Date(2023, 0, 1),
        relations: [],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "node2",
        text: `${SEARCH_TERM} node 2`,
        createdAt: new Date(2023, 0, 2),
        relations: [{ id: "rel1" }, { id: "rel2" }],
        noteContentRelationsList: { size: 0 },
      },
      {
        id: "node3",
        text: `${SEARCH_TERM} node 3`,
        createdAt: new Date(2023, 0, 3),
        relations: [{ id: "rel2" }],
        noteContentRelationsList: { size: 0 },
      },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: mockNodes.map((node) => ({ node, score: 1 })),
      relations: [],
      relationTypes: [],
    });
    mockGraphStore.getRelations.mockReturnValue([]);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, SEARCH_TERM, SEARCH_TYPES_FILTER, maxResults);

    expect(matches.map((match) => match.key)).toEqual(["node2", "node3", "node1"]);
  });

  it("should prefer user's own relation types over others with same label", () => {
    const maxResults = 10;
    const userRelationType = {
      id: "user-rel-type",
      label: "test label",
      reverseLabel: "test reverse",
      authorId: "testUserId",
    };
    const otherRelationType = {
      id: "other-rel-type",
      label: "test label",
      reverseLabel: "test reverse",
      authorId: "otherId",
    };

    // Mock relations to make the other relation type have more relations
    const mockRelations = [
      { id: "rel1", relationType: { id: "other-rel-type" } },
      { id: "rel2", relationType: { id: "other-rel-type" } },
      { id: "rel3", relationType: { id: "user-rel-type" } },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: [],
      relations: [],
      relationTypes: [
        { relationType: otherRelationType, score: 1 },
        { relationType: userRelationType, score: 1 },
      ],
    });
    mockGraphStore.getRelations.mockReturnValue(mockRelations);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, "test", SEARCH_TYPES_FILTER, maxResults);

    // User's relation type should be preferred even though other has more relations
    expect(matches.map((match) => match.key)).toEqual(["user-rel-type-rel-type", "user-rel-type-rel-type-rev"]);
  });

  it("should prefer relation type with more relations when neither belongs to user", () => {
    const maxResults = 10;
    const relationType1 = {
      id: "rel-type-1",
      label: "test label",
      reverseLabel: "test reverse",
      authorId: "otherUser1",
    };
    const relationType2 = {
      id: "rel-type-2",
      label: "test label",
      reverseLabel: "test reverse",
      authorId: "otherUser2",
    };

    // Mock relations to make relationType1 have more relations
    const mockRelations = [
      { id: "rel1", relationType: { id: "rel-type-1" } },
      { id: "rel2", relationType: { id: "rel-type-1" } },
      { id: "rel3", relationType: { id: "rel-type-2" } },
    ];

    mockGraphStore.search.mockReturnValue({
      nodes: [],
      relations: [],
      relationTypes: [
        { relationType: relationType2, score: 1 },
        { relationType: relationType1, score: 1 },
      ],
    });
    mockGraphStore.getRelations.mockReturnValue(mockRelations);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, "test", SEARCH_TYPES_FILTER, maxResults);

    // Relation type with more relations should be preferred
    expect(matches.map((match) => match.key)).toEqual(["rel-type-1-rel-type", "rel-type-1-rel-type-rev"]);
  });

  it("should handle different labels independently when deduplicating relation types", () => {
    const maxResults = 10;
    const relationType1 = {
      id: "rel-type-1",
      label: "test label 1",
      reverseLabel: "test reverse 1",
      authorId: "otherUser1",
    };
    const relationType2 = {
      id: "rel-type-2",
      label: "test label 2",
      reverseLabel: "test reverse 2",
      authorId: "otherUser2",
    };

    mockGraphStore.search.mockReturnValue({
      nodes: [],
      relations: [],
      relationTypes: [
        { relationType: relationType1, score: 1 },
        { relationType: relationType2, score: 1 },
      ],
    });
    mockGraphStore.getRelations.mockReturnValue([
      { id: "rel1", relationType: { id: "rel-type-1" } },
      { id: "rel2", relationType: { id: "rel-type-2" } },
    ]);

    const matches = getMatches(mockGraphStore as unknown as GraphStore, "test", SEARCH_TYPES_FILTER, maxResults);

    // Both relation types should appear since they have different labels
    expect(matches.map((match) => match.key)).toEqual([
      "rel-type-2-rel-type",
      "rel-type-1-rel-type",
      "rel-type-1-rel-type-rev",
      "rel-type-2-rel-type-rev",
    ]);
  });
});
