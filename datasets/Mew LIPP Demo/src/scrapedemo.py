import json
import os

from utils import *

labs_root_id = "stanford-independent-labs"
file_name = "stanford-independent-labs"

def filter_graph(graph, root_id, threshold_depth=2, max_children=3, max_depth=10) -> Graph:
    # Initialize BFS
    visited_node = set()
    visited_relation = set()
    queue = deque([(root_id, None, 0)])
    visited_node.add(root_id)

    while queue:
        node_id, relation_id, depth = queue.popleft()
        if depth > max_depth:
            break;

        visited_node.add(node_id)
        visited_relation.add(relation_id)

        # Always keep the "type" relations if they exist
        for relation in graph.get_relations_with_from_id(node_id):
            if relation["relationTypeId"] == "type":
                visited_node.add(relation["toId"])
                visited_relation.add(relation["id"])

        # Get the next relations to visit, capped at max_children, preferring nodes with more relations
        outgoing_relations = sorted(
            graph.get_relations_with_from_id(node_id),
            key=lambda r: len(graph.get_relations_with_from_id(r["fromId"])) + len(graph.get_relations_with_to_id(r["toId"])),
            reverse=True
        )
        next_relations = outgoing_relations if depth < threshold_depth else outgoing_relations[:max_children]
        
        # Queue next relations
        for r in next_relations:
            next_node_id = r["toId"]
            if next_node_id not in visited_node:
              queue.append((next_node_id, r["id"], depth + 1))
    
    # Create new graph with only visited nodes and relations
    filtered_graph = Graph()
    for node_id in visited_node:
        filtered_graph.add_node(graph.get_node(node_id))
    for relation_id in visited_relation:
        filtered_graph.add_relation(graph.get_relation(relation_id))
    for relation_type in graph._graph["relationTypesById"].values():
        filtered_graph.add_relation_type(relation_type)
    filtered_graph.reindex()

    return filtered_graph


if __name__ == "__main__":
    text = open(stanford_labs_path, "r").read()
    root_node = create_node("Stanford Independent Labs", labs_root_id)

    # Create graph and make it a child of the global root node
    graph = add_text_graph(text, root_node)
    graph.upsert_relation(global_root_node_id, labs_root_id)

    # Save full version
    with open(os.path.join(output_dir, f"{file_name}.json"), "w") as f:
        json.dump(graph, f, indent=2)

    # Save lite version
    graph_lite = filter_graph(graph, root_node["id"])
    with open(os.path.join(output_dir, f"{file_name}-lite.json"), "w") as f:
        json.dump(graph_lite, f, indent=2)
