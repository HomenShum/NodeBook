import hashlib
import uuid
from collections import deque
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List

Graph = Dict[str, Dict] 

global_root_node_id = "global-root-id"
author_id = "global-admin"
global_users_id = "global-users-id"

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

def create_graph() -> Graph:
    return {
        "nodesById": {},
        "relationsById": {},
        "relationTypesById": {},
        "nodesByContent": {}
    }

def hash_content(content: str) -> str:
    return hashlib.sha256(content.lower().encode()).hexdigest()

def text_to_graph(text: str, root_node=None, graph = None) -> Graph:
    # Initialize data structures
    graph = deepcopy(graph) or create_graph()

    # Parse lines and track parent stack
    min_parents = 0
    parent_stack: List[str] = []
    if root_node:
        graph["nodesById"][root_node] = create_node(root_node, root_node)
        parent_stack.append(root_node)
        min_parents = 1

    for line in text.splitlines():
        if not line.strip():
            continue
            
        parsed = parse_line(line)
        if not parsed:
            continue
            
        indent_level, content, relation_type = parsed

        # Get or create node ID for this content
        content_hash = hash_content(content)
        if content_hash in graph["nodesByContent"]:
            current_id = graph["nodesByContent"][content_hash]
        else:
            current_id = str(uuid.uuid4())
            graph["nodesByContent"][content_hash] = current_id
            graph["nodesById"][current_id] = create_node(content, current_id)
        
        # Update parent stack based on indent level
        while len(parent_stack) > indent_level + min_parents:
            parent_stack.pop()
            
        # Create relation if we have a parent
        if parent_stack:
            parent_id = parent_stack[-1]
            
            # Create relation type if specified
            relation_type_id = "child"
            if relation_type:
                # Use consistent IDs for relation types with same label
                relation_type_id = relation_type_text_to_id(relation_type)
                if relation_type_id not in graph["relationTypesById"]:
                    graph["relationTypesById"][relation_type_id] = create_relation_type(
                        relation_type,
                        f"is {relation_type} of",
                        id = relation_type_id
                    )
            
            # Create the relation
            relation = create_relation(parent_id, current_id, relation_type_id)
            graph["relationsById"][relation["id"]] = relation
            
        parent_stack.append(current_id)

    return graph

def filter_graph(graph, root_id, threshold_depth=2, max_children=3) -> Graph:
    nodes_by_id = graph["nodesById"]
    relations_by_id = graph["relationsById"]
    relation_types_by_id = graph["relationTypesById"]

    # Build adjacency list
    relations_by_node_id = {}
    for relation in relations_by_id.values():
        relations_by_node_id.setdefault(relation["fromId"], []).append(relation)
        relations_by_node_id.setdefault(relation["toId"], []).append(relation)
    
    # Initialize BFS
    visited_node = set()
    visited_relation = set()
    queue = deque([(root_id, None, 0)])
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
    
    # Create new graph with only visited nodes and relations
    new_graph = create_graph()
    new_graph["nodesById"] = {node_id: nodes_by_id[node_id] for node_id in visited_node if node_id in nodes_by_id}
    new_graph["relationsById"] = {rid: relations_by_id[rid] for rid in visited_relation if rid in relations_by_id}
    relation_type_ids = set()
    for relation in new_graph["relationsById"].values():
        relation_type_ids.add(relation["relationTypeId"])
    new_graph["relationTypesById"] = {rtid: relation_types_by_id[rtid] for rtid in relation_type_ids if rtid in relation_types_by_id}
    new_graph["nodesByContent"] = {content_hash: node_id for content_hash, node_id in graph["nodesByContent"].items() if node_id in new_graph["nodesById"]}

    return new_graph
