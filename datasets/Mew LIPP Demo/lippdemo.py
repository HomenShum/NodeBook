import json
import os
import re
from typing import Union

import pandas as pd
from lidemo import get_people_node_ids, graphify_linkedin, linkedin_dir
from utils import (Graph, GraphDict, add_text_graph, filter_graph,
                   global_root_node_id)

vcs_list_id = "vcs_list_node_id"

crunchbase_dir = os.path.join('input-data', 'crunchbase')

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

def assert_graph_integrity(graph: GraphDict):
    issues = []
    for node in graph["nodesById"].values():
        if not node["id"]:
            issues.append(f"Node with no ID: {node}")

    for relation in graph["relationsById"].values():
        if not relation["fromId"] or not relation["toId"]:
            issues.append(f"Relation with no fromId or toId: {relation}")
        if not relation["relationTypeId"]:
            issues.append(f"Relation with no relation type: {relation}")
        elif relation["relationTypeId"] != "child" and not graph["relationTypesById"].get(relation["relationTypeId"]):
            issues.append(f"Relation with no relation type in relationTypesById: {relation}")

    for relation_type in graph["relationTypesById"].values():
        if not relation_type["id"]:
            issues.append(f"Relation type with no ID: {relation_type}")
    
    if issues:
        raise Exception("\n".join(issues))
    

def create_crunchbase_graph(graph=None):
    graph = graph or Graph()

    # Get founders 

    people_df = pd.read_csv(os.path.join(crunchbase_dir, 'people.csv'), usecols=[
        'first_name', 'last_name', 'linkedin_url', 'uuid'
    ]).dropna(subset=["first_name", "last_name", "uuid"])
    people_df["full_name"] = people_df['first_name'] + " " + people_df['last_name']

    jobs = pd.read_csv(os.path.join(crunchbase_dir, 'jobs.csv'), usecols=[
        'org_uuid', 'title', 'person_uuid'
    ]).dropna()
    founder_pattern = r'\bfounder\b'
    founder_jobs = jobs[jobs.title.str.contains(founder_pattern, case=False, regex=True)]

    founders = people_df.merge(founder_jobs, left_on="uuid", right_on="person_uuid", how="inner")

    # Get funding rounds by top VCs

    funding_rounds_df = pd.read_csv(os.path.join(crunchbase_dir, 'funding_rounds.csv'), usecols=[
        'company_name', 'country_code', 'state_code', 'investment_type',
        'announced_on', 'raised_amount_usd', 'investor_names', 'company_uuid'
    ]).dropna(subset=["company_uuid", "company_name"])
    funding_rounds_df["investor_set"] = funding_rounds_df["investor_names"]\
        .str.slice(1, -1)\
        .str.replace(r'\(\w+\)', '', regex=True)\
        .str.replace('"', '')\
        .str.split(",").apply(lambda alist: set([v.strip() for v in alist if v.strip()]))
    top_vc_funding_rounds = funding_rounds_df[funding_rounds_df["investor_set"].apply(lambda s: not s.isdisjoint(top_vcs))]

    # Get company 

    org_df = pd.read_csv(os.path.join(crunchbase_dir, 'organizations.csv'), usecols=[
        'uuid', 'short_description', 'homepage_url', 'category_list', 'category_group_list'
    ])\
        .dropna(subset=["uuid"]).fillna("").astype(str)

    # Create joint table

    df = founders\
      .merge(top_vc_funding_rounds, left_on="org_uuid", right_on="company_uuid", suffixes=("", "_from_funding_rounds"), how="inner")\
      .merge(org_df, left_on="org_uuid", right_on="uuid", suffixes=("", "_from_org"), how="inner")\
      .dropna(subset=["company_name"])\
      .fillna("")

    # Load into graph

    list_of_top_vcs_node = graph.upsert_node("List of Top VCs", id=vcs_list_id)

    for _, row in df.iterrows(): 
        # Add founder
        [uuid, full_name, linkedin_url, company_name, investors] = row[['uuid', 'full_name', 'linkedin_url', 'company_name', 'investor_set']] 
        if not full_name: continue
        founder_node = graph.upsert_node(full_name, id=uuid)
        if linkedin_url:
            graph.upsert_property(parent_id=founder_node['id'], key_id="linkedin-url", value=linkedin_url)

        # Add company and metadata
        org_node = graph.upsert_node(company_name, id=row['org_uuid'])
        props = [ ("country_code", "Country"), ("state_code", "State"), ("short_description", "Description"), ("homepage_url", "Link") ]
        for key_id, key_label in props:
            value = row[key_id]
            if value:
                graph.upsert_property(parent_id=org_node["id"], value=str(value), key_label=key_label, key_id=key_id)
        categories = row['category_list'] or ''
        for category in categories.split(','):
            graph.upsert_related_node(org_node["id"], category, "Tag")

        # Relate founder to company 
        founder_type = graph.upsert_relation_type("Founder")
        graph.upsert_relation(org_node["id"], founder_node["id"], founder_type["id"])

        # Add investors
        for investor in investors:
            if investor not in top_vcs: continue
            investor_node = graph.upsert_related_node(org_node["id"], investor, "Investor")[0]
            # Add to list
            graph.upsert_relation(list_of_top_vcs_node["id"], investor_node["id"])

    return graph


def create_good_signal(good_signal_dir: str, linkedin_graph: Union[None, Graph] = None) -> Graph:
    graph = Graph(linkedin_graph._graph) if linkedin_graph else Graph()
    
    # Add all good signal text files to the graph

    for _, file in enumerate(os.listdir(good_signal_dir)):
        if not file.endswith(".txt"):
            continue
        print(f"Adding {file}")
        text = open(os.path.join(good_signal_dir, file), "r").read()
        add_text_graph(text, global_root_node_id, graph=graph)
        assert_graph_integrity(graph._graph)

    # Add crunchbase data to the graph 
    graph = create_crunchbase_graph(graph)

    # Put list of vcs as child of global root
    graph.upsert_relation(global_root_node_id, vcs_list_id)

    return graph


def filter_for_top_people_and_vcs(graph: Graph):
    filtered_graph = Graph()
    filtered_graph._graph["relationTypesById"] = graph.to_dict()["relationTypesById"]

    # Add all people nodes and their ancestors

    linkedin_people_ids = get_people_node_ids(graph._graph)
    for node_id in linkedin_people_ids:
        filtered_graph.add_node(graph.get_node(node_id))
        for relation, parent in graph.walk_ancestors(node_id):
            filtered_graph.add_node(parent)
            filtered_graph.add_relation(relation)

    # Add nodes and relations adjacent to people nodes

    for node_id in linkedin_people_ids:
        for relation, related_node in graph.walk_adjacent(node_id, 1):
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(related_node)

    # Add "List of Top VCs" node and relation to global root

    filtered_graph.add_node(graph.get_node(vcs_list_id))
    for relation_id in graph._relations_by_to_id.get(vcs_list_id, []):
        filtered_graph.add_relation(graph.get_relation(relation_id))

    # Add adjacencies to vcs

    for relation, node in graph.walk_adjacent(vcs_list_id, 4):
        filtered_graph.add_relation(relation)
        filtered_graph.add_node(node)

    return filtered_graph

if __name__ == "__main__":
    good_signal_dir = os.path.join("input-data", "good-signal")

    # Full version

    print("Graphifying LinkedIn")
    graph = Graph(graphify_linkedin(linkedin_dir))

    # Need this in the graph or else walking later doesn't work
    graph.upsert_node("Global root", id=global_root_node_id)

    print("Creating good signal")
    graph = create_good_signal(good_signal_dir, graph)
    print("Filtering good signal")
    graph = filter_for_top_people_and_vcs(graph)
    assert_graph_integrity(graph._graph)
    with open(os.path.join("output-data", f"lippdemo.json"), "w") as f:
        json.dump(graph.to_dict(), f)

    # Lite version

    graph_lite_dict = filter_graph(graph.to_dict(), global_root_node_id, threshold_depth=1, max_children=20, max_depth=6)
    with open(os.path.join("output-data", f"lippdemo-lite.json"), "w") as f:
        json.dump(graph_lite_dict, f)
    
    
