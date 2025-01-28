import { SearchTree } from "@/app/tree/SearchTree";
import { Path, Tree } from "@/app/tree/Tree";

export class QuickCaptureTree extends Tree {
  isGroupExpanded(path: Path): boolean {
    console.log(path, this.expansionsByPath.get(path) ?? !path.endsWith("pinned"));
    return this.expansionsByPath.get(path) ?? !path.endsWith("pinned");
  }
}
export class QuickCaptureSearchTree extends SearchTree {
  isGroupExpanded(path: Path): boolean {
    return this.expansionsByPath.get(path) ?? !path.endsWith("pinned");
  }
}
