import { observer } from "mobx-react-lite";
import { useGraphStore } from "../../store/useGraphStore";

export const RelationTypeTable = observer(() => {
  const graph = useGraphStore();
  const headers = ["id", "label", "reverseLabel"];

  return (
    <div className="p-2 mb-4 max-h-96 overflow-y-auto">
      <h1 className="text-xl font-bold">Relation Type Table</h1>
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
      <div className="h-4" />
    </div>
  );
});
