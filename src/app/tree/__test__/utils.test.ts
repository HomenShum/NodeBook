import { createTestTreeFromTemplate, TemplateNode } from "@/app/tree/__test__/helpers";
import { getSubtreesBetween } from "@/app/tree/utils";
import appLogger from "@/lib/logger";

describe("Tree utils", () => {
  beforeAll(() => {
    appLogger.setGlobalConsoleFilter({ level: "info" });
  });
  describe("getSubtreesBetween", () => {
    const subtreesMatchWithSelection = async (template: TemplateNode[], expectedOutput: string[]) => {
      const tree = await createTestTreeFromTemplate(template);
      if (!tree.selectionWithNodes) {
        fail("selectionWithNodes cannot be empty");
      }
      const { top, bottom } = tree.selectionWithNodes;
      return expect(getSubtreesBetween(top, bottom).map((node) => node.relationWithParent.id)).toEqual(expectedOutput);
    };
    it("head is ancestor of anchor", async () => {
      const template = [
        { rid: "1", isHead: true, children: [{ rid: "2", isAnchor: true }, { rid: "3" }] },
        {
          rid: "4",
        },
      ];
      await subtreesMatchWithSelection(template, ["1"]);
    });
    it("head and anchor share a parent", async () => {
      const template = [
        { rid: "1", isHead: true },
        {
          rid: "2",
          children: [{ rid: "3" }, { rid: "4" }],
        },
        { rid: "5", children: [{ rid: "6" }] },
        { rid: "7", isAnchor: true },
      ];
      await subtreesMatchWithSelection(template, ["1", "2", "5", "7"]);
    });
    it("head is outside the anchor subtree", async () => {
      const template = [
        { rid: "1" },
        { rid: "2", children: [{ rid: "3", isAnchor: true }, { rid: "4" }] },
        { rid: "5", children: [{ rid: "6" }] },
        { rid: "7", isHead: true },
        { rid: "cats are cool" },
      ];
      await subtreesMatchWithSelection(template, ["3", "4", "5", "7"]);
    });
    it("anchor is a descendant of a sibling of head", async () => {
      const template = [
        { rid: "1" },
        { rid: "2", isHead: true, children: [{ rid: "3" }] },
        { rid: "5", children: [{ rid: "6", isAnchor: true }] },
        { rid: "7" },
        { rid: "cats are cool" },
      ];
      await subtreesMatchWithSelection(template, ["2", "5"]);
    });
  });
});
