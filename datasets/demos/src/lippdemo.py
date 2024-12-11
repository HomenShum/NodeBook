import json
import os
from typing import Union

import pandas as pd
from lidemo import *
from utils import *


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
    

def add_crunchbase_data(graph=None):
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
        graph.upsert_type_to_node(founder_node["id"], person_type_node_id)
        if linkedin_url:
            graph.upsert_property(parent_id=founder_node['id'], key_id="linkedin-url", value=linkedin_url)

        # Add company and metadata
        org_node = graph.upsert_node(company_name, id=row['org_uuid'])
        graph.upsert_type_to_node(org_node["id"], company_type_node_id)

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
            graph.upsert_type_to_node(investor_node["id"], investor_type_node_id)
            graph.upsert_type_to_node(investor_node["id"], company_type_node_id)
            # Add to list
            graph.upsert_relation(list_of_top_vcs_node["id"], investor_node["id"])

    return graph


def add_good_signal(linkedin_graph: Union[None, Graph] = None) -> Graph:
    graph = Graph(linkedin_graph._graph) if linkedin_graph else Graph()
    
    # Add all good signal text files to the graph
    for _, file in enumerate(os.listdir(good_signal_dir)):
        if not file.endswith(".txt"):
            continue
        text = open(os.path.join(good_signal_dir, file), "r").read()
        add_text_graph(text, global_root_node_id, graph=graph)
        assert_graph_integrity(graph._graph)

    # Add crunchbase data to the graph 
    graph = add_crunchbase_data(graph)

    # Put list of vcs as child of global root
    graph.upsert_relation(global_root_node_id, vcs_list_id)

    return graph


def add_josh_langam(graph: Graph):
    with open(josh_langsam_path, "r") as f:
        josh_langsam_dict = json.load(f)

    for relation in josh_langsam_dict["relationsById"].values():
        # Get or create relation type
        relation_type = josh_langsam_dict["relationTypesById"].get(relation["relationTypeId"])
        relation_type = graph.get_or_create_relation_type(relation_type["label"], relation_type["reverseLabel"])
        graph.add_relation_type(relation_type)

        # Get or create nodes
        serialized_from_node = josh_langsam_dict["nodesById"].get(relation["fromId"])
        serialized_to_node = josh_langsam_dict["nodesById"].get(relation["toId"])
        if not serialized_from_node or not serialized_to_node:
            continue
        from_node = graph.get_or_create_node(serialized_from_node["content"][0]["value"])
        graph.add_node(from_node)
        to_node = graph.get_or_create_node(serialized_to_node["content"][0]["value"])
        graph.add_node(to_node)

        # Add relation
        graph.upsert_relation(from_node["id"], to_node["id"], relation_type["id"])

        # Add person type to Josh Langam
        if node_to_text(from_node) == "Joshua Langam":
            persons_node = graph.get_node(person_type_node_id)
            if persons_node:
                graph.upsert_relation(persons_node["id"], from_node["id"], "type")
        if node_to_text(to_node) == "Joshua Langam":
            persons_node = graph.get_node(person_type_node_id)
            if persons_node:
                graph.upsert_relation(from_node["id"], persons_node["id"], "type")

    return graph


def filter_by_people(graph: Graph, people_node_ids: set[str]):
    filtered_graph = Graph()

    all_people_node_ids = set(node["id"] for node in graph.get_people_nodes())
    def is_person_outside_list(node_id: str):
        return node_id in all_people_node_ids and node_id not in people_node_ids

    # Add relation types
    for relation_type in graph._graph["relationTypesById"].values():
        filtered_graph.add_relation_type(relation_type)

    # Add type nodes and relations to graph root
    for node in graph.get_type_nodes():
        filtered_graph.add_node(node)
        for relation in graph.get_relations_with_to_id(node["id"]):
            if relation["fromId"] == global_root_node_id:
                filtered_graph.add_relation(relation)

    # Add people nodes
    people_nodes = []
    for node_id in people_node_ids:
        node = graph.get_node(node_id)
        if not node: continue
        people_nodes.append(node)
        filtered_graph.add_node(node)

    # Add people nodes ancestors
    visited = set(people_node_ids)
    stack = [(node["id"], 10) for node in people_nodes]
    while stack:
        current_id, steps_left = stack.pop()
        if steps_left <= 0: continue
        visited.add(current_id)
        for relation in graph.get_relations_with_to_id(current_id):
            parent = graph.get_node(relation["fromId"])
            if not parent: continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(parent)
            if parent["id"] == global_root_node_id: continue
            if parent["id"] in visited: continue
            if is_person_outside_list(parent["id"]): continue
            stack.append((parent["id"], steps_left - 1))

    # Add nodes and relations adjacent to people nodes
    for node in people_nodes:
        for relation, related_node in graph.walk_adjacent(node["id"], 1):
            if is_person_outside_list(related_node["id"]): continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(related_node)

    # Add company nodes list associated with something in filtered graph 
    companies_node = graph.get_node(company_type_node_id)   
    all_company_node_ids = set()
    company_node_ids = set()
    
    if companies_node:
        for relation, company_node in graph.walk_adjacent(companies_node["id"], 1):
            all_company_node_ids.add(company_node["id"])
            if company_node["id"] in filtered_graph._graph["nodesById"]:
                company_node_ids.add(company_node["id"])
                filtered_graph.add_relation(relation)
    
    # Add relations associated with company nodes
    def is_company_outside_list(node_id: str):
        return node_id in all_company_node_ids and node_id not in company_node_ids
    for company_node_id in company_node_ids:
        for relation, person_node in graph.walk_adjacent(company_node_id, 1):
            if is_person_outside_list(person_node["id"]): continue
            if is_company_outside_list(company_node_id): continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(person_node)

    # Add "List of Top VCs" node and relation to global root
    vcs_list_node = graph.get_node(vcs_list_id)
    if vcs_list_node:
        filtered_graph.add_node(vcs_list_node)
        for relation, vc_node in graph.walk_adjacent(vcs_list_node["id"], 1):
            if vc_node["id"] in filtered_graph._graph["nodesById"]:
                filtered_graph.add_relation(relation)
                # Add adjacency to vcs list
                for relation, node in graph.walk_adjacent(vc_node["id"], 1):
                    if is_person_outside_list(node["id"]): continue
                    if is_company_outside_list(node["id"]): continue
                    filtered_graph.add_relation(relation)
                    filtered_graph.add_node(node)

    return filtered_graph


if __name__ == "__main__":
    graph = Graph()
    graph = add_linkedin(graph)
    graph = add_josh_langam(graph)
    graph = add_good_signal(graph)
    people_by_relation_count = sorted(
        graph.get_people_nodes(),
        key=lambda node: len(graph.get_relations_with_from_id(node["id"])) + len(graph.get_relations_with_to_id(node["id"])),
        reverse=True
    )

    # Create full version
    graph_full = filter_by_people(graph, set([node["id"] for node in people_by_relation_count[:1000]]))
    assign_canonical_relation(graph_full)
    assert_graph_integrity(graph_full._graph)
    full_path = os.path.join(output_dir, f"lippdemo.json")
    with open(full_path, "w") as f:
        json.dump(graph_full.to_dict(), f)
    
    # Create lite version
    graph_lite = filter_by_people(graph, set(node["id"] for node in people_by_relation_count[:30]))
    assign_canonical_relation(graph_lite)
    assert_graph_integrity(graph_lite._graph)
    lite_path = os.path.join(output_dir, f"lippdemo-lite.json")
    with open(lite_path, "w") as f:
        json.dump(graph_lite.to_dict(), f)

    print(f"Saved full version to {full_path}")
    print(f"Saved lite version to {lite_path}")
    
