import { GraphObject } from "@/app/model/GraphObject";
import { useGraphStore } from "@/app/model/useGraphStore";
import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import { useState } from "react";

const objectToString = (obj: GraphObject) => {
  return `"${obj.text}" (${obj.id.slice(0, 8)})`;
};

export const RelationTable = observer(() => {
  const graphStore = useGraphStore();
  const headers = ["id", "from", "to", "type"];
  const relations = graphStore.relations;

  const [showTable, setShowTable] = useState(false);

  return (
    <div className={cn("p-2 border-t flex-initial", showTable ? "overflow-y-auto" : "")}>
      <div className={cn("flex flex-row align-baseline justify-between", showTable ? "mb-4" : "")}>
        <h1 className="text-xl font-bold inline-block">Relation Table</h1>
        <button onClick={() => setShowTable(!showTable)}>{!showTable ? "Show" : "Hide"}</button>
      </div>
      {showTable && (
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
                <td>{objectToString(relation.from)}</td>
                <td>{objectToString(relation.to)}</td>
                <td>{relation.relationType.label}</td>
                <td>
                  <button onClick={() => relation.delete()}>x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});
