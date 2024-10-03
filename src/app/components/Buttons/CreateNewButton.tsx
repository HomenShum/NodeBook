import { Plus } from "lucide-react";

import { Tree } from "@/app/tree/Tree";
import { Button } from "@/app/components/UIPrimitives/Button";

export function CreateNewButton({ tree }: { tree: Tree }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        await tree.createChildOfRootAndFocus();
      }}
    >
      <Plus size={16}></Plus>
    </Button>
  );
}
