import { Plus } from "lucide-react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { Tree } from "@/app/tree/Tree";

export function CreateNewButton({ tree }: { tree: Tree }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async (e) => {
        e.stopPropagation();
        await tree.createChildOfRootAndFocus();
      }}
    >
      <Plus size={16}></Plus>
    </Button>
  );
}
