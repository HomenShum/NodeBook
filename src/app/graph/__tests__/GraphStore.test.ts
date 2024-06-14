import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";

describe("GraphStore", () => {
  describe("initializataion", () => {
    it("should initialize with a user root, outline root, and thoughtstream root", () => {
      const settingsStore = new SettingsStore();
      const graphStore = new GraphStore(settingsStore);
      expect(graphStore.userRoot).toBeDefined();
      expect(graphStore.outlineRoot).toBeDefined();
      expect(graphStore.thoughtstreamRoot).toBeDefined();
    });
  });
});
