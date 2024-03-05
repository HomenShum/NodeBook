import { useContext } from "react";
import { observer } from "mobx-react-lite";
import { GraphNode } from "../model/GraphStore";
import { GraphStoreContext } from "../store/graph";

const nodeToString = (node: GraphNode) => {
  return `"${node.text}" (${node.id.slice(0, 8)})`;
};

export const RelationTable = observer(() => {
  const nodeStore = useContext(GraphStoreContext);
  const headers = ["id", "from", "to", "type"];
  const relations = nodeStore.relations;

  return (
    <div className="p-2">
      <h1>Relation Table</h1>
      <table>
        <thead>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </thead>
        <tbody>
          {relations.map((relation) => (
            <tr key={relation.id}>
              <td>{relation.id}</td>
              <td>{nodeToString(relation.from)}</td>
              <td>{nodeToString(relation.to)}</td>
              <td>{relation.type.label}</td>
              <button onClick={() => relation.delete()}>x</button>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="h-4" />
    </div>
  );
});
