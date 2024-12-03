import { MOCK_MEW_USER } from "@/app/auth/MewUser";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";

describe("GraphStore.setIsPublic", () => {
  let graphStore: GraphStore;

  let ancestorNode: GraphNode;
  let rootNode: GraphNode;
  let childNode: GraphNode;
  let grandChildNode: GraphNode;
  let relatedNonChildNode: GraphNode;

  let rootAncestorRel: GraphRelation;
  let rootChildRel: GraphRelation;
  let childGrandChildRel: GraphRelation;
  let rootRelatedRel: GraphRelation;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date(2024, 5, 4) });

    graphStore = new GraphStore(MOCK_MEW_USER);

    ancestorNode = await graphStore.addNode({
      nodeProps: {
        id: "ancestor",
      },
    });
    rootNode = await graphStore.addNode({
      nodeProps: {
        id: "root",
      },
    });
    childNode = await graphStore.addNode({
      nodeProps: {
        id: "child",
      },
    });
    grandChildNode = await graphStore.addNode({
      nodeProps: {
        id: "grand-child",
      },
    });
    relatedNonChildNode = await graphStore.addNode({
      nodeProps: {
        id: "related-non-child",
      },
    });

    rootAncestorRel = await graphStore.addRelation({
      id: "root-ancestor-rel",
      fromId: ancestorNode.id,
      toId: rootNode.id,
    });
    rootChildRel = await graphStore.addRelation({
      id: "root-child-rel",
      fromId: rootNode.id,
      toId: childNode.id,
    });
    childGrandChildRel = await graphStore.addRelation({
      id: "child-grand-child-rel",
      fromId: childNode.id,
      toId: grandChildNode.id,
    });
    rootRelatedRel = await graphStore.addRelation({
      id: "root-related-rel",
      fromId: rootNode.id,
      toId: relatedNonChildNode.id,
      relationType: graphStore.getRelationType("relatedTo"),
    });

    graphStore.updateManager.cleanup();
  });

  it("should be able to set the isPublic property of a node and a relation", async () => {
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: rootNode.id,
      isPublic: true,
      alsoSetRelatedObjects: false,
      alsoSetChildrenAndDescendants: false,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    expect(rootNode.isPublic).toBe(true);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: childNode.id,
      relationId: rootChildRel.id,
      isPublic: true,
      alsoSetRelatedObjects: false,
      alsoSetChildrenAndDescendants: false,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    expect(rootNode.isPublic).toBe(true);
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);
  });

  it("should be able to set isPublic for related objects", async () => {
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);
    expect(rootRelatedRel.relationType.id).not.toBe("child");

    await graphStore.setIsPublic({
      objectId: rootNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: false,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    // Direct object should be set
    expect(rootNode.isPublic).toBe(true);

    // Non-parent related objects should be set
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);
    expect(relatedNonChildNode.isPublic).toBe(true);
    expect(rootRelatedRel.isPublic).toBe(true);

    // Further descendants should *not* be set
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);

    // Parent related objects should *not* be set
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
  });

  it("should be able to set isPublic for children and descendants", async () => {
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);
    expect(rootRelatedRel.relationType.id).not.toBe("child");

    await graphStore.setIsPublic({
      objectId: rootNode.id,
      isPublic: true,
      alsoSetRelatedObjects: false,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    // Direct object should be set
    expect(rootNode.isPublic).toBe(true);

    // Children + descendents should be set
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);
    expect(grandChildNode.isPublic).toBe(true);
    expect(childGrandChildRel.isPublic).toBe(true);

    // Non-parent related objects should *not* be set
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    // Parent objects should *not* be set
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
  });

  it("should be able to combine setting isPublic for both related objects and children/descendants", async () => {
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: rootNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    // Direct object should be set
    expect(rootNode.isPublic).toBe(true);

    // Children + descendents should be set
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);
    expect(grandChildNode.isPublic).toBe(true);
    expect(childGrandChildRel.isPublic).toBe(true);

    // Non-parent related objects should be set
    expect(relatedNonChildNode.isPublic).toBe(true);
    expect(rootRelatedRel.isPublic).toBe(true);

    // ...only the parent objects should *not* be set
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
  });

  it("should have working revert logic", async () => {
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: childNode.id,
      relationId: rootChildRel.id,
      isPublic: true,
      alsoSetRelatedObjects: false,
      alsoSetChildrenAndDescendants: false,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    // These updated
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);

    // Everything else the same
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    graphStore.updateManager.revertAllPending();

    // Everything back to original state after revert
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: rootNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    // Everything but the parent objects updated
    expect(rootNode.isPublic).toBe(true);
    expect(childNode.isPublic).toBe(true);
    expect(rootChildRel.isPublic).toBe(true);
    expect(grandChildNode.isPublic).toBe(true);
    expect(childGrandChildRel.isPublic).toBe(true);
    expect(relatedNonChildNode.isPublic).toBe(true);
    expect(rootRelatedRel.isPublic).toBe(true);

    // Ancestors the same
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);

    graphStore.updateManager.revertAllPending();

    // Everything back again to original state after revert
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);
  });

  it("should be able to set isPublic and isNewRelatedObjectsPublic in parallel", async () => {
    expect(ancestorNode.isPublic).toBe(false);
    expect(rootAncestorRel.isPublic).toBe(false);
    expect(rootNode.isPublic).toBe(false);
    expect(childNode.isPublic).toBe(false);
    expect(rootChildRel.isPublic).toBe(false);
    expect(grandChildNode.isPublic).toBe(false);
    expect(childGrandChildRel.isPublic).toBe(false);
    expect(relatedNonChildNode.isPublic).toBe(false);
    expect(rootRelatedRel.isPublic).toBe(false);

    await graphStore.setIsPublic({
      objectId: childNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: true,
      isChecked: false
    });
    expect(childNode.isPublic).toBe(true);
    expect(childNode.isNewRelatedObjectsPublic).toBe(true);

    await graphStore.setIsPublic({
      objectId: childNode.id,
      isPublic: true,
      alsoSetRelatedObjects: true,
      alsoSetChildrenAndDescendants: true,
      isNewRelatedObjectsPublic: false,
      isChecked: false
    });

    expect(childNode.isPublic).toBe(true);
    expect(childNode.isNewRelatedObjectsPublic).toBe(false);
  });
});
