import json
import os
from copy import deepcopy

from lidemo import filter_for_top_people, graphify_linkedin, linkedin_dir
from utils import (Graph, create_graph, create_node, create_relation,
                   filter_graph, global_root_node_id, global_users_id,
                   text_to_graph)

good_signal_dir = os.path.join("input-data", "good-signal")

def graphify_good_signal(good_signal_dir: str, graph = None) -> Graph:
    graph = deepcopy(graph) if graph else create_graph()
    for file in os.listdir(good_signal_dir):
        if file.endswith(".txt"):
          print(f"Processing {file}")
          filename = file.split(".")[0]
          # Create root node and make child of global root node
          node = create_node(filename)
          relation = create_relation(global_root_node_id, node["id"], "child")
          graph["nodesById"][node["id"]] = node
          graph["relationsById"][relation["id"]] = relation
          # Add all other nodes and relations
          text = open(os.path.join(good_signal_dir, file), "r").read()
          graph = text_to_graph(text, node, graph)
    return graph

if __name__ == "__main__":
    graph = filter_for_top_people(graphify_linkedin(linkedin_dir))
    graph = graphify_good_signal(good_signal_dir, graph)
    graph = filter_graph(graph, global_users_id)
    with open(os.path.join("output-data", "lippdemo.json"), "w") as f:
        json.dump({
            "nodesById": graph["nodesById"],
            "relationsById": graph["relationsById"],
            "relationTypesById": graph["relationTypesById"]
        }, f, indent=2)
    


