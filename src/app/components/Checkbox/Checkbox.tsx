import React from "react";
import { observer } from "mobx-react-lite";

import { TreeNode } from "@/app/tree/nodes";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";

import styles from "./Checkbox.module.css";

interface Props {
  node: TreeNode
}

export const Checkbox = observer(function Checkbox({node}: Props) {

  const graphStore = useGraphStore();

  if(!(node.object instanceof GraphNode) || node.object.isChecked === null) return <></>

  const handleOnChange = async () => {
    await graphStore.updateNode({
      nodeId: node.object.id,
      nodeProps: {
        isChecked: node.object instanceof GraphNode ? !node.object.isChecked : null
      }
    })
  }

  return (
    <div className={styles.CheckboxWrapper}>
      <div className={styles.CheckboxRound}>
        <input checked={node.object.isChecked} onChange={handleOnChange} type="checkbox" id={`checkbox_${node.id}`} />
        <label htmlFor={`checkbox_${node.id}`}></label>
      </div>
    </div>
  );
});