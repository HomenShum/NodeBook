import { observer } from "mobx-react-lite";

import { OutlineView } from "@/app/components/OutlineView";
import { Tree } from "@/app/tree/Tree";

interface Props {
  tree: Tree;
}

export const MainView = observer(function MainView({ tree }: Props) {
  return <OutlineView tree={tree} />;
});
