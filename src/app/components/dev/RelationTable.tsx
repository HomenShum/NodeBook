import { useGraphStore } from "@/app/store/useGraphStore";
import { observer } from "mobx-react-lite";
import { GraphNode } from "../../model/GraphNode";

const nodeToString = (node: GraphNode) => {
  return `"${node.text}" (${node.id.slice(0, 8)})`;
};

export const RelationTable = observer(() => {
  const graphStore = useGraphStore();
  const headers = ["id", "from", "to", "type"];
  const relations = graphStore.relations;

  return (
    <div className="p-2 mb-4 max-h-96 overflow-y-auto">
      <h1 className="text-xl font-bold">Relation Table</h1>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {relations.map((relation) => (
            <tr key={relation.id}>
              <td>{relation.id}</td>
              <td>{nodeToString(relation.from)}</td>
              <td>{nodeToString(relation.to)}</td>
              <td>{relation.type.label}</td>
              <td>
                <button onClick={() => relation.delete()}>x</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="h-4" />
    </div>
  );
});
