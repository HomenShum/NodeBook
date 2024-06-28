import { LexicalEditor } from "lexical";
import { makeAutoObservable } from "mobx";

import { Path } from "@/app/graph/GraphStore";
import { makeAutoSaving } from "@/app/util";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "RenderController" });

export class RenderController {
  public focusedNode: Path | null = null;
  public hoveredNode: Path | null = null;

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Path[] = [];

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public isDarkMode = false;

  constructor() {
    makeAutoObservable(this);
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      isDarkMode: true,
    });
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  setHoveredNode(path: Path | null) {
    this.hoveredNode = path;
  }

  registerEditor(pathStr: Path, editor: LexicalEditor) {
    this.editorsByPath.set(pathStr, editor);
  }

  removeEditor(pathStr: Path) {
    this.editorsByPath.delete(pathStr);
  }
}
