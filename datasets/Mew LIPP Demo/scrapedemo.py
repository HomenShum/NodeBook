import json
import os

from utils import (add_text_graph, create_node, create_relation, filter_graph,
                   global_root_node_id)

labs_root_id = "stanford-independent-labs"
file_name = "stanford-independent-labs"

if __name__ == "__main__":
    text = open("input-data/stanford-independent-labs.txt", "r").read()
    root_node = create_node("Stanford Independent Labs", labs_root_id)

    # Create graph and make it a child of the global root node
    graph = add_text_graph(text, root_node)
    graph.upsert_relation(global_root_node_id, labs_root_id)

    # Save full version
    with open(os.path.join("output-data", f"{file_name}.json"), "w") as f:
        json.dump(graph, f, indent=2)

    # Save lite version
    graph_lite = filter_graph(graph, root_node["id"])
    with open(os.path.join("output-data", f"{file_name}-lite.json"), "w") as f:
        json.dump(graph_lite, f, indent=2)
