import React from "react";
import { observer } from "mobx-react-lite";

import { useViewStore } from "@/app/view/useViewStore";
import OutlineContent from "@/app/components/OutlineContent";
import s from "@/app/components/RightSidebar/RightSidebar.module.css";

const RightSidebar = observer(function RightSidebar() {
  const viewStore = useViewStore();

  if (!viewStore.rightSidebarOpen) return <></>;

  return (
    <div className={s.RightSidebar}>
      {viewStore.sidebarTrees.map((tree) => (
        <OutlineContent key={tree.id} tree={tree} />
      ))}
    </div>
  );
});

export default RightSidebar;
