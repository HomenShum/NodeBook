import { observer } from "mobx-react-lite";

import { OutlineView } from "@/app/components/OutlineView";
import { useViewStore } from "@/app/view/useViewStore";

export const SidebarOutlines = observer(() => {
  const viewStore = useViewStore();
  return (
    <div>
      {viewStore.sidebarOutlineViews.map((outline, i) => (
        <OutlineView key={i} outline={outline} />
      ))}
    </div>
  );
});
