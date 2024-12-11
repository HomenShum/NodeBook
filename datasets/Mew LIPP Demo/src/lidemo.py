import glob
import json
import os
from typing import Any, Dict

import pandas as pd
from utils import *


def name_to_id(content):
    # Remove non-alphabetic characters and replace with whitespace
    content = ''.join(' ' if not c.isalpha() else c for c in content).lower()
    # Replace multiple whitespace with single dash
    return '-'.join(word for word in content.split() if word)

def url_to_id(content):
    return content.split("/")[-1].lower()

def add_linkedin(graph = None):
    # Initialize graph
    graph = Graph(graph.to_dict()) if graph else Graph()

    # Load LinkedIn data
    linkedin_files = glob.glob(f"{linkedin_dir}/*.csv")
    datasets = [] # { "linkedin_user_full_name": str, "df": pd.DataFrame }[]
    expected_columns = ["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"]
    for file in linkedin_files:
        linkedin_user_full_name = os.path.splitext(os.path.basename(file))[0]
        df = pd.read_csv(file, skiprows=3)
        assert list(df.columns) == expected_columns, \
              f"Expected columns: {expected_columns}, but got {list(df.columns)}"
        df = df.dropna(subset=["First Name", "Last Name"])
        df["contact_id"] = (df["First Name"] + " " + df["Last Name"]).apply(name_to_id)
        df = df.drop_duplicates(subset=['contact_id'], keep='first')
        datasets.append({
            "linkedin_user_full_name": linkedin_user_full_name,
            "df": df
        })


    # Create type nodes
    person_type_node, _ = graph.upsert_related_node(global_root_node_id, "Person", node_id=person_type_node_id)
    company_type_node, _ = graph.upsert_related_node(global_root_node_id, "Company", node_id=company_type_node_id)
    linkedin_users_node, _ = graph.upsert_related_node(global_root_node_id, "LinkedIn Users", node_id=linkedin_users_node_id)

    # Create all the people nodes and connections
    for dataset in datasets:
        # Create person node for linkedin user
        linkedin_user_node = graph.upsert_node(dataset["linkedin_user_full_name"])
        graph.upsert_relation(linkedin_user_node["id"], person_type_node["id"], "type")
        graph.upsert_relation(linkedin_users_node["id"], linkedin_user_node["id"])
        
        for _, row in dataset["df"].iterrows():
            # Get or create person node for contact
            full_name = clean_first_name(row['First Name'].strip()) + " " + clean_last_name(row['Last Name'].strip())
            contact_node = graph.upsert_node(full_name, id=row["contact_id"])
            graph.upsert_relation(contact_node["id"], person_type_node["id"], "type")

            # Create knows relation between linkedin user and contact
            connection_id = "-knows-".join(sorted([linkedin_user_node["id"], contact_node["id"]]))
            graph.upsert_relation(linkedin_user_node["id"], contact_node["id"], "knows", id=connection_id)

    # Add info about people
    people_info_df = pd.concat([dataset["df"] for dataset in datasets], ignore_index=True)
    people_info_df = people_info_df.drop_duplicates(subset=['contact_id'], keep='first')
    for _, row in people_info_df.iterrows():
        if row["contact_id"] not in graph._graph["nodesById"]:
            continue
        [company, position, contact_id, url, email] = [str(v) if pd.notna(v) else "" for v in row[["Company", "Position", "contact_id", "URL", "Email Address"]].values]

        # Company and position
        if company:
            company_id = name_to_id(company)

            # For some reason people sometimes put their own name in the company field. Ignore those.
            if company_id == contact_id:
                continue

            company_node = graph.upsert_node(company, id=company_id)
            graph.upsert_relation(company_node["id"], company_type_node["id"], "type")

            if not position:
                label_company_to_person = str(row["Position"]) # e.g. "CEO:"
                label_person_to_company = f"is {label_company_to_person} of" # e.g. "is CEO of:"
                position_relation_type_id = name_to_id(label_company_to_person)
                graph.upsert_relation_type(label_person_to_company, label_company_to_person, id=position_relation_type_id)
            else:
                position_relation_type_id = "works-at"

            graph.upsert_relation(contact_id, company_node["id"], position_relation_type_id)

        # URL
        if url:
            graph.upsert_property(contact_id, url, key_id="linkedin-url")

        # Email
        if email:
            graph.upsert_property(contact_id, email, key_id="email")

    return graph

def add_laurel_touby(graph: Graph):
    text = open(laurel_touby_path, "r").read()
    graph = add_text_graph(text, graph=graph)
    graph.upsert_relation(global_root_node_id, laurel_touby_id, "type")
    return graph

def filter_for_top_people(graph: Graph) -> Graph:
    filtered_graph = Graph()
    people_ids = set([n["id"] for n in graph.get_people_nodes()])

    # Add all users whose linkedin export is in the graph
    included_people_ids = set()
    linkedin_users_node = graph.get_node(linkedin_users_node_id)
    if linkedin_users_node:
        filtered_graph.add_node(linkedin_users_node)
        for adjacent_relation, adjacent_node in graph.walk_adjacent(linkedin_users_node["id"], 1):
            filtered_graph.add_node(adjacent_node)
            filtered_graph.add_relation(adjacent_relation)
            if adjacent_node["id"] in people_ids:
                included_people_ids.add(adjacent_node["id"])
    # Add Laurel Touby
    included_people_ids.add(laurel_touby_id)

    # Select 50 other people with most relations 
    for people_id in sorted(people_ids, key=lambda id: len(graph._relations_by_from_id[id]) + len(graph._relations_by_to_id[id]), reverse=True)[:50]:
        included_people_ids.add(people_id)

    # Add top people
    person_node = graph.get_node(person_type_node_id)
    # Walk nodes adjacent to Person node, adding the top people and their ancestors
    if person_node:
        filtered_graph.add_node(person_node)
        for adjacent_relation, adjacent_node in graph.walk_adjacent(person_node["id"], 1):
            if adjacent_node["id"] == global_root_node_id:
                filtered_graph.add_relation(adjacent_relation)
                continue
            # Add person node
            if adjacent_node["id"] not in included_people_ids: continue
            filtered_graph.add_node(adjacent_node)
            filtered_graph.add_relation(adjacent_relation)
            # Add all directly connected nodes, ignoring people who aren't the top people
            for relation_to_person, adjacent_node in graph.walk_descendants(adjacent_node["id"], 1):
                if adjacent_node["id"] in people_ids and adjacent_node["id"] not in included_people_ids:
                    continue
                filtered_graph.add_node(adjacent_node)
                filtered_graph.add_relation(relation_to_person)

    # Add relations associated with the companies connected to the top people
    companies_node = graph.get_node(company_type_node_id)
    if companies_node:
        filtered_graph.add_node(companies_node)
        for relation_to_person, company_node in graph.walk_ancestors(companies_node["id"], 1):
            # Add relation connected to companies node
            if company_node["id"] not in filtered_graph._graph["nodesById"]: continue
            filtered_graph.add_relation(relation_to_person)
            # Add all directly connected nodes, ignoring people who aren't the top people
            for relation_to_person, adjacent_node in graph.walk_descendants(company_node["id"], 1):
                if adjacent_node["id"] in people_ids and adjacent_node["id"] not in included_people_ids:
                    continue
                filtered_graph.add_node(adjacent_node)
                filtered_graph.add_relation(relation_to_person)

    # Add all relation types
    for relation_type in graph._graph["relationTypesById"].values():
        filtered_graph.add_relation_type(relation_type)

    return filtered_graph

if __name__ == "__main__":
    graph = Graph()
    graph = add_linkedin(graph)
    graph = add_laurel_touby(graph)

    # Full version
    graph_full = Graph(graph.to_dict())
    with open(os.path.join(output_dir, f"lidemo.json"), "w") as f:
        json.dump(graph_full.to_dict(), f, indent=2)

    # Lite version
    graph_lite = filter_for_top_people(graph)
    with open(os.path.join(output_dir, f"lidemo-lite.json"), "w") as f:
        json.dump(graph_lite.to_dict(), f, indent=2)


