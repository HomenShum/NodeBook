import { useContext } from "react";
import { observer } from "mobx-react-lite";
import { GraphStoreContext } from "../store/graph";
import { GraphNode } from "../model/GraphNode";

function relationsFromNodesPerspective(node: GraphNode) {
  return node.relations.map((relation) => {
    if (relation.from.id === node.id) {
      return {
        id: relation.id,
        to: relation.to,
        type: relation.type,
        label: relation.type.label,
      };
    } else {
      return {
        id: relation.id,
        to: relation.from,
        type: relation.type,
        label: relation.type.reverseLabel || "reverse:" + relation.type.label,
      };
    }
  });
}

export const NodeTable = observer(() => {
  const nodeStore = useContext(GraphStoreContext);
  const headers = ["id", "text", "relations"];
  const nodes = nodeStore?.nodes || [];

  return (
    <div className="p-2">
      <h1>Node Table</h1>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.id}>
              <td>{node.id}</td>
              <td>
                <input
                  value={node.text}
                  onChange={(e) => {
                    node.setText(e.target.value);
                  }}
                />
              </td>
              <td>
                {relationsFromNodesPerspective(node)
                  .map((relation) => {
                    return `${relation.label}: ${relation.to.id.slice(0, 8)}`;
                  })
                  .join(", ")}
              </td>
              <td>
                <button
                  onClick={() => {
                    node.delete();
                  }}
                >
                  x
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="h-4" />
    </div>
  );
});
