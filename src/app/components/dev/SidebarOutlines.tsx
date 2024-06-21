import { observer } from "mobx-react-lite";

import { OutlineView } from "@/app/components/OutlineView";
import { useViewStore } from "@/app/view/useViewStore";

export const SidebarOutlines = observer(() => {
  const viewStore = useViewStore();
  return (
    <div>
      {viewStore.sidebarTrees.map((tree, i) => (
        <OutlineView key={i} tree={tree} />
      ))}
    </div>
  );
});
