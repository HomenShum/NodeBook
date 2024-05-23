import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { ViewType } from "../controller/ViewController";
import { GraphObject } from "../model/GraphObject";
import { useGraphStore } from "../model/useGraphStore";
import { useCurView } from "../util";

const TreeElement = observer(({ object }: { object: GraphObject }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div>
      <div className="flex items-center text-gray-500">
        <Play
          size={8}
          fill="currentColor"
          className={cn(isExpanded && "rotate-90", "min-w-4")}
          onClick={() => setIsExpanded(!isExpanded)}
        />
        <div className="ml-1 truncate">{object.text}</div>
      </div>
      <div className="pl-2">
        {isExpanded && object.children.map((o) => <TreeElement object={o} key={o.id}></TreeElement>)}
      </div>
    </div>
  );
});

export default observer(() => {
  const graphStore = useGraphStore();
  const curView = useCurView();
  const root = curView === ViewType.THOUGHTSTREAM ? graphStore.thoughtstreamRoot! : graphStore.outlineRoot!;
  return (
    <div className="ml-2">
      <TreeElement object={root}></TreeElement>
    </div>
  );
});
