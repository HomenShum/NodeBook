import { observer } from "mobx-react-lite";

import NodeAgentInterface from "@/app/query/page";
import { NodeAgentEmbeddingContext } from "@/app/query/NodeAgentEmbeddingContext";
import { useViewStore } from "@/app/view/useViewStore";

const AiSearchSidebar = observer(function AiSearchSidebar() {
  const viewStore = useViewStore();
  if (!viewStore.aiSearchStore.isSidebarOpen) return null;
  return <NodeAgentEmbeddingContext.Provider value><NodeAgentInterface /></NodeAgentEmbeddingContext.Provider>;
});

export default AiSearchSidebar;
