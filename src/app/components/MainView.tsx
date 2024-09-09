import { observer } from "mobx-react-lite";

import { OutlineView } from "@/app/components/OutlineView";
import { Tree } from "@/app/tree/Tree";

export const MainView = observer(({ tree }: { tree: Tree }) => {
      return <OutlineView tree={tree} />;
});