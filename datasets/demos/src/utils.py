import hashlib
import os
import re
import uuid
from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Iterator, List, Set, Union, Tuple, Callable, TypedDict

GraphDict = Dict[str, Dict] 

# Paths
data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
input_dir = os.path.join(data_dir, 'input')
output_dir = os.path.join(data_dir, 'output')
stanford_labs_path = os.path.join(input_dir, 'stanford-independent-labs.txt')
crunchbase_dir = os.path.join(input_dir, 'crunchbase')
josh_langsam_path = os.path.join(input_dir, 'josh-langam.json')
laurel_touby_path = os.path.join(input_dir, 'laureltouby.txt')
extreme_talent_lists_dir = os.path.join(input_dir, "extreme-talent-lists")
linkedin_dir = os.path.join(input_dir, 'linkedin')
extreme_talent_lists_paths = {
    "intelligentcrazypeople": os.path.join(extreme_talent_lists_dir, "intelligentcrazypeople.txt"),
    "CPHOF": os.path.join(extreme_talent_lists_dir, "CPHOF.txt"),
    "YC Companies": os.path.join(extreme_talent_lists_dir, "YC Companies_flattened.txt"),
    "International Olympiad Winners": os.path.join(extreme_talent_lists_dir, "International Olympiad Winners.txt"),
    "Misc Competition Winners": os.path.join(extreme_talent_lists_dir, "Misc Competition Winners.txt"),
    "MLH Top Hackers": os.path.join(extreme_talent_lists_dir, "MLH Top Hackers.txt"),
    "Scholarships and Fellowships List": os.path.join(extreme_talent_lists_dir, "Scholarships and Fellowships List.txt"),
}
yc_companies_path = os.path.join(input_dir, "YC Companies_flattened.txt")

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
    ideapad_extreme_talent_list = RelationTypeClass("ideapad_extreme_talent_list", "is_extreme_talent_list", "is_extreme_talent_list_of")
    ideapad_extreme_talent_source_lists = RelationTypeClass("ideapad_extreme_talent_source_lists", "extreme_talent_source_lists", "extreme_talent_source_lists_of")
    website_url = RelationTypeClass("website-url", "website URL", "is website URL of")
    founder = RelationTypeClass("founder", "founder", "is founder of")
    description = RelationTypeClass("description", "description", "is description of")
    industry = RelationTypeClass("industry", "Industry", "is Industry of")
    investor = RelationTypeClass("investor", "investor", "is investor of")

    def __iter__(self) -> Iterator[RelationTypeClass]:
        # This returns all class variables that are RelationType instances
        return iter([v for v in vars(self.__class__).values() 
                    if isinstance(v, RelationTypeClass)])

    def get_by_label(self, label: str):
        for relation_type in self:
            if relation_type.label == label:
                return relation_type
        return None

default_relation_types = DefaultRelationTypes()

def is_ideapad_relation_type(relation_type_label: str) -> bool:
    return relation_type_label in [
        default_relation_types.ideapad_show_as.label,
        default_relation_types.ideapad_color.label,
        default_relation_types.ideapad_extreme_talent.label,
        default_relation_types.ideapad_extreme_talent_list.label,
        default_relation_types.ideapad_extreme_talent_source_lists.label,
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
global_admin_author_id = "global-admin"
global_root_node_id = "global-root-id"
global_users_id = "global-users-id"
linkedin_users_node_id = "linkedin-users-node-id"
extreme_talent_lists_node_id = "extreme-talent-lists-node-id"
laurel_touby_id = "laurel-touby"
vcs_list_id = "vcs_list_node_id"
person_type_node_id = "person-type-node-id"
company_type_node_id = "company-type-node-id"
investor_type_node_id = "investor-type-node-id"
class TypeNodeIds(Enum):
    person_id = person_type_node_id
    company_id = company_type_node_id 
    investor_id = investor_type_node_id
ideapad_show_as_none_node_id = "ideapad-show-as-none"
ideapad_show_as_attribute_node_id = "ideapad-show-as-attribute"

# Node = GraphNode

class GraphNode:
    id: str
    content: str
    content: str
    canonical_relation_id: Union[str, None]

    def __init__(self, content: str, canonical_relation_id: Union[str, None] = None, id: Union[str, None] = None):
        self.id = id or str(uuid.uuid4())
        self.content = content
        self.canonical_relation_id = canonical_relation_id

    def __repr__(self):
        return f"GraphNode(content={self.content}, id={self.id})"

    def __str__(self):
        return self.__repr__()
    
    def to_dict(self):
        return {
            "id": self.id,
            "authorId": global_admin_author_id,
            "version": 1,
            "content":[{ "type": "text", "value": self.content }],
            "isPublic": True,
            "isNewRelatedObjectsPublic": False,
            "canonicalRelationId": self.canonical_relation_id
        }

class GraphRelation:
    id: str
    from_id: str
    to_id: str
    relation_type_label: str
    canonical_relation_id: Union[str, None]

    def __init__(self, from_id: str, to_id: str, relation_type_label: str = "child", canonical_relation_id: Union[str, None] = None, id: Union[str, None] = None):
        self.id = id or str(uuid.uuid4())
        self.from_id = from_id
        self.to_id = to_id
        self.relation_type_label = relation_type_label
        self.canonical_relation_id = canonical_relation_id

    def __repr__(self):
        return f"GraphRelation(label={self.relation_type_label}, from_id={self.from_id}, to_id={self.to_id}, id={self.id})"

    def to_dict(self):
        return {
            "id": self.id,
            "fromId": self.from_id,
            "toId": self.to_id,
            "relationTypeId": "child",
            "version": 1,
            "authorId": global_admin_author_id,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "isPublic": True,
            "canonicalRelationId": self.canonical_relation_id
        }


def create_node(content: str, id = None):
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

# RelationType = Dict[str, Any]

# def create_relation_type(label: str, reverse_label = None, id = None) -> RelationType:
#     """Create a relation type matching SerializedRelationType schema"""
#     reverse_label = reverse_label or f"is {label} of"
#     return {
#         "id": id or str(uuid.uuid4()),
#         "authorId": "global-admin",
#         "version": 1,
#         "label": label,
#         "reverseLabel": reverse_label,
#         "isPublic": True
#     }

class IdeapadMetadata(TypedDict):
    is_ideapad_show_as_none: bool
    is_ideapad_show_as_attribute: bool

class Graph:
    nodes: Dict[str, GraphNode]
    relations: Dict[str, GraphRelation]
    # Ideapad metadata
    _is_ideapad_show_as_attribute_relation_type_labels: Set[str]
    _is_ideapad_show_as_none_object_ids: Set[str]
    # Indexes
    _nodes_by_content: Dict[str, str]
    _relations_by_content: Dict[str, str]
    _relations_by_from_id: Dict[str, Set[str]]
    _relations_by_to_id: Dict[str, Set[str]]
    _default_node_ids: Set[str]

    def __init__(self, nodes: Dict[str, GraphNode] = {}, relations: Dict[str, GraphRelation] = {}):
        self.nodes = deepcopy(nodes)
        self.relations = deepcopy(relations)
        self._nodes_by_content = {}
        self._relations_by_content = {}
        self._relations_by_from_id = defaultdict(set)
        self._relations_by_to_id = defaultdict(set)
        self._default_node_ids = set()
        self._is_ideapad_show_as_attribute_relation_type_labels = set()
        self._is_ideapad_show_as_none_object_ids = set()
        self.reindex()

        # Add default data
        # for relation_type in default_relation_types:
        #     if relation_type.id not in self._graph["relationTypesById"]:
        #         self.add_relation_type(create_relation_type(relation_type.label, relation_type.reverse_label, id=relation_type.id))

        # Add default nodes
        self.upsert_node("Global Root", id=global_root_node_id)
        self.upsert_node("Person", id=person_type_node_id)
        self.upsert_node("Company", id=company_type_node_id)
        self.upsert_node("Investor", id=investor_type_node_id)
        self._default_node_ids.add(global_root_node_id)
        self._default_node_ids.add(person_type_node_id)
        self._default_node_ids.add(company_type_node_id)
        self._default_node_ids.add(investor_type_node_id)

        # Ideapad-specific nodes
        self.upsert_node("none", id=ideapad_show_as_none_node_id)
        self.upsert_node("attribute", id=ideapad_show_as_attribute_node_id)
        self.upsert_relation(global_root_node_id, ideapad_show_as_none_node_id, default_relation_types.ideapad_show_as.label)
        self._default_node_ids.add(ideapad_show_as_none_node_id)
        self._default_node_ids.add(ideapad_show_as_attribute_node_id)

    def reindex(self):
        for node in self.nodes.values():
            self._nodes_by_content[hash_node(node)] = node.id
        for relation in self.relations.values():
            hash = hash_relation(relation.from_id, relation.to_id, relation.relation_type_label)
            self._relations_by_content[hash] = relation.id
            self._relations_by_from_id[relation.from_id].add(relation.id)
            self._relations_by_to_id[relation.to_id].add(relation.id)

    def copy(self):
        graph_copy = Graph(nodes=deepcopy(self.nodes), relations=deepcopy(self.relations))
        graph_copy._is_ideapad_show_as_attribute_relation_type_labels = deepcopy(self._is_ideapad_show_as_attribute_relation_type_labels)
        graph_copy._is_ideapad_show_as_none_object_ids = deepcopy(self._is_ideapad_show_as_none_object_ids)
        return graph_copy

    def has(self, id: str):
        return id in self.nodes or id in self.relations

    def get_node(self, id: str):
        """Get a node by id"""
        return self.nodes.get(id)
    
    def get_relation(self, id: str):
        """Get a relation by id"""
        return self.relations.get(id)

    # def get_relation_type(self, id: str):
    #     """Get a relation type by id"""
    #     return self.relation_types.get(id)

    def get_relations_with_from_id(self, from_id: str) -> List[GraphRelation]:
        relations = []
        for relation_id in self._relations_by_from_id.get(from_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            relations.append(relation)
        return relations
    
    def get_relations_with_to_id(self, to_id: str) -> List[GraphRelation]:
        relations = []
        for relation_id in self._relations_by_to_id.get(to_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            relations.append(relation)
        return relations

    def get_related_nodes_from_id(self, from_id: str) -> List[GraphNode]:
        """
        Get all nodes that are related to the provided node id
        where the relation goes from the provided node id
        """
        nodes = {}
        for relation_id in self._relations_by_from_id.get(from_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            node = self.get_node(relation.to_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def get_related_nodes_to_id(self, to_id: str) -> List[GraphNode]:
        """
        Get all nodes that are related to the provided node id
        where the relation goes to the provided node id
        """
        nodes = {}
        for relation_id in self._relations_by_to_id.get(to_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            node = self.get_node(relation.from_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def get_related_nodes(self, node_id: str):
        return self.get_related_nodes_from_id(node_id) + self.get_related_nodes_to_id(node_id)

    def get_node_by_content(self, content: str):
        content_hash = hash_content(content)
        node_id = self._nodes_by_content.get(content_hash)
        if not node_id:
            return None
        return self.get_node(node_id)

    def get_nodes(self):
        return list(self.nodes.values())
    
    def get_relations(self):
        return list(self.relations.values())
    
    # def get_relation_types(self):
    #     return list(self.relation_types.values())

    def get_people_nodes(self) -> List[GraphNode]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(person_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation.relation_type_label != "type": continue
            node = self.get_node(relation.from_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def get_companies_nodes(self) -> List[GraphNode]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(company_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation.relation_type_label != "type": continue
            node = self.get_node(relation.from_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def get_investor_nodes(self) -> List[GraphNode]:
        nodes = {}
        for relation_id in self._relations_by_to_id.get(investor_type_node_id, []):
            relation = self.get_relation(relation_id)
            if not relation: continue
            if relation.relation_type_label != "type": continue
            node = self.get_node(relation.from_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def get_extreme_talent_nodes(self) -> List[GraphNode]:
        nodes = {}
        for relation in self.relations.values():
            if relation.relation_type_label != "extreme-talent": continue
            node = self.get_node(relation.from_id)
            if not node: continue
            nodes[node.id] = node
        return list(nodes.values())

    def add_node(self, node):
        if not node:
            return
        self.nodes[node.id] = node
        self._nodes_by_content[hash_node(node)] = node.id

    def remove_node(self, node_id: str):
        node = self.get_node(node_id)
        if not node:
            return
        if node_id in self._default_node_ids:
            print(f"WARNING: Not removing default node {node_id}")
            return
        del self.nodes[node_id]
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
        if relation.id in self.relations:
            return
        self.relations[relation.id] = relation
        hash = hash_relation(relation.from_id, relation.to_id, relation.relation_type_label)
        self._relations_by_content[hash] = relation.id
        self._relations_by_from_id[relation.from_id].add(relation.id)
        self._relations_by_to_id[relation.to_id].add(relation.id)
    
    def remove_relation(self, relation_id: str):
        relation = self.get_relation(relation_id)
        if not relation:
            return
        self._relations_by_from_id[relation.from_id].remove(relation_id)
        self._relations_by_to_id[relation.to_id].remove(relation_id)
        if relation_id in self.relations:
            del self.relations[relation_id]
        hash = hash_relation(relation.from_id, relation.to_id, relation.relation_type_label)
        if hash in self._relations_by_content:
            del self._relations_by_content[hash]

    # def remove_relation_type(self, relation_type_id: str):
    #     if relation_type_id in self._graph["relationTypesById"]:
    #         del self._graph["relationTypesById"][relation_type_id]

    # def upsert_type_to_node(self, node_id: str, type_id: str) -> None:
    #     if type_id not in type_node_ids:
    #         raise Exception(f"Type node with id {type_id} not in graph")
    #     self.upsert_relation(node_id, type_id, relation_type_id="type")
    
    def get_or_create_node(self, content: str, id = None) -> GraphNode:
        """Get existing node by content or create a new one"""
        if id and id in self.nodes:
            return self.nodes[id]
        content_hash = hash_content(content)
        if content_hash in self._nodes_by_content:
            id = self._nodes_by_content[content_hash]
            return self.nodes[id]
        else:
            return GraphNode(content, id=id)
    
    def get_or_create_relation(self, from_id: str, to_id: str, relation_type_label: str = "child", id = None) -> GraphRelation:
        """Get existing relation or create a new one"""
        hash = hash_relation(from_id, to_id, relation_type_label)
        id = self._relations_by_content.get(hash)
        if id:
            return self.relations[id]
        return GraphRelation(
            from_id=from_id,
            to_id=to_id,
            relation_type_label=relation_type_label,
            id=id
        )
    
    # def get_or_create_relation_type(self, label = None, reverse_label = None, id = None) -> GraphNode:
    #     """Get existing relation type by label or create a new one"""
    #     if id:
    #         if id in self.relation_types:
    #             return self.relation_types[id]
    #         else:
    #             return create_relation_type(label or id, reverse_label, id=id)
    #     if label:
    #         relation_type_id = relation_type_text_to_id(label)
    #         if relation_type_id in self._graph["relationTypesById"]:
    #             return self._graph["relationTypesById"][relation_type_id]
    #         else:
    #             return create_relation_type(label, reverse_label, id=relation_type_id)
    #     return self._graph["relationTypesById"]["child"]
    
    def upsert_node(self, content: str, id = None):
        """Upsert a node to the graph and update the content index"""
        node = self.get_or_create_node(content, id=id)
        self.add_node(node)
        return node

    def upsert_relation(self, from_id: str, to_id: str, relation_type_label: str = "child", id = None):
        """Upsert a relation to the graph and update the content index"""
        if from_id == to_id:
            print("WARNING: from_id == to_id", from_id, to_id)
            return
        relation = self.get_or_create_relation(from_id, to_id, relation_type_label, id=id)
        self.add_relation(relation)
        return relation

    # def upsert_relation_type(self, label = None, reverse_label: str = None, id = None):
    #     """Upsert a relation type to the graph"""
    #     if id and id in self._graph["relationTypesById"]:
    #         return self._graph["relationTypesById"][id]
    #     if not label:
    #         return self._graph["relationTypesById"][id or "child"]
    #     relation_type = self.get_or_create_relation_type(label, reverse_label, id=id)
    #     self.add_relation_type(relation_type)
    #     return relation_type
    
    def upsert_related_node(self, parent_id: str, value: Union[str, GraphNode], relation_type_label: str = "child", upsert_node = None) -> Tuple[GraphNode, GraphRelation]:
        # Special case for linkedin and website
        label_str_lower = relation_type_label.lower()
        is_labelled_number = isinstance(value, str) and re.match(r"\d+", value)

        if upsert_node is None:
            if  (value == "" or is_labelled_number) or \
                ("linkedin" in label_str_lower) or \
                ("website" in label_str_lower or "link" == label_str_lower) or \
                ("description" in label_str_lower):
                upsert_node = False
            else:
                upsert_node = True

        # if value == "" or is_labelled_number:
        #     relation_type = self.get_or_create_relation_type(label) if isinstance(label, str) else label
        #     upsert_node = upsert_node if upsert_node is not None else False
        # elif "linkedin" in label_str_lower:
        #     r = default_relation_types.linkedin_url
        #     relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
        #     upsert_node = upsert_node if upsert_node is not None else False
        # elif "website" in label_str_lower or "link" == label_str_lower:
        #     r = default_relation_types.website_url
        #     relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
        #     upsert_node = upsert_node if upsert_node is not None else False
        # elif "description" in label_str_lower:
        #     r = default_relation_types.description
        #     relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
        #     upsert_node = upsert_node if upsert_node is not None else False
        # elif label is None:
        #     r = default_relation_types.child
        #     relation_type = self.upsert_relation_type(r.label, r.reverse_label, r.id)
        #     upsert_node = upsert_node if upsert_node is not None else True
        # else:
        #     relation_type = self.get_or_create_relation_type(label) if isinstance(label, str) else label
        #     upsert_node = upsert_node if upsert_node is not None else True

        if isinstance(value, GraphNode):
            # If a node was given, add it
            node = value
            self.add_node(node)
        else:
            # When it's a string, upsert or not either based on the provided flag
            # or the special cases above
            if upsert_node == True:
                node = self.upsert_node(value)
            else:
                node = GraphNode(value)
                self.add_node(node)

        # Add relation
        # self.add_relation_type(relation_type)
        relation = self.upsert_relation(parent_id, node.id, relation_type_label)
        if not relation:
            parent_node = self.get_node(parent_id)
            raise Exception(f"Failed to create relation between {parent_node} and {node} with label {relation_type_label}")

        return node, relation

    def upsert_property(self, parent_id: str, value: str, relation_type_label: str = "child"):
        parent_node = self.get_node(parent_id)
        if not parent_node:
            raise Exception(f"Node with id {parent_id} not in graph")

        # If there's a relation with the same label, delete it
        for relation, target_node, _ in self.walk_descendants(parent_id, 1):
            if relation.relation_type_label == relation_type_label:
                self.remove_relation(relation.id)
                break
        
        value_node = GraphNode(value)
        relation = self.upsert_relation(parent_id, value_node.id, relation_type_label)
        self.add_node(value_node)
        self.add_relation(relation)
        return value_node, relation

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
                    parent = self.get_node(relation.from_id)
                    if not parent: continue
                    next_hop = hop + 1
                    yield relation, parent, next_hop
                    queue.append((relation.from_id, next_hop))

            if outgoing:
                for relation_id in self._relations_by_from_id.get(current_id, []):
                    relation = self.get_relation(relation_id)
                    if not relation: continue
                    child = self.get_node(relation.to_id)
                    if not child: continue
                    next_hop = hop + 1
                    yield relation, child, next_hop
                    queue.append((relation.to_id, next_hop))

    def is_person(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation.relation_type_label == default_relation_types.type.label:
                to_node = self.get_node(relation.to_id)
                if to_node and to_node.id == person_type_node_id:
                    return True
        return False

    def is_typed(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation.relation_type_label == default_relation_types.type.label:
                return True
        return False

    def is_extreme_talent(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation.relation_type_label == default_relation_types.ideapad_extreme_talent.label:
                return True
        return False

    def is_company(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation.relation_type_label == default_relation_types.type.label:
                to_node = self.get_node(relation.to_id)
                if to_node and to_node.id == company_type_node_id:
                    return True
        return False

    def is_investor(self, node_id: str) -> bool:
        node = self.get_node(node_id)
        if not node: return False
        for relation in self.get_relations_with_from_id(node_id):
            if relation.relation_type_label == default_relation_types.type.label:
                to_node = self.get_node(relation.to_id)
                if to_node and to_node.id == investor_type_node_id:
                    return True
        return False

    def get_sizes(self):
        return {
            "nodes": len(self.nodes),
            "relations": len(self.relations),
        }
    
    def to_dict(self):
        result = {
            "nodesById": {node.id: node.to_dict() for node in self.nodes.values()},
            "relationsById": {relation.id: relation.to_dict() for relation in self.relations.values()},
        }

        # Add __user_relation_types__ node as child of global root node
        user_relation_types_node = {
            "id": "user-relation-types-node-id-" + global_admin_author_id,
            "content": [{ "type": "text", "value": "__user_relation_types__" }],
            "authorId": global_admin_author_id,
            "isPublic": True,
            "isNewRelatedObjectsPublic": False,
            "canonicalRelationId": None,
        }
        global_root_to_user_relation_types_relation = {
            "id": str(uuid.uuid4()),
            "fromId": global_root_node_id,
            "toId": user_relation_types_node["id"],
            "relationTypeId": "child",
            "version": 1,
            "isPublic": True,
            "canonicalRelationId": None,
        }
        result["nodesById"][user_relation_types_node["id"]] = user_relation_types_node
        result["relationsById"][global_root_to_user_relation_types_relation["id"]] = global_root_to_user_relation_types_relation

        # Add user relation types
        label_to_relation_type_node_id: Dict[str, str] = {}
        for relation in self.relations.values():
            label = relation.relation_type_label
            if label == "child" or label == "":
                continue
            if label in label_to_relation_type_node_id:
                relation_type_node_id = label_to_relation_type_node_id[label]
            else:
                # If label matches a default relation type, use it
                default_relation_type = default_relation_types.get_by_label(label)
                if default_relation_type:
                    id = default_relation_type.id
                    reverse_relation_label = default_relation_type.reverse_label
                else:
                    id = str(uuid.uuid4())
                    reverse_relation_label = f'is {label} of'
                # Create new relation type node
                relation_type_node = {
                    "id": id,
                    "content": [{ "type": "text", "value": label }],
                    "authorId": global_admin_author_id,
                    "isPublic": True,
                    "isNewRelatedObjectsPublic": False,
                    "canonicalRelationId": None,
                }
                relation_type_node_id = relation_type_node["id"]
                result["nodesById"][relation_type_node["id"]] = relation_type_node

                # Add __user_relation_types__ -[sublist]-> relation_type_node
                relation_type_node_to_user_relation_types_node = {
                    "id": str(uuid.uuid4()),
                    "fromId": user_relation_types_node["id"],
                    "toId": relation_type_node["id"],
                    "relationTypeId": "sublist",
                    "version": 1,
                    "isPublic": True,
                    "canonicalRelationId": None,
                }
                result["relationsById"][relation_type_node_to_user_relation_types_node["id"]] = relation_type_node_to_user_relation_types_node
                # Add relation_type_node -[__reverse__]-> __user_relation_types__
                reverse_label_node = {
                    "id": str(uuid.uuid4()),
                    "content": [{ "type": "text", "value": reverse_relation_label }],
                    "authorId": global_admin_author_id,
                    "isPublic": True,
                    "isNewRelatedObjectsPublic": False,
                    "canonicalRelationId": None,
                }
                result["nodesById"][reverse_label_node["id"]] = reverse_label_node
                relation_type_node_to_reverse_label_node = {
                    "id": str(uuid.uuid4()),
                    "fromId": relation_type_node["id"],
                    "toId": reverse_label_node["id"],
                    "relationTypeId": "__reverse__",
                    "version": 1,
                    "isPublic": True,
                    "canonicalRelationId": None,
                }
                result["relationsById"][relation_type_node_to_reverse_label_node["id"]] = relation_type_node_to_reverse_label_node
                label_to_relation_type_node_id[label] = relation_type_node_id

            # Add relation -[__type__]-> relation_type_node
            relation_to_relation_type_node = {
                "id": str(uuid.uuid4()),
                "fromId": relation.id,
                "toId": relation_type_node_id,
                "relationTypeId": "__type__",
                "version": 1,
                "isPublic": True,
                "canonicalRelationId": None,
            }
            result["relationsById"][relation_to_relation_type_node["id"]] = relation_to_relation_type_node

        # Add relations defining ideapad_show_as=none/attribute
        def add_relations_defining_ideapad_show_as(object_id: str, value_node_id: str):
            '''
            Object -[child]-> Node(text: attribute/none)
                      |
                  [__type__]-> Node(text: ideapad_show_as)
            '''
            type_to_attribute_value_relation = {
                "id": str(uuid.uuid4()),
                "fromId": object_id,
                "toId": value_node_id,
                "relationTypeId": "child",
                "version": 1,
                "isPublic": True,
                "canonicalRelationId": None,
            }
            result["relationsById"][type_to_attribute_value_relation["id"]] = type_to_attribute_value_relation
            relation_defining_relation_type = {
                "id": str(uuid.uuid4()),
                "fromId": type_to_attribute_value_relation["id"],
                "toId": default_relation_types.ideapad_show_as.id,
                "relationTypeId": "__type__",
                "version": 1,
                "isPublic": True,
                "canonicalRelationId": None,
            }
            result["relationsById"][relation_defining_relation_type["id"]] = relation_defining_relation_type
        for label in self._is_ideapad_show_as_attribute_relation_type_labels:
            relation_type_node_id = label_to_relation_type_node_id.get(label)
            if relation_type_node_id:
                add_relations_defining_ideapad_show_as(relation_type_node_id, ideapad_show_as_attribute_node_id)
        for object_id in self._is_ideapad_show_as_none_object_ids:
            object = self.get_node(object_id) or self.get_relation(object_id)
            if not object: continue
            add_relations_defining_ideapad_show_as(object.id, ideapad_show_as_none_node_id)

        return result

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

def hash_node(node: GraphNode) -> str:
    return hashlib.sha256(node.content.lower().encode()).hexdigest()

def hash_relation(from_id: str, to_id: str, relation_type_id: str) -> str:
    ids = sorted([from_id, to_id])
    text = "".join([ids[0], ids[1], relation_type_id])
    return hashlib.sha256(text.lower().encode()).hexdigest()


def node_to_text(node: GraphNode) -> str:
    return node.content


# def add_text_graph(text: str, root_node_id=None, graph: Union[None, Graph] = None) -> Graph:
#     graph = graph or Graph()

#     parent_stack = [root_node_id] if root_node_id else []
#     min_parents = len(parent_stack)
    
#     for line in text.splitlines():
#         # Parse line
#         parsed = parse_line(line)
#         if not parsed: continue
#         indent_level, content, relation_type_label = parsed

#         # Update parent stack based on indent level
#         while len(parent_stack) > indent_level + min_parents:
#             parent_stack.pop()
            
#         # Add node and relation to parent
#         node = graph.upsert_node(content)
#         if parent_stack:
#             parent_id = parent_stack[-1]
#             relation_type = graph.upsert_relation_type(relation_type_label)
#             graph.upsert_relation(parent_id, node["id"], relation_type["id"])
            
#         parent_stack.append(node["id"])

#     return graph

ParseTextGraphCallback = Callable[[str, List[GraphNode], str], Union[GraphNode, None]]

def parse_text_graph(text: str, callback: ParseTextGraphCallback):
    """Parses text and calls callback for each node to handle graph creation.
    
    Args:
        text: The text to parse
        callback: Function that takes (content, parent_stack, relation_type_label) 
                 and returns the created node or None to skip children
    """
    parent_stack = []
    skip_until_indent = None
    
    for line_num, line in enumerate(text.splitlines()):
        parsed = parse_line(line)
        if not parsed:
            continue
            
        indent_level, content, relation_type_label = parsed

        # If we're skipping and haven't reached a line with same/lower indent, continue
        if skip_until_indent is not None and indent_level > skip_until_indent:
            continue

        # We've reached a line with same/lower indent, stop skipping
        skip_until_indent = None

        # Update parent stack based on indent level
        while len(parent_stack) > indent_level:
            parent_stack.pop()
            
        # Call callback to create node/relation and get node_id
        node = callback(content, parent_stack.copy(), relation_type_label)
        
        # If callback returns None, skip all children until we hit same/lower indent
        if node is None:
            skip_until_indent = indent_level
            continue
            
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
    max_steps = len(graph.nodes) + 10
    steps = 0
    visited = set()
    queue: deque[tuple[str, Union[str, None]]] = deque([(root_node.id, None)])
    while queue:
        current_node_id, parent_relation_id = queue.popleft()
        if not current_node_id or current_node_id in visited: continue
        current_node = graph.get_node(current_node_id)
        if not current_node: continue

        # Assign canonical relation
        visited.add(current_node_id)
        current_node.canonical_relation_id = parent_relation_id
        steps += 1
        if steps > max_steps:
            print(f"WARNING: Max steps while assigning canonical relations")
            break
        
        # Add outgoing relations and "type" relations to queue (this is so we descend into e.g. "Person" and "Company" nodes)
        relations = graph.get_relations_with_from_id(current_node_id)
        relations.extend([r for r in graph.get_relations_with_to_id(current_node_id) if r.relation_type_label == "type"])
        for relation in relations:
            if is_ideapad_relation_type(relation.relation_type_label):
                continue
            next_node_id = relation.to_id if relation.from_id == current_node_id else relation.from_id
            queue.append((next_node_id, relation.id))
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
        for meta_relation in graph.get_relations_with_from_id(relation.id):
            if meta_relation.relation_type_label == default_relation_types.ideapad_show_as.label:
                to_node = graph.get_node(meta_relation.to_id)
                if to_node and to_node.id == ideapad_show_as_attribute_node_id:
                    relation_ids.append(meta_relation.id)
    for relation_id in relation_ids:
        graph.remove_relation(relation_id)

def make_person(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    if graph.is_person(node_id): return
    relation = graph.upsert_relation(node_id, person_type_node_id, default_relation_types.type.label)
    if relation is None: return
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "13", default_relation_types.ideapad_color.label)

def make_company(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    if graph.is_company(node_id): return
    # Add company type and flag as ideapad attribute
    relation = graph.upsert_relation(node.id, company_type_node_id, default_relation_types.type.label)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "30", default_relation_types.ideapad_color.label)

def make_investor(graph: Graph, node_id: str):
    node = graph.get_node(node_id)
    if not node: return
    if graph.is_investor(node_id): return
    relation = graph.upsert_relation(node.id, investor_type_node_id, default_relation_types.type.label)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    graph.upsert_property(node_id, "22", default_relation_types.ideapad_color.label)

def make_extreme_talent_person(graph: Graph, node_id: str):
    # Add person type and flag as ideapad attribute
    relation = graph.upsert_relation(node_id, person_type_node_id, default_relation_types.type.label)
    make_ideapad_attribute(graph, relation)
    unattribute_relations_to_node(graph, node_id)
    # Add is_extreme_talent attribute
    result = graph.upsert_property(
        parent_id=node_id, 
        value="true", 
        relation_type_label=default_relation_types.ideapad_extreme_talent.label,
    )
    if result is None: return
    make_ideapad_attribute(graph, result[1])
    graph.upsert_property(node_id, "15", default_relation_types.ideapad_color.label)

def make_extreme_talent_list(graph: Graph, node_id: str):
    result = graph.upsert_property(
        parent_id=node_id, 
        value="true", 
        relation_type_label=default_relation_types.ideapad_extreme_talent_list.label,
    )
    if result is None: return
    make_ideapad_attribute(graph, result[1])
    graph.upsert_property(node_id, "55", default_relation_types.ideapad_color.label)

def upsert_extreme_talent_source_lists(graph: Graph, node_id: str, ancestor_path_string: str):
    node = graph.get_node(node_id)
    if not node: return
    result = graph.upsert_property(
        parent_id=node_id, 
        value=ancestor_path_string, \
        relation_type_label=default_relation_types.ideapad_extreme_talent_source_lists.label,
    )
    if result is None: return
    make_ideapad_attribute(graph, result[1])

def make_ideapad_attribute(graph: Graph, relation: Union[GraphRelation, str, None]):
    if not relation: return
    relation = relation if isinstance(relation, GraphRelation) else graph.get_relation(relation) 
    if not relation: return
    # Don't allow on relations to person, company, or investor nodes
    to_node = graph.get_node(relation.to_id)
    if not to_node: return
    if graph.is_person(to_node.id): return
    if graph.is_company(to_node.id): return
    if graph.is_investor(to_node.id): return
    # Add ideapad_show_as attribute
    graph._is_ideapad_show_as_attribute_relation_type_labels.add(relation.relation_type_label)

def make_ideapad_none(graph: Graph, node: Union[GraphNode, str, None]):
    if not node: return
    node = node if isinstance(node, GraphNode) else graph.get_node(node) 
    if not node: return
    graph._is_ideapad_show_as_none_object_ids.add(node.id)

