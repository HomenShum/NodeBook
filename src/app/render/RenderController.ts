import { LexicalEditor } from "lexical";
import { isObservable, makeAutoObservable } from "mobx";

import { Path } from "@/app/tree/Tree";
import { makeAutoSaving } from "@/app/util";

export class RenderController {
  public focusedNode: Path | null = null;
  public hoveredNode: Path | null = null;

  editorsByPath: Map<string, LexicalEditor> = new Map();

  public selectedNodes: Path[] = [];

  public leftSidebarOpen = false;
  public rightSidebarOpen = false;
  public isDarkMode = false;
  public sidebarWidth = 268;
  public activeModal: "devTools" | "importData" | "clearData" | null = null;

  constructor() {
    this.makeObservable();
    makeAutoSaving(this, {
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      isDarkMode: true,
      sidebarWidth: true,
      activeModal: true,
    });
  }

  makeObservable() {
    if (isObservable(this)) return;
    makeAutoObservable(this);
  }

  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
  }

  setActiveModal(modal: "devTools" | "importData" | "clearData" | null) {
    this.activeModal = modal;
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

  setSidebarWidth(width: number) {
    this.sidebarWidth = width;
  }

  cleanup() {
    this.setActiveModal(null);
  }
}
