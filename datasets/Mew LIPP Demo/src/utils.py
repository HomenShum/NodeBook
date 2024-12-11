import hashlib
import os
import re
import uuid
from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Set, Union

GraphDict = Dict[str, Dict] 

# Paths
data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
input_dir = os.path.join(data_dir, 'input')
output_dir = os.path.join(data_dir, 'output')
stanford_labs_path = os.path.join(input_dir, 'stanford-independent-labs.txt')
crunchbase_dir = os.path.join(input_dir, 'crunchbase')
josh_langsam_path = os.path.join(input_dir, 'josh-langam.json')
laurel_touby_path = os.path.join(input_dir, 'laureltouby.txt')
good_signal_dir = os.path.join(input_dir, "good-signal")
linkedin_dir = os.path.join(input_dir, 'linkedin')

default_relation_types = {
    "child": { "id": "child", "label": "child", "reverse_label": "parent" },
    "linkedin-url": { "id": "linkedin-url", "label": "LinkedIn URL", "reverse_label": "is LinkedIn URL of"},
    "works-at": { "id": "works-at", "label": "works at", "reverse_label": "employs"},
    "knows": { "id": "knows", "label": "knows", "reverse_label": "knows"},
    "email": { "id": "email", "label": "email address", "reverse_label": "is Email Address of"},
    "type": { "id": "type", "label": "type", "reverse_label": "is type of"}
}


top_vcs = set([
    "Sequoia Capital",
    "SV Angel",
    "Lightspeed Venture Partners",
    "Andreessen Horowitz",
    "Kleiner Perkins",
    "Khosla Ventures",
    "Tiger Global Management",
    "Dragoneer Investment Group",
    "Greenspring Associates",
    "New Enterprise Associates",
    "Legend Capital",
    "Kaitai Capital",
    "Accel",
    "Bessemer Venture Partners",
    "First Round Capital",
    "Spark Capital",
    "Founders Fund",
    "Intel Capital",
    "Menlo Ventures",
    "General Catalyst",
])


# constant ids
author_id = "global-admin"
global_root_node_id = "global-root-id"
global_users_id = "global-users-id"
linkedin_users_node_id = "linkedin-users-node-id"
laurel_touby_id = "laurel-touby"
vcs_list_id = "vcs_list_node_id"
author_id = "global-admin"
person_type_node_id = "person-type-node-id"
company_type_node_id = "company-type-node-id"
investor_type_node_id = "investor-type-node-id"
type_node_ids = [person_type_node_id, company_type_node_id, investor_type_node_id]

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

def create_relation_type(label: str, reverse_label = None, id = None) -> Dict[str, Any]:
    """Create a relation type matching SerializedRelationType schema"""
    reverse_label = reverse_label or f"is {label} of"
    return {
        "id": id or str(uuid.uuid4()),
        "authorId": "global-admin",
        "version": 1,
        "label": label,
        "reverseLabel": reverse_label,
        "isPublic": True
    }

class Graph:
    def __init__(self, graph_dict: Union[None, GraphDict] = None):
        self._graph = graph_dict or {
            "nodesById": {},
            "relationsById": {},
            "relationTypesById": {},
        }
        self._nodes_by_content = {}
        self._relations_by_content = {}
        self._relations_by_from_id = defaultdict(set)
        self._relations_by_to_id = defaultdict(set)

        # Add default data
        for relation_type in default_relation_types.values():
            if relation_type["id"] not in self._graph["relationTypesById"]:
                self.add_relation_type(create_relation_type(relation_type["label"], relation_type["reverse_label"], id=relation_type["id"]))
        self.upsert_node("Global Root", id=global_root_node_id)

        self.reindex()

    def reindex(self):
        for node in self._graph["nodesById"].values():
            self._nodes_by_content[hash_node(node)] = node["id"]
        for relation in self._graph["relationsById"].values():
            self._relations_by_content[hash_relation(relation)] = relation["id"]
            self._relations_by_from_id[relation["fromId"]].add(relation["id"])
            self._relations_by_to_id[relation["toId"]].add(relation["id"])

    def get_node(self, id: str):
        """Get a node by id"""
        return self._graph["nodesById"].get(id)
    
    def get_relation(self, id: str):
        """Get a relation by id"""
        return self._graph["relationsById"].get(id)

    def get_relations_with_from_id(self, from_id: str):
        relations = []
        for relation_id in self._relations_by_from_id.get(from_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            relations.append(relation)
        return relations
    
    def get_relations_with_to_id(self, to_id: str):
        relations = []
        for relation_id in self._relations_by_to_id.get(to_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            relations.append(relation)
        return relations

    def get_type_nodes(self):
        for id in type_node_ids:
            node = self.get_node(id)
            if not node: continue
            yield node

    def get_nodes_by_type(self, type_node_id: str) -> List[Dict[str, Any]]:
        """Get a node by type node id"""
        type_node = self.get_node(type_node_id)
        if not type_node:
            return []
        nodes = {}
        for i, relation_id in enumerate(self._relations_by_to_id.get(type_node_id, [])):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation["relationTypeId"] != default_relation_types["type"]["id"]: continue
            node = self.get_node(relation["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_people_nodes(self) -> List[Dict[str, Any]]:
        return self.get_nodes_by_type(person_type_node_id)

    def add_node(self, node):
        if not node:
            return
        self._graph["nodesById"][node["id"]] = node
        self._nodes_by_content[hash_node(node)] = node["id"]
    
    def add_relation(self, relation):
        if not relation:
            return
        if relation["relationTypeId"] not in self._graph["relationTypesById"]:
            print(f"WARNING: Relation type {relation['relationTypeId']} not in graph")
            return
        self._graph["relationsById"][relation["id"]] = relation
        self._relations_by_content[hash_relation(relation)] = relation["id"]
        self._relations_by_from_id[relation["fromId"]].add(relation["id"])
        self._relations_by_to_id[relation["toId"]].add(relation["id"])
    
    def add_relation_type(self, relation_type: Dict[str, Any]) -> None:
        self._graph["relationTypesById"][relation_type["id"]] = relation_type

    def upsert_type_to_node(self, node_id: str, type_id: str) -> None:
        if type_id not in type_node_ids:
            raise Exception(f"Type node with id {type_id} not in graph")
        self.upsert_relation(node_id, type_id, relation_type_id="type")
    
    def get_or_create_node(self, content: str, id = None) -> Dict[str, Any]:
        """Get existing node by content or create a new one"""
        if id and id in self._graph["nodesById"]:
            return self._graph["nodesById"][id]
        content_hash = hash_content(content)
        if content_hash in self._nodes_by_content:
            id = self._nodes_by_content[content_hash]
            return self._graph["nodesById"][id]
        else:
            return create_node(content, id=id)
    
    def get_or_create_relation(self, from_id: str, to_id: str, relation_type_id: str = "child", id = None) -> Dict[str, Any]:
        """Get existing relation or create a new one"""
        relation_hash = hash_relation({"fromId": from_id, "toId": to_id, "relationTypeId": relation_type_id})
        id = self._relations_by_content.get(relation_hash)
        if id:
            return self._graph["relationsById"][id]
        else:
            return create_relation(from_id, to_id, relation_type_id, id=id)
    
    def get_or_create_relation_type(self, label = None, reverse_label = None, id = None) -> Dict[str, Any]:
        """Get existing relation type by label or create a new one"""
        if id:
            if id in self._graph["relationTypesById"]:
                return self._graph["relationTypesById"][id]
            else:
                return create_relation_type(label or id, id=id)
        if label:
            relation_type_id = relation_type_text_to_id(label)
            if relation_type_id in self._graph["relationTypesById"]:
                return self._graph["relationTypesById"][relation_type_id]
            else:
                return create_relation_type(label, reverse_label, id=relation_type_id)
        return self._graph["relationTypesById"]["child"]
    
    def upsert_node(self, content: str, id = None):
        """Upsert a node to the graph and update the content index"""
        node = self.get_or_create_node(content, id=id)
        self.add_node(node)
        return node

    def upsert_relation(self, from_id: str, to_id: str, relation_type_id: str = "child", id = None) -> None:
        """Upsert a relation to the graph and update the content index"""
        if from_id == to_id:
            print("WARNING: from_id == to_id", from_id, to_id)
            return
        relation = self.get_or_create_relation(from_id, to_id, relation_type_id, id=id)
        self.add_relation(relation)

    def upsert_relation_type(self, label = None, reverse_label: str = None, id = None):
        """Upsert a relation type to the graph"""
        if not label:
            return self._graph["relationTypesById"][id or "child"]
        relation_type = self.get_or_create_relation_type(label, reverse_label, id=id)
        self.add_relation_type(relation_type)
        return relation_type
    
    def get_or_create_related_node(self, parent_id: str, node_content: str, relation_type_label = None, node_id = None, relation_id = None, relation_type_id = None):
        """Create a node and relate it to a parent node"""
        node = self.get_or_create_node(node_content, id=node_id)
        relation_type = self.get_or_create_relation_type(relation_type_label, id=relation_type_id)
        relation = self.get_or_create_relation(parent_id, node["id"], relation_type["id"], id=relation_id)
        return node, relation, relation_type

    def upsert_related_node(self, parent_id: str, node_content: str, relation_type_label = None, node_id = None, relation_id = None, related_type_id = None):
        """Upsert a node and relate it to a parent node"""
        node, relation, relation_type = self.get_or_create_related_node(parent_id, node_content, relation_type_label, node_id, relation_id)
        self.add_node(node)
        self.add_relation(relation)
        self.add_relation_type(relation_type)
        return node, relation

    def upsert_property(self, parent_id: str, value: str, key_label = None, key_id = None):
        if parent_id not in self._graph["nodesById"]:
            raise Exception(f"Node with id {parent_id} not in graph") 
        if not key_label and not key_id:
            raise Exception(f"Must provided key_label or key_id")
        # If the parent has a relation that already represents this property, update it's
        # value with the provided one 
        for relation_id in self._relations_by_from_id.get(parent_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            relation_type = self._graph["relationTypesById"].get(relation["relationTypeId"])
            if not relation_type: continue
            if (key_id and key_id == relation_type["id"]) or (key_label and key_label == relation_type["label"]):
                value_node = self.get_node(relation["toId"])
                if not value_node: continue
                old_hash = hash_node(value_node)
                if old_hash in self._nodes_by_content:
                    del self._nodes_by_content[old_hash]
                value_node["content"] = create_node(value)["content"]
                self._nodes_by_content[hash_node(value_node)] = value_node["id"]
                return value_node, relation, relation_type
        # Otherwise create a new one
        relation_type = self.get_or_create_relation_type(key_label, id=key_id)
        value_node = create_node(value)
        relation = create_relation(parent_id, value_node["id"], relation_type["id"])
        self.add_relation_type(relation_type)
        self.add_node(value_node)
        self.add_relation(relation)
        return value_node, relation, relation_type

    def walk_ancestors(self, node_id: str, max_steps = 10):
        visited = set()
        stack = [(node_id, max_steps)]
        while stack:
            current_id, steps_left = stack.pop()
            if current_id == global_root_node_id:
                continue
            if steps_left <= 0 or current_id in visited:
                continue
            visited.add(current_id)

            for relation_id in self._relations_by_to_id.get(current_id, []):
                relation = self.get_relation(relation_id)
                if not relation: continue
                parent = self.get_node(relation["fromId"])
                if not parent: continue
                yield relation, parent
                stack.append((parent["id"], steps_left - 1))

    def walk_descendants(self, node_id: str, max_steps = 10):
        visited = set()
        stack = [(node_id, max_steps)]
        while stack:
            current_id, steps_left = stack.pop()
            if current_id == global_root_node_id:
                continue
            if steps_left <= 0 or current_id in visited:
                continue
            visited.add(current_id)

            for relation_id in self._relations_by_from_id.get(current_id, []):
                relation = self.get_relation(relation_id)
                if not relation: continue
                child = self.get_node(relation["toId"])
                if not child: continue
                yield relation, child
                stack.append((child["id"], steps_left - 1))

    def walk_adjacent(self, node_id: str, max_steps = 10):
        visited = set() 
        stack = [(node_id, max_steps)]
        while stack:
            current_id, steps_left = stack.pop()
            if current_id == global_root_node_id:
                continue
            if steps_left <= 0 or current_id in visited:
                continue
            visited.add(current_id)

            for relation_id in self._relations_by_to_id.get(current_id, []):
                relation = self.get_relation(relation_id)
                if not relation: continue
                parent = self.get_node(relation["fromId"])
                if not parent: continue
                yield relation, parent
                stack.append((relation["fromId"], steps_left - 1))

            for relation_id in self._relations_by_from_id.get(current_id, []):
                relation = self.get_relation(relation_id)
                if not relation: continue
                child = self.get_node(relation["toId"])
                if not child: continue
                yield relation, child
                stack.append((relation["toId"], steps_left - 1))
    
    # def remove_hangovers(self):
    #     """Remove relations that point at nothing"""
    #     for relation in self._graph["relationsById"].values():
    #         if (relation["fromId"] not in self._graph["nodesById"] and relation["fromId"] != global_root_node_id) or relation["toId"] not in self._graph["nodesById"]:
    #             del self._graph["relationsById"][relation["id"]]

    def to_dict(self) -> Dict[str, Dict]:
        """Return the underlying graph dictionary"""
        graph_dict = deepcopy(self._graph)
        graph_dict["nodesByContent"] = deepcopy(self._nodes_by_content)
        graph_dict["relationsByContent"] = deepcopy(self._relations_by_content)
        return graph_dict


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
    relation_type_text = relation_type_text.lower()
    for relation_type in default_relation_types.values():
        if relation_type["label"] == relation_type_text:
            return relation_type["id"]
    return f"relation-type-{'-'.join(relation_type_text.lower().split())}"

def create_graph() -> GraphDict:
    return {
        "nodesById": {},
        "relationsById": {},
        "relationTypesById": {},
        "nodesByContent": {},
        "relationsByContent": {}
    }

def hash_content(content: str) -> str:
    return hashlib.sha256(content.lower().encode()).hexdigest()

def hash_node(node):
    return hashlib.sha256(node["content"][0]["value"].lower().encode()).hexdigest()

def hash_relation(relation: Dict[str, Any]) -> str:
    return hashlib.sha256(f"{relation['fromId']} {relation['relationTypeId']} {relation['toId']}".lower().encode()).hexdigest()

def node_to_text(node: Dict[str, Any]) -> str:
    return node["content"][0]["value"]

def update_nodes_by_content(graph: GraphDict, ids: Union[List[str], None] = None):
    ids = ids or list(graph["nodesById"].keys())
    for id in ids:
        node = graph["nodesById"][id]
        content_hash = hash_content(node_to_text(node))
        graph["nodesByContent"][content_hash] = id
    return graph

def get_or_create_node(graph: GraphDict, content: str, id=None):
    content_hash = hash_content(content)
    if content_hash in graph["nodesByContent"]:
        id = graph["nodesByContent"][content_hash]
        return graph["nodesById"][id]
    else:
        return create_node(content, id=id)

def get_or_create_relation(graph: GraphDict, from_id: str, to_id: str, relation_type_id: str = "child", id=None):
    relation_hash = hash_relation({ "fromId": from_id, "toId": to_id, "relationTypeId": relation_type_id })
    id = graph["relationsByContent"].get(relation_hash)
    if id:
        return graph["relationsById"][id]
    else:
        return create_relation(from_id, to_id, relation_type_id, id=id)

def get_or_create_relation_type(graph: GraphDict, label: str, reverse_label=None):
    relation_type_id = relation_type_text_to_id(label)
    if relation_type_id in graph["relationTypesById"]:
        return graph["relationTypesById"][relation_type_id]
    else:
        return create_relation_type(label, reverse_label, id=relation_type_id)

def add_node(graph: GraphDict, node: Dict[str, Any]):
    graph["nodesById"][node["id"]] = node
    graph["nodesByContent"][hash_content(node["content"][0]["value"])] = node["id"]
    return graph

def add_relation(graph: GraphDict, relation: Dict[str, Any]):
    graph["relationsById"][relation["id"]] = relation
    graph["relationsByContent"][hash_relation(relation)] = relation["id"]
    return graph

def add_relation_type(graph: GraphDict, relation_type: Dict[str, Any]):
    graph["relationTypesById"][relation_type["id"]] = relation_type
    return graph

def create_and_add_related_node(graph: GraphDict, parent_id: str, node_content: str, relation_type_label = None, node_id = None, relation_id = None):
    node = get_or_create_node(graph, node_content, id=node_id)
    relation_type_id = "child"
    if relation_type_label:
        relation_type = get_or_create_relation_type(graph, relation_type_label)
        add_relation_type(graph, relation_type)
        relation_type_id = relation_type["id"]
    add_node(graph, node)
    relation = get_or_create_relation(graph, parent_id, node["id"], relation_type_id, id=relation_id)
    add_relation(graph, relation)
    return node, relation

def add_text_graph(text: str, root_node_id=None, graph: Union[None, Graph] = None) -> Graph:
    graph = graph or Graph()

    parent_stack = [root_node_id] if root_node_id else []
    min_parents = len(parent_stack)
    
    for line in text.splitlines():
        # Parse line
        parsed = parse_line(line)
        if not parsed: continue
        indent_level, content, relation_type_label = parsed

        # Update parent stack based on indent level
        while len(parent_stack) > indent_level + min_parents:
            parent_stack.pop()
            
        # Add node and relation to parent
        node = graph.upsert_node(content)
        if parent_stack:
            parent_id = parent_stack[-1]
            relation_type = graph.upsert_relation_type(relation_type_label)
            graph.upsert_relation(parent_id, node["id"], relation_type["id"])
            
        parent_stack.append(node["id"])

    return graph


def clean_last_name(last_name):
    """Clean a last name by removing titles, degrees, and other suffixes"""
    # Remove content in parentheses
    last_name = re.sub(r'\([^)]*\)', '', last_name)
    
    # List of titles to remove (case insensitive)
    titles = [
        r',?\s*MBA',
        r',?\s*cmt',
        r',?\s*msc',
        r',?\s*ms',
        r',?\s*cpnp-pc',
        r',?\s*eem-clp',
        r',?\s*cphr',
        r',?\s*mma',
        r',?\s*mred',
        r',?\s*iii',
        r',?\s*csp',
        r',?\s*ph\. d\.',
        r',?\s*1st',
        r',?\s*psy\.d\.',
        r',?\s*msis',
        r',?\s*cexp',
        r',?\s*M\.A\.',
        r',?\s*jr\.?',
        r',?\s*sr\.?',
        r',?\s*CHFC',
        r',?\s*CLU',
        r',?\s*CSPO',
        r',?\s*CCIM',
        r',?\s*Esq\.?',
        r',?\s*PMP',
        r',?\s*CPA',
        r',?\s*HIA',
        r',?\s*Ph\.?D\.?',
        r',?\s*Ed\.?M\.?',
        r',?\s*M\.?D\.?',
        r',?\s*J\.?D\.?',
        r',?\s*PE',
        r',?\s*CFA',
        r',?\s*CISSP',
        r',?\s*CSM',
        r',?\s*PgMP',
        r',?\s*CISA'
    ]
    
    # Remove all titles
    for title in titles:
        last_name = re.sub(title, '', last_name, flags=re.IGNORECASE)
        
    return last_name.strip()

def clean_first_name(first_name):
    """Clean a first name by removing titles like 'Dr.'"""
    first_name = re.sub(r'^Dr\.\s*', '', first_name, flags=re.IGNORECASE)
    return first_name.strip()


def assign_canonical_relation(graph: Graph, root_node_id = global_root_node_id):
    root_node = graph.get_node(root_node_id)
    if not root_node: return
    max_steps = len(graph._graph["nodesById"]) + 10
    steps = 0
    visited = set()
    queue = deque([(root_node["id"], None)])
    while queue:
        current_node_id, parent_relation_id = queue.popleft()
        if not current_node_id or current_node_id in visited: continue
        current_node = graph.get_node(current_node_id)
        if not current_node: continue

        # Assign canonical relation
        visited.add(current_node_id)
        current_node["canonicalRelationId"] = parent_relation_id
        steps += 1
        if steps > max_steps:
            print(f"WARNING: Max steps while assigning canonical relations")
            break
        
        # Add children to queue
        for relation in graph.get_relations_with_from_id(current_node_id):
            queue.append((relation["toId"], relation["id"]))
    return graph
