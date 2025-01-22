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

def add_linkedin(graph: Union[Graph, None] = None):
    # Initialize graph
    graph = graph if graph else Graph()

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
    linkedin_users_node = graph.upsert_node("LinkedIn Users", id=linkedin_users_node_id)
    graph.upsert_relation(global_root_node_id, linkedin_users_node.id)
    make_ideapad_none(graph, linkedin_users_node)

    # Create all the people nodes and connections
    for dataset in datasets:
        # Create person node for linkedin user
        linkedin_user_node = graph.upsert_node(dataset["linkedin_user_full_name"])
        graph.upsert_relation(linkedin_users_node.id, linkedin_user_node.id)
        make_person(graph, linkedin_user_node.id)
        
        for _, row in dataset["df"].iterrows():
            # Get or create person node for contact
            full_name = clean_first_name(row['First Name'].strip()) + " " + clean_last_name(row['Last Name'].strip())
            contact_id = row["contact_id"]
            contact_node = graph.upsert_node(full_name, id=contact_id)
            make_person(graph, contact_id)

            # Create knows relation between linkedin user and contact
            connection_id = "-knows-".join(sorted([linkedin_user_node.id, contact_node.id]))
            graph.upsert_relation(linkedin_user_node.id, contact_node.id, "knows", id=connection_id)

    # Add info about people
    people_info_df = pd.concat([dataset["df"] for dataset in datasets], ignore_index=True)
    people_info_df = people_info_df.drop_duplicates(subset=['contact_id'], keep='first')
    for _, row in people_info_df.iterrows():
        if row["contact_id"] not in graph.nodes:
            continue
        [company, position, contact_id, url, email] = [str(v) if pd.notna(v) else "" for v in row[["Company", "Position", "contact_id", "URL", "Email Address"]].values]

        # Company and position
        if company:
            company_id = name_to_id(company)

            # For some reason people sometimes put their own name in the company field. Ignore those.
            if company_id == contact_id:
                continue

            # Create company node
            company_node = graph.upsert_node(company, id=company_id)
            make_company(graph, company_node.id)

            # Create works at relation
            label_company_to_person = position.strip() if position else default_relation_types.works_at.reverse_label
            graph.upsert_relation(company_id, contact_id, label_company_to_person)

        # URL
        if url:
            _, relation = graph.upsert_property(contact_id, url, default_relation_types.linkedin_url.label)
            make_ideapad_attribute(graph, relation)

        # Email
        if email:
            _, relation = graph.upsert_property(contact_id, email, default_relation_types.email.label)
            make_ideapad_attribute(graph, relation)

    return graph

def add_laurel_touby(graph: Graph):
    text = open(laurel_touby_path, "r").read()
    def callback(content, parent_stack, relation_type_label):
        if len(parent_stack) == 0:
            node, _ = graph.upsert_related_node(global_root_node_id, content, relation_type_label)
            return node
        node, _ = graph.upsert_related_node(parent_stack[-1].id, content, relation_type_label)
        return node
    parse_text_graph(text, callback) 
    make_person(graph, laurel_touby_id)
    return graph

def filter_for_top_people(graph:Graph, top_n:int=50):
    filtered_graph = graph.copy()
    people_ids = set([n.id for n in graph.get_people_nodes()])
    included_people_ids = set()
    for people_id in sorted(people_ids, key=lambda id: len(graph._relations_by_from_id[id]) + len(graph._relations_by_to_id[id]), reverse=True)[:top_n]:
        included_people_ids.add(people_id)

    # Remove people not in top N
    for people_id in people_ids:
        if people_id not in included_people_ids:
            filtered_graph.remove_node(people_id)

    # Remove companies not connected to top N people
    company_node_ids = set([n.id for n in graph.get_companies_nodes()])
    for company_node_id in company_node_ids:
        is_connected_to_top_people = False
        for _, adjacent_node, _ in graph.walk_adjacent(company_node_id, 1):
            if adjacent_node.id in included_people_ids:
                is_connected_to_top_people = True
                break
        if not is_connected_to_top_people:
            filtered_graph.remove_node(company_node_id)

    # Remove all nodes that are not connected to top people or companies
    for node_id in graph.nodes.keys():
        relations = graph.get_relations_with_from_id(node_id)
        relations.extend(graph.get_relations_with_to_id(node_id))
        has_connection = False
        for relation in relations:
            if relation.from_id in included_people_ids or relation.to_id in included_people_ids or \
               relation.from_id in company_node_ids or relation.to_id in company_node_ids:
                has_connection = True
                break
        if not has_connection:
            filtered_graph.remove_node(node_id)

    # Remove hanging relations
    relations_to_remove = []
    for relation_id in filtered_graph.relations.keys():
        relation = filtered_graph.get_relation(relation_id)
        if not relation: continue
        if not filtered_graph.has(relation.from_id) or not filtered_graph.has(relation.to_id):
            relations_to_remove.append(relation_id)
    for relation_id in relations_to_remove:
        filtered_graph.remove_relation(relation_id)

    # Remove nodes without connections
    nodes_to_remove = []
    for node_id in filtered_graph.nodes.keys():
        relations = filtered_graph.get_relations_with_from_id(node_id)
        relations.extend(filtered_graph.get_relations_with_to_id(node_id))
        if not relations:
            nodes_to_remove.append(node_id)
    for node_id in nodes_to_remove:
        filtered_graph.remove_node(node_id)
    
    return filtered_graph

if __name__ == "__main__":
    print("Creating lidemo graph...")
    graph = Graph()
    graph = add_linkedin(graph)
    # graph = add_laurel_touby(graph)

    # Large version
    graph_large = filter_for_top_people(graph, top_n=3000)
    with open(os.path.join(output_dir, f"lidemo.json"), "w") as f:
        json.dump(graph_large.to_dict(), f, indent=2)

    # Lite version
    graph_lite = filter_for_top_people(graph, top_n=300)
    with open(os.path.join(output_dir, f"lidemo-lite.json"), "w") as f:
        json.dump(graph_lite.to_dict(), f, indent=2)


