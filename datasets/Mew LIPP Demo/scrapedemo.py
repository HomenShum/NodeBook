import json
import os
import re
import uuid
from collections import deque
from datetime import datetime
from typing import Any, Dict, List

global_root_node_id = "global-root-id"
root_id = "stanford-independent-labs"
global_root_to_stanford_independent_labs_relation_id = "global-root-to-stanford-independent-labs"

def create_node(content: str, id = None) -> Dict[str, Any]:
    """Create a node matching SerializedNode schema"""
    return {
        "id": id or str(uuid.uuid4()),
        "authorId": "global-admin",
        "version": 1,
        "content": [{ "type": "text", "value": content }],
        "isPublic": True,
        "isNewRelatedObjectsPublic": False,
        "canonicalRelationId": None
    }

def create_relation(from_id: str, to_id: str, relation_type_id = None, id = None) -> Dict[str, Any]:
    """Create a relation matching SerializedRelation schema"""
    return {
        "id": id or str(uuid.uuid4()),
        "fromId": from_id,
        "toId": to_id,
        "relationTypeId": relation_type_id or "child",
        "version": 1,
        "authorId": "global-admin",
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
        "isPublic": True,
        "canonicalRelationId": None
    }

def create_relation_type(label: str, reverse_label: str = "", id = None) -> Dict[str, Any]:
    """Create a relation type matching SerializedRelationType schema"""
    return {
        "id": id or str(uuid.uuid4()),
        "authorId": "global-admin",
        "version": 1,
        "label": label,
        "reverseLabel": reverse_label,
        "isPublic": True
    }

def parse_line(line: str):
    """Parse a line into (indent_level, content, relation_type)
    Format: {tabs}-{relation_type}[::{content}]
    If text before '::' is >40 chars, treat entire post-dash text as content"""
    
    # Find position of first dash
    dash_pos = line.find('-')
    if dash_pos == -1:
        return None
    
    # Count tabs before dash
    indent_level = line[:dash_pos].count('\t')
    
    # Get everything after the dash
    remaining_text = line[dash_pos + 1:].strip()
    
    # Look for '::'
    parts = remaining_text.split('::', 1)
    
    if len(parts) == 2 and len(parts[0].strip()) <= 40:
        # We have a relation type and content
        relation_type = parts[0].strip()
        content = parts[1].strip()
    else:
        # Everything is content
        content = remaining_text
        relation_type = None
    
    return indent_level, content, relation_type

def relation_type_text_to_id(relation_type_text: str) -> str:
    return f"relation-type-{'-'.join(relation_type_text.lower().split())}"

def text_to_graph(text: str) -> Dict[str, Dict]:
    # Initialize data structures
    nodes_by_id: Dict[str, Dict] = {}  # id -> node
    nodes_by_content: Dict[str, str] = {}  # content -> id
    relations: Dict[str, Dict] = {}  # id -> relation
    relation_types: Dict[str, Dict] = {}  # id -> relation_type

    # Create a root node
    
    nodes_by_id[root_id] = create_node("Stanford Independent Labs", root_id)

    # Add it as a child of the global user
    relation = create_relation(global_root_node_id, root_id, id = global_root_to_stanford_independent_labs_relation_id)
    relations[relation["id"]] = relation
    
    # Parse lines and track parent stack
    parent_stack: List[str] = [root_id]

    for line in text.splitlines():
        if not line.strip():
            continue
            
        parsed = parse_line(line)
        if not parsed:
            continue
            
        indent_level, content, relation_type = parsed

        # Get or create node ID for this content
        if content in nodes_by_content:
            current_id = nodes_by_content[content]
        else:
            current_id = str(uuid.uuid4())
            nodes_by_content[content] = current_id
            nodes_by_id[current_id] = create_node(content, current_id)
        
        # Update parent stack based on indent level
        while len(parent_stack) > indent_level + 1:
            parent_stack.pop()
            
        # Create relation if we have a parent
        if parent_stack:
            parent_id = parent_stack[-1]
            
            # Create relation type if specified
            relation_type_id = "child"
            if relation_type:
                # Use consistent IDs for relation types with same label
                relation_type_id = relation_type_text_to_id(relation_type)
                if relation_type_id not in relation_types:
                    relation_types[relation_type_id] = create_relation_type(
                        relation_type,
                        f"is {relation_type} of",
                        id = relation_type_id
                    )
            
            # Create the relation
            relation = create_relation(parent_id, current_id, relation_type_id)
            relations[relation["id"]] = relation
            
        parent_stack.append(current_id)

    return {
        "nodesById": nodes_by_id,
        "relationsById": relations,
        "relationTypesById": relation_types
    }

def filter_graph(graph, threshold_depth=2, max_children=5):
    nodes_by_id = graph["nodesById"]
    relations_by_id = graph["relationsById"]
    
    # Build adjacency list
    relations_by_node_id = {}
    for relation in relations_by_id.values():
        relations_by_node_id.setdefault(relation["fromId"], []).append(relation)
        relations_by_node_id.setdefault(relation["toId"], []).append(relation)
    
    # Initialize BFS
    visited_node = set()
    visited_relation = set()
    queue = deque([(root_id, global_root_to_stanford_independent_labs_relation_id, 0)])
    visited_node.add(root_id)

    def other_end(relation):
        return relation["toId"] if relation["fromId"] == node_id else relation["fromId"]

    def get_related_node_text(relation):
        other_node =  nodes_by_id.get(other_end(relation))
        return other_node["content"][0]["value"] if other_node else ""
    
    while queue:
        node_id, relation_id, depth = queue.popleft()
        visited_node.add(node_id)
        visited_relation.add(relation_id)

        # Sort neighbors for consistency
        connected_relations = sorted(relations_by_node_id.get(node_id, []), key=get_related_node_text)
        
        # Queue next relations
        next_relations = connected_relations if depth < threshold_depth else connected_relations[:max_children]
        for r in next_relations:
            next_node_id = other_end(r)
            if next_node_id not in visited_node:
              queue.append((next_node_id, r["id"], depth + 1))
    
    return {
        "nodesById": {node_id: nodes_by_id[node_id] for node_id in visited_node if node_id in nodes_by_id},
        "relationsById": {rid: relations_by_id[rid] for rid in visited_relation if rid in relations_by_id},
        "relationTypesById": graph["relationTypesById"]
    }

if __name__ == "__main__":
  text = open("output-data/stanford independent labs.txt", "r").read()
  graph = text_to_graph(text)
  graph = filter_graph(graph)
  out = os.path.join("output-data", "stanford independent labs.json")
  with open(out, "w") as f:
    json.dump(graph, f, indent=2)
    
