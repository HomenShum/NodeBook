import { observer } from "mobx-react-lite";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../store/useGraphStore";

function relationsFromNodesPerspective(node: GraphNode) {
  return node.relations.map((relation) => {
    if (relation.from.id === node.id) {
      return {
        id: relation.id,
        to: relation.to,
        type: relation.relationType,
        label: relation.relationType.label,
      };
    } else {
      return {
        id: relation.id,
        to: relation.from,
        type: relation.relationType,
        label: relation.relationType.reverseLabel || "reverse:" + relation.relationType.label,
      };
    }
  });
}

export const NodeTable = observer(() => {
  const graphStore = useGraphStore();
  const headers = ["id", "text", "relations"];

  return (
    <div className="p-2 mb-4 max-h-96 overflow-y-auto">
      <h1 className="text-xl font-bold">Node Table</h1>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {graphStore.nodes.map((node) => (
            <tr key={node.id}>
              <td>{node.id}</td>
              <td>
                <input
                  value={node.text}
                  onChange={(e) => {
                    node.setContent([{ type: "text", value: e.target.value }] ?? []);
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
