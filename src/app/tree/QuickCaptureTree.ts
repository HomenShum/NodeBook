import { SearchTree } from "@/app/tree/SearchTree";
import { Filter, Path, Tree } from "@/app/tree/Tree";

export class QuickCaptureTree extends Tree {
  isGroupExpanded(path: Path): boolean {
    return this.expansionsByPath.get(path) ?? !path.endsWith("pinned");
  }

  get filter(): Filter {
    // Create a clean Filter object that only includes properties from the base Filter type
    return {
      ...super.filter,
      // Override the showOnlyTodos to use the quick capture specific setting
      showOnlyTodos: this.settingsStore.showOnlyTodosInQuickCapture,
    };
  }
}

export class QuickCaptureSearchTree extends SearchTree {
  isGroupExpanded(path: Path): boolean {
    return this.expansionsByPath.get(path) ?? !path.endsWith("pinned");
  }

  get filter(): Filter {
    // Create a clean Filter object that only includes properties from the base Filter type
    return {
      ...super.filter,
      // Override the showOnlyTodos to use the quick capture specific setting
      showOnlyTodos: this.settingsStore.showOnlyTodosInQuickCapture,
    };
  }
}
