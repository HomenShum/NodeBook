import hashlib
import os
import re
import uuid
from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Iterator, List, Set, Union

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
# good_signal_dir = os.path.join(input_dir, "good-signal", "small")
linkedin_dir = os.path.join(input_dir, 'linkedin')
good_signal_paths = {
    "intelligentcrazypeople": os.path.join(good_signal_dir, "intelligentcrazypeople.txt"),
    "CPHOF": os.path.join(good_signal_dir, "CPHOF.txt"),
    "YC Companies": os.path.join(good_signal_dir, "YC Companies_flattened.txt"),
    "International Olympiad Winners": os.path.join(good_signal_dir, "International Olympiad Winners.txt"),
    "Misc Competition Winners": os.path.join(good_signal_dir, "Misc Competition Winners.txt"),
    "MLH Top Hackers": os.path.join(good_signal_dir, "MLH Top Hackers.txt"),
    "Scholarships and Fellowships List": os.path.join(good_signal_dir, "Scholarships and Fellowships List.txt"),
}

class RelationTypeClass:
    def __init__(self, id: str, label: str, reverse_label: str):
        self.id = id
        self.label = label
        self.reverse_label = reverse_label

class DefaultRelationTypes:
    child = RelationTypeClass("child", "child", "parent")
    linkedin_url = RelationTypeClass("linkedin-url", "LinkedIn URL", "is LinkedIn URL of")
    works_at = RelationTypeClass("works-at", "works at", "employs")
    knows = RelationTypeClass("knows", "knows", "knows")
    email = RelationTypeClass("email", "email address", "is Email Address of")
    type = RelationTypeClass("type", "type", "is type of")
    ideapad_show_as = RelationTypeClass("ideapad_show_as", "ideapad_show_as", "is_ideapad_show_as_of")
    ideapad_color = RelationTypeClass("ideapad_color", "ideapad_color", "is_ideapad_color_of")
    ideapad_extreme_talent = RelationTypeClass("ideapad_extreme_talent", "is_extreme_talent", "is_extreme_talent_of")
    website_url = RelationTypeClass("website-url", "website URL", "is website URL of")
    founder = RelationTypeClass("founder", "founder", "is founder of")
    description = RelationTypeClass("description", "description", "is description of")

    def __iter__(self) -> Iterator[RelationTypeClass]:
        # This returns all class variables that are RelationType instances
        return iter([v for v in vars(self.__class__).values() 
                    if isinstance(v, RelationTypeClass)])

default_relation_types = DefaultRelationTypes()

def is_ideapad_relation_type(relation_type_id: str) -> bool:
    return relation_type_id in [
        default_relation_types.ideapad_show_as.id,
        default_relation_types.ideapad_color.id,
        default_relation_types.ideapad_extreme_talent.id,
    ]

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
class TypeNodeIds(Enum):
    person_id = person_type_node_id
    company_id = company_type_node_id 
    investor_id = investor_type_node_id
ideapad_show_as_none_node_id = "ideapad-show-as-none"
ideapad_show_as_attribute_node_id = "ideapad-show-as-attribute"

Node = Dict[str, Any]

def create_node(content: str, id = None) -> Node:
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

Relation = Dict[str, Any]

def create_relation(from_id: str, to_id: str, relation_type_id = None, id = None) -> Relation:
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

RelationType = Dict[str, Any]

def create_relation_type(label: str, reverse_label = None, id = None) -> RelationType:
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
        self._default_node_ids = set()
        self.reindex()

        # Add default data
        for relation_type in default_relation_types:
            if relation_type.id not in self._graph["relationTypesById"]:
                self.add_relation_type(create_relation_type(relation_type.label, relation_type.reverse_label, id=relation_type.id))
        self.upsert_node("Global Root", id=global_root_node_id)
        self._default_node_ids.add(global_root_node_id)

        # Schema nodes
        self.upsert_node("Person", id=person_type_node_id)
        self.upsert_node("Company", id=company_type_node_id)
        self.upsert_node("Investor", id=investor_type_node_id)
        self._default_node_ids.add(person_type_node_id)
        self._default_node_ids.add(company_type_node_id)
        self._default_node_ids.add(investor_type_node_id)

        # Ideapad-specific nodes
        self.upsert_node("none", id=ideapad_show_as_none_node_id)
        self.upsert_node("attribute", id=ideapad_show_as_attribute_node_id)
        self.upsert_relation(global_root_node_id, ideapad_show_as_none_node_id, default_relation_types.ideapad_show_as.id)
        self._default_node_ids.add(ideapad_show_as_none_node_id)
        self._default_node_ids.add(ideapad_show_as_attribute_node_id)

    def reindex(self):
        for node in self._graph["nodesById"].values():
            self._nodes_by_content[hash_node(node)] = node["id"]
        for relation in self._graph["relationsById"].values():
            hash = hash_relation(relation["fromId"], relation["toId"], relation["relationTypeId"])
            self._relations_by_content[hash] = relation["id"]
            self._relations_by_from_id[relation["fromId"]].add(relation["id"])
            self._relations_by_to_id[relation["toId"]].add(relation["id"])

    def has(self, id: str):
        return id in self._graph["nodesById"] or id in self._graph["relationsById"]

    def get_node(self, id: str):
        """Get a node by id"""
        return self._graph["nodesById"].get(id)
    
    def get_relation(self, id: str):
        """Get a relation by id"""
        return self._graph["relationsById"].get(id)


    def get_relation_type(self, id: str):
        """Get a relation type by id"""
        return self._graph["relationTypesById"].get(id)

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

    def get_related_nodes_from_id(self, from_id: str):
        """
        Get all nodes that are related to the provided node id
        where the relation goes from the provided node id
        """
        nodes = {}
        for relation_id in self._relations_by_from_id.get(from_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            node = self.get_node(relation["toId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_related_nodes_to_id(self, to_id: str):
        """
        Get all nodes that are related to the provided node id
        where the relation goes to the provided node id
        """
        nodes = {}
        for relation_id in self._relations_by_to_id.get(to_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            node = self.get_node(relation["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_node_by_content(self, content: str):
        content_hash = hash_content(content)
        node_id = self._nodes_by_content.get(content_hash)
        if not node_id:
            return None
        return self.get_node(node_id)

    def get_people_nodes(self) -> List[Dict[str, Any]]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(person_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation["relationTypeId"] != "type": continue
            node = self.get_node(relation["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_companies_nodes(self) -> List[Dict[str, Any]]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(company_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation["relationTypeId"] != "type": continue
            node = self.get_node(relation["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_investor_nodes(self) -> List[Dict[str, Any]]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(investor_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation["relationTypeId"] != "type": continue
            node = self.get_node(relation["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def get_extreme_talent_nodes(self) -> List[Dict[str, Any]]:
        nodes = {}
        for relation_id in self._graph["relationsById"].values():
            if relation_id["relationTypeId"] != "extreme-talent": continue
            node = self.get_node(relation_id["fromId"])
            if not node: continue
            nodes[node["id"]] = node
        return list(nodes.values())

    def add_node(self, node):
        if not node:
            return
        self._graph["nodesById"][node["id"]] = node
        self._nodes_by_content[hash_node(node)] = node["id"]

    def remove_node(self, node_id: str):
        node = self.get_node(node_id)
        if not node:
            return
        if node_id in self._default_node_ids:
            print(f"WARNING: Not removing default node {node_id}")
            return
        del self._graph["nodesById"][node_id]
        hash = hash_node(node)
        if hash in self._nodes_by_content:
            del self._nodes_by_content[hash]
        relations_to_remove = set()
        for relation_id in self._relations_by_from_id.get(node_id, []):
            relations_to_remove.add(relation_id)
        for relation_id in self._relations_by_to_id.get(node_id, []):
            relations_to_remove.add(relation_id)
        for relation_id in relations_to_remove:
            self.remove_relation(relation_id)
    
    def add_relation(self, relation):
        if not relation:
            return
        if relation["id"] in self._graph["relationsById"]:
            return
        if relation["relationTypeId"] not in self._graph["relationTypesById"]:
            print(f"WARNING: Relation type {relation['relationTypeId']} not in graph")
            return
        self._graph["relationsById"][relation["id"]] = relation
        hash = hash_relation(relation["fromId"], relation["toId"], relation["relationTypeId"])
        self._relations_by_content[hash] = relation["id"]
        self._relations_by_from_id[relation["fromId"]].add(relation["id"])
        self._relations_by_to_id[relation["toId"]].add(relation["id"])
    
    def add_relation_type(self, relation_type: Dict[str, Any]) -> None:
        self._graph["relationTypesById"][relation_type["id"]] = relation_type

    def remove_relation(self, relation_id: str):
        relation = self.get_relation(relation_id)
        if not relation:
            return
        self._relations_by_from_id[relation["fromId"]].remove(relation_id)
        self._relations_by_to_id[relation["toId"]].remove(relation_id)
        if relation_id in self._graph["relationsById"]:
            del self._graph["relationsById"][relation_id]
        hash = hash_relation(relation["fromId"], relation["toId"], relation["relationTypeId"])
        if hash in self._relations_by_content:
            del self._relations_by_content[hash]

    def remove_relation_type(self, relation_type_id: str):
        del self._graph["relationTypesById"][relation_type_id]

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
        hash = hash_relation(from_id, to_id, relation_type_id)
        id = self._relations_by_content.get(hash)
        if id:
            return self._graph["relationsById"][id]
        return create_relation(from_id, to_id, relation_type_id, id=id)
    
    def get_or_create_relation_type(self, label = None, reverse_label = None, id = None) -> Dict[str, Any]:
        """Get existing relation type by label or create a new one"""
        if id:
            if id in self._graph["relationTypesById"]:
                return self._graph["relationTypesById"][id]
            else:
                return create_relation_type(label or id, reverse_label, id=id)
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

    def upsert_relation(self, from_id: str, to_id: str, relation_type_id: str = "child", id = None):
        """Upsert a relation to the graph and update the content index"""
        if from_id == to_id:
            print("WARNING: from_id == to_id", from_id, to_id)
            return
        relation = self.get_or_create_relation(from_id, to_id, relation_type_id, id=id)
        self.add_relation(relation)
        return relation

    def upsert_relation_type(self, label = None, reverse_label: str = None, id = None):
        """Upsert a relation type to the graph"""
        if id and id in self._graph["relationTypesById"]:
            return self._graph["relationTypesById"][id]
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
        self.add_relation_type(relation_type)
        self.add_relation(relation)
        return node, relation

    def upsert_related_node2(self, parent_id: str, value: Union[str, Node], label: Union[str, Dict, None] = None, upsert_node = None):
        # Special case for linkedin and website
        label_str_lower = label["label"].lower() if isinstance(label, Dict) else (label.lower() if isinstance(label, str) else "")
        if value == "":
            relation_type = self.get_or_create_relation_type(label) if isinstance(label, str) else label
            upsert_node = upsert_node if upsert_node is not None else False
        elif "linkedin" in label_str_lower:
            r = default_relation_types.linkedin_url
            relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
            upsert_node = upsert_node if upsert_node is not None else False
        elif "website" in label_str_lower or "link" == label_str_lower:
            r = default_relation_types.website_url
            relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
            upsert_node = upsert_node if upsert_node is not None else False
        elif "description" in label_str_lower:
            r = default_relation_types.description
            relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
            upsert_node = upsert_node if upsert_node is not None else False
        elif isinstance(value, str) and re.match(r"\d+", value):
            r = default_relation_types.description
            relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
            upsert_node = upsert_node if upsert_node is not None else False
        elif label is None:
            r = default_relation_types.child
            relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
            upsert_node = upsert_node if upsert_node is not None else True
        else:
            relation_type = self.get_or_create_relation_type(label) if isinstance(label, str) else label
            upsert_node = upsert_node if upsert_node is not None else True

        if isinstance(value, Dict):
            # If a node was given, add it
            node = value
            self.add_node(node)
        else:
            # When it's a string, upsert or not either based on the provided flag
            # or the special cases above
            if upsert_node == True:
                node = self.upsert_node(value)
            else:
                node = create_node(value)
                self.add_node(node)

        # Add relation
        self.add_relation_type(relation_type)
        relation = self.upsert_relation(parent_id, node["id"], relation_type["id"])

        return node, relation, relation_type

    def upsert_property(self, parent_id: str, value: str, key_label = None, key_id = None):
        parent_node = self.get_node(parent_id)
        if not parent_node:
            raise Exception(f"Node with id {parent_id} not in graph")
        if not key_label and not key_id:
            raise Exception(f"Must provided key_label or key_id")

        # If there's a relation with the same label, delete it
        relation_type = self.upsert_relation_type(key_label, id=key_id)
        for relation, target_node, _ in self.walk_descendants(parent_id, 1):
            relation_with_target_type = self.get_relation_type(relation["relationTypeId"])
            if not relation_with_target_type: continue
            if relation_with_target_type["label"] == relation_type["label"]:
                self.remove_relation(relation["id"])
                break
        
        value_node = create_node(value)
        relation = create_relation(parent_id, value_node["id"], relation_type["id"])
        self.add_relation_type(relation_type)
        self.add_node(value_node)
        self.add_relation(relation)
        return value_node, relation, relation_type

    # def upsert_property(self, parent_id: str, value: str, key_label = None, key_id = None):
    #     if parent_id not in self._graph["nodesById"]:
    #         raise Exception(f"Node with id {parent_id} not in graph") 
    #     if not key_label and not key_id:
    #         raise Exception(f"Must provided key_label or key_id")
    #     # If the parent has a relation that already represents this property, update it's
    #     # value with the provided one 
    #     for relation_id in self._relations_by_from_id.get(parent_id, []):
    #         relation = self.get_relation(relation_id)
    #         if not relation: continue
    #         relation_type = self._graph["relationTypesById"].get(relation["relationTypeId"])
    #         if not relation_type: continue
    #         if (key_id and key_id == relation_type["id"]) or (key_label and key_label == relation_type["label"]):
    #             value_node = self.get_node(relation["toId"])
    #             if not value_node: continue
    #             old_hash = hash_node(value_node)
    #             if old_hash in self._nodes_by_content:
    #                 del self._nodes_by_content[old_hash]
    #             value_node["content"] = create_node(value)["content"]
    #             self._nodes_by_content[hash_node(value_node)] = value_node["id"]
    #             return value_node, relation, relation_type
    #     # Otherwise create a new one
    #     relation_type = self.get_or_create_relation_type(key_label, id=key_id)
    #     value_node = create_node(value)
    #     relation = create_relation(parent_id, value_node["id"], relation_type["id"])
    #     self.add_relation_type(relation_type)
    #     self.add_node(value_node)
    #     self.add_relation(relation)
    #     return value_node, relation, relation_type

    def walk_ancestors(self, node_id: str, max_hops = 10):
        return self.walk_adjacent(node_id, max_hops, outgoing=False, incoming=True)

    def walk_descendants(self, node_id: str, max_hops = 10):
        return self.walk_adjacent(node_id, max_hops, outgoing=True, incoming=False)

    def walk_adjacent(self, node_id: str, max_hops = 10, outgoing = True, incoming = True):
        visited = set() 
        queue = deque([(node_id, 0)])
        while queue:
            current_id, hop = queue.popleft()
            if hop > 0 and current_id == global_root_node_id:
                continue
            if hop >= max_hops or current_id in visited:
                continue
            visited.add(current_id)

            if incoming:
                for relation_id in self._relations_by_to_id.get(current_id, []):
                    relation = self.get_relation(relation_id)
                    if not relation: continue
                    parent = self.get_node(relation["fromId"])
                    if not parent: continue
                    next_hop = hop + 1
                    yield relation, parent, next_hop
                    queue.append((relation["fromId"], next_hop))

            if outgoing:
                for relation_id in self._relations_by_from_id.get(current_id, []):
                    relation = self.get_relation(relation_id)
                    if not relation: continue
                    child = self.get_node(relation["toId"])
                    if not child: continue
                    next_hop = hop + 1
                    yield relation, child, next_hop
                    queue.append((relation["toId"], next_hop))

    def is_person(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation["relationTypeId"] == default_relation_types.type.id:
                to_node = self.get_node(relation["toId"])
                if to_node and to_node["id"] == person_type_node_id:
                    return True
        return False

    def is_extreme_talent(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation["relationTypeId"] == default_relation_types.ideapad_extreme_talent.id:
                return True
        return False

    def is_company(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation["relationTypeId"] == default_relation_types.type.id:
                to_node = self.get_node(relation["toId"])
                if to_node and to_node["id"] == company_type_node_id:
                    return True
        return False

    def is_investor(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation["relationTypeId"] == default_relation_types.type.id:
                to_node = self.get_node(relation["toId"])
                if to_node and to_node["id"] == investor_type_node_id:
                    return True
        return False

    def get_sizes(self):
        return {
            "nodes": len(self._graph["nodesById"]),
            "relations": len(self._graph["relationsById"]),
            "relation_types": len(self._graph["relationTypesById"]),
        }
    
    def to_dict(self) -> Dict[str, Dict]:
        return deepcopy(self._graph)


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
        relation_type = ""
    
    return indent_level, content, relation_type

def relation_type_text_to_id(relation_type_text: str) -> str:
    relation_type_text = relation_type_text.lower()
    for relation_type in default_relation_types:
        if relation_type.label == relation_type_text:
            return relation_type.id
    return f"relation-type-{'-'.join(relation_type_text.lower().split())}"

def hash_content(content: str) -> str:
    return hashlib.sha256(content.lower().encode()).hexdigest()

def hash_node(node):
    return hashlib.sha256(node["content"][0]["value"].lower().encode()).hexdigest()

def hash_relation(from_id: str, to_id: str, relation_type_id: str) -> str:
    ids = sorted([from_id, to_id])
    text = "".join([ids[0], ids[1], relation_type_id])
    return hashlib.sha256(text.lower().encode()).hexdigest()


def node_to_text(node: Dict[str, Any]) -> str:
    return node["content"][0]["value"]


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

def parse_text_graph(text: str, callback):
    """Parses text and calls callback for each node to handle graph creation.
    
    Args:
        text: The text to parse
        callback: Function that takes (content, parent_stack, relation_type_label) 
                 and returns the created node
    """
    parent_stack = []
    
    for line_num, line in enumerate(text.splitlines()):
        parsed = parse_line(line)
        if not parsed:
            continue
            
        indent_level, content, relation_type_label = parsed

        # Update parent stack based on indent level
        while len(parent_stack) > indent_level:
            parent_stack.pop()
            
        # Call callback to create node/relation and get node_id
        node = callback(content, parent_stack.copy(), relation_type_label)
        
        # Add new node's ID to parent stack
        parent_stack.append(node)

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
        
        # Add outgoing relations and "type" relations to queue (this is so we descend into e.g. "Person" and "Company" nodes)
        relations = graph.get_relations_with_from_id(current_node_id)
        relations.extend([r for r in graph.get_relations_with_to_id(current_node_id) if r["relationTypeId"] == "type"])
        for relation in relations:
            if is_ideapad_relation_type(relation["relationTypeId"]):
                continue
            next_node_id = relation["toId"] if relation["fromId"] == current_node_id else relation["fromId"]
            queue.append((next_node_id, relation["id"]))
    return graph


def unattribute_relations_to_node(graph: Graph, node_id: str):
    """
    Remove all ideapad_show_as flags on relations pointing to this node
    Sometimes before we know a node is a person, company, or investor, we flag it
    as an ideapad attribute. Later, when we learn the node is a person, company, or investor,
    we need to remove the ideapad_show_as flags on the relations pointing to it (otherwise
    the node gets filtered out of the graph).
    """
    node = graph.get_node(node_id)
    if not node: return
    relation_ids = []
    for relation in graph.get_relations_with_to_id(node_id):
        for meta_relation in graph.get_relations_with_from_id(relation["id"]):
            if meta_relation["relationTypeId"] == default_relation_types.ideapad_show_as.id:
                to_node = graph.get_node(meta_relation["toId"])
                if to_node and to_node["id"] == ideapad_show_as_attribute_node_id:
                    relation_ids.append(meta_relation["id"])
    for relation_id in relation_ids:
        graph.remove_relation(relation_id)


def make_person(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    relation = graph.upsert_relation(node_id, person_type_node_id, default_relation_types.type.id)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "13", key_id=default_relation_types.ideapad_color.id)

def make_company(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    # Add company type and flag as ideapad attribute
    relation = graph.upsert_relation(node["id"], company_type_node_id, default_relation_types.type.id)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "30", key_id=default_relation_types.ideapad_color.id)

def make_investor(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    relation = graph.upsert_relation(node["id"], investor_type_node_id, default_relation_types.type.id)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "22", key_id=default_relation_types.ideapad_color.id)

def make_extreme_talent_person(graph: Graph, node_id: str):
    # Add person type and flag as ideapad attribute
    relation = graph.upsert_relation(node_id, person_type_node_id, default_relation_types.type.id)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    # Add is_extreme_talent attribute
    _, is_extreme_talent_relation, _ = graph.upsert_property(node_id, "true", key_id=default_relation_types.ideapad_extreme_talent.id)
    make_ideapad_attribute(graph, is_extreme_talent_relation)
    graph.upsert_property(node_id, "15", key_id=default_relation_types.ideapad_color.id)

def make_ideapad_attribute(graph: Graph, relation: Union[Dict[str, Any], str, None]):
    if not relation: return
    relation = relation if isinstance(relation, dict) else graph.get_relation(relation) 
    if not relation: return
    # Don't allow on relations to person, company, or investor nodes
    to_node = graph.get_node(relation["toId"])
    if not to_node: return
    if graph.is_person(to_node["id"]): return
    if graph.is_company(to_node["id"]): return
    if graph.is_investor(to_node["id"]): return
    # Add ideapad_show_as attribute
    graph.upsert_relation(relation["id"], ideapad_show_as_attribute_node_id, default_relation_types.ideapad_show_as.id)

def make_ideapad_none(graph: Graph, node: Union[Dict[str, Any], str, None]):
    if not node: return
    node = node if isinstance(node, dict) else graph.get_node(node) 
    if not node: return
    graph.upsert_relation(node["id"], ideapad_show_as_none_node_id, default_relation_types.ideapad_show_as.id)

