import glob
import json
import os
import uuid
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict

import pandas as pd
from utils import Graph, create_graph

linkedin_dir = os.path.join('input-data', 'LinkedIn')

author_id = "global-admin"
global_users_id = "global-users-id"

def name_to_id(content):
    # Remove non-alphabetic characters and replace with whitespace
    content = ''.join(' ' if not c.isalpha() else c for c in content).lower()
    # Replace multiple whitespace with single dash
    return '-'.join(word for word in content.split() if word)

def url_to_id(content):
    return content.split("/")[-1].lower()

def create_node(content, id=None):
    """Helper to create a node matching SerializedNode schema"""
    return {
        "id": id if id else str(uuid.uuid4()),
        "authorId": author_id,
        "version": 1,
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
        "content": [{"type": "text", "value": content}],
        "isPublic": True,
        "isNewRelatedObjectsPublic": False,
        "canonicalRelationId": None
    }

def create_relation_type(label, reverse_label="", id=None):
    """Helper to create a relation type matching SerializedRelationType schema"""
    return {
        "id": id if id else str(uuid.uuid4()),
        "authorId": author_id,
        "version": 1,
        "label": label,
        "reverseLabel": reverse_label,
        "isPublic": True
    }

def create_relation(from_id, to_id, relation_type_id="child", id=None):
    """Helper to create a relation matching SerializedRelation schema"""
    return {
        "id": id if id else str(uuid.uuid4()),
        "fromId": from_id,
        "toId": to_id,
        "relationTypeId": relation_type_id,
        "version": 1,
        "authorId": author_id,
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
        "isPublic": True,
        "canonicalRelationId": None
    }

default_relation_types = [
    create_relation_type("works at", "employs", id="works-at"),
    create_relation_type("knows", "knows", id="knows"),
    create_relation_type("email address", "is Email Address of", id="email"),
    create_relation_type("LinkedIn URL", "is LinkedIn URL of", id="linkedin-url")
]

def graphify_linkedin(linkedin_folder, graph = None):
    # Initialize data structures
    graph = deepcopy(graph) if graph else create_graph()
    relation_types = graph["relationTypesById"]
    nodes = graph["nodesById"]
    relations = graph["relationsById"]

    # Add default relation types
    for relation_type in default_relation_types:
        relation_types[relation_type["id"]] = relation_type

    # Load LinkedIn data
    linkedin_files = glob.glob(f"{linkedin_folder}/*.csv")
    datasets = [] # { "linkedin_user_full_name": str, "linkedin_user_id": str, "df": pd.DataFrame }[]
    expected_columns = ["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"]
    for file in linkedin_files:
        print(f"Processing {file}")
        linkedin_user_full_name = os.path.splitext(os.path.basename(file))[0]
        linkedin_user_id = name_to_id(linkedin_user_full_name)
        df = pd.read_csv(file, skiprows=3)
        assert list(df.columns) == expected_columns, \
              f"Expected columns: {expected_columns}, but got {list(df.columns)}"
        df = df.dropna(subset=["First Name", "Last Name"])
        df["contact_id"] = (df["First Name"] + " " + df["Last Name"]).apply(name_to_id)
        df = df.drop_duplicates(subset=['contact_id'], keep='first')
        datasets.append({
            "linkedin_user_full_name": linkedin_user_full_name,
            "linkedin_user_id": linkedin_user_id,
            "df": df
        })

    # Create all the people nodes and connections
    people_nodes = {}
    knows_relations = {}
    for dataset in datasets:
        # Create person node for linkedin user
        people_nodes.setdefault(dataset["linkedin_user_id"], create_node(dataset["linkedin_user_full_name"], dataset["linkedin_user_id"]))
        for _, row in dataset["df"].iterrows():
            # Get or create person node for contact
            people_nodes.setdefault(row["contact_id"], create_node(row['First Name'] + " " + row['Last Name'], row["contact_id"]))

            # Create knows relation between linkedin user and contact. We use a set to avoid cases
            # where we have multiple connections between the same two people.
            connection_id = "-knows-".join(sorted([dataset["linkedin_user_id"], row["contact_id"]]))
            knows_relations.setdefault(connection_id, create_relation(dataset["linkedin_user_id"], row["contact_id"], "knows", id=connection_id))
    nodes.update(people_nodes)
    relations.update(knows_relations)

    # Add all people as children of global users
    for person_node in people_nodes.values():
        relation_to_global_users = create_relation(global_users_id, person_node["id"], id=f"{global_users_id}-to-{person_node['id']}")
        relations[relation_to_global_users["id"]] = relation_to_global_users

    # Add info about people
    people_info_df = pd.concat([dataset["df"] for dataset in datasets], ignore_index=True)
    people_info_df = people_info_df.drop_duplicates(subset=['contact_id'], keep='first')
    for _, row in people_info_df.iterrows():
        if row["contact_id"] not in people_nodes:
            continue

        # Company and position
        if pd.notna(row['Company']):
            company_id = name_to_id(row['Company'])
            company_node = nodes.setdefault(company_id, create_node(row['Company'], company_id))

            if pd.notna(row["Position"]):
                label_company_to_person = str(row["Position"]) # e.g. "CEO:"
                label_person_to_company = f"is {label_company_to_person} of" # e.g. "is CEO of:"
                position_relation_type_id = name_to_id(label_company_to_person)
                relation_types.setdefault(position_relation_type_id, create_relation_type(label_person_to_company, label_company_to_person, id=position_relation_type_id))
            else:
                position_relation_type_id = "works-at"

            relation = create_relation(row["contact_id"], company_node["id"], position_relation_type_id)
            relations[relation["id"]] = relation

        # URL
        if pd.notna(row["URL"]):
            url_relation_type = relation_types["linkedin-url"]
            url_node = create_node(row["URL"])
            nodes[url_node["id"]] = url_node
            url_relation = create_relation(row["contact_id"], url_node["id"], url_relation_type["id"])
            relations[url_relation["id"]] = url_relation

        # Email
        if pd.notna(row["Email Address"]):
            email_relation_type = relation_types["email"]
            email_node = create_node(row["Email Address"])
            nodes[email_node["id"]] = email_node
            email_relation = create_relation(row["contact_id"], email_node["id"], email_relation_type["id"])
            relations[email_relation["id"]] = email_relation

    return graph

def filter_for_top_people(graph: Dict[str, Any]): 
    relations_by_node_id = {}
    for relation in graph["relationsById"].values():
        relations_by_node_id.setdefault(relation["fromId"], []).append(relation)
        relations_by_node_id.setdefault(relation["toId"], []).append(relation)

    # Get all people ids
    people_ids = set()
    for relation in relations_by_node_id[global_users_id]:
        people_ids.add(relation["toId"])
    
    # Select 50 people with most relations 
    relations_by_people_id = {id: relations_by_node_id[id] for id in people_ids}
    people_id_relation_tuples = sorted(relations_by_people_id.items(), key=lambda x: len(x[1]), reverse=True)
    top_people_ids = set(people_id for people_id, _ in people_id_relation_tuples[:50])

    # Filter nodes and relations
    filtered_nodes = {}
    filtered_relations = {}
    for relation in graph["relationsById"].values():
        # Skip relations between people if not both in top 50
        if (relation["fromId"] in people_ids and 
            relation["toId"] in people_ids and 
            not (relation["fromId"] in top_people_ids and 
                 relation["toId"] in top_people_ids)):
            continue
            
        # Skip relations not connected to any top person
        if not (relation["fromId"] in top_people_ids or 
                relation["toId"] in top_people_ids):
            continue

        # Add relation and its nodes
        filtered_relations[relation["id"]] = relation
        for node_id in (relation["fromId"], relation["toId"]):
            if node := graph["nodesById"].get(node_id):
                filtered_nodes[node_id] = node
    return {
        "nodesById": filtered_nodes,
        "relationsById": filtered_relations,
        "relationTypesById": graph["relationTypesById"],
        "nodesByContent": graph["nodesByContent"]
    }

if __name__ == "__main__":

    # Full version
    graph = graphify_linkedin(linkedin_dir)
    with open("output-data/lidemo.json", "w") as f:
        json.dump(graph, f, indent=2)

    # Lite version
    graph_lite = filter_for_top_people(graph)
    with open("output-data/lidemo-lite.json", "w") as f:
        json.dump(graph_lite, f, indent=2)
