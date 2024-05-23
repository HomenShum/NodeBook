import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useGraphStore } from "../../store/useGraphStore";

export const RelationTypeTable = observer(() => {
  const graph = useGraphStore();
  const headers = ["id", "label", "reverseLabel"];
  const [showTable, setShowTable] = useState(false);

  return (
    <div className={cn("p-2 border-t flex-initial", showTable ? "overflow-y-auto" : "")}>
      <div className={cn("flex flex-row align-baseline justify-between", showTable ? "mb-4" : "")}>
        <h1 className="text-xl font-bold inline-block">Relation Types Table</h1>
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
            {graph.relationTypes.map(({ id, label, reverseLabel }) => (
              <tr key={id}>
                <td>{id}</td>
                <td>
                  <input
                    value={label}
                    onChange={(e) => {
                      graph.updateRelationType(id, { label: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <input
                    value={reverseLabel}
                    onChange={(e) => {
                      graph.updateRelationType(id, { reverseLabel: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <button onClick={() => graph.deleteRelationType(id)}>x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});
