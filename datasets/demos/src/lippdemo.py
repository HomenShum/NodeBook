import json
import os
from typing import Union

import pandas as pd
from lidemo import *
from utils import *


# def assert_graph_integrity(graph: GraphDict):
#     issues = []
#     for node in graph["nodesById"].values():
#         if not node["id"]:
#             issues.append(f"Node with no ID: {node}")

#     for relation in graph["relationsById"].values():
#         if not relation["fromId"] or not relation["toId"]:
#             issues.append(f"Relation with no fromId or toId: {relation}")
#         if not relation["relationTypeId"]:
#             issues.append(f"Relation with no relation type: {relation}")
#         elif relation["relationTypeId"] != "child" and not graph["relationTypesById"].get(relation["relationTypeId"]):
#             issues.append(f"Relation with no relation type in relationTypesById: {relation}")

#     for relation_type in graph["relationTypesById"].values():
#         if not relation_type["id"]:
#             issues.append(f"Relation type with no ID: {relation_type}")
    
#     if issues:
#         raise Exception("\n".join(issues))
    
def normalize_name(content):
    content = re.sub(r"\s*\(.*\)", "", content).strip()
    parts = re.split(r"[\s,]+", content)
    if "," in content:
        if len(parts) == 2:
            parts = [parts[1], parts[0]]
        elif len(parts) == 3 and parts[-1].endswith("."):
            parts = [parts[1], parts[0]]
    name = " ".join([c[0].upper() + c[1:].lower() for c in parts if len(c) > 1])
    return name

def upsert_person(graph: Graph, parent_id: str, content: str, relation_type_label: str) -> GraphNode:
    node = graph.upsert_node(normalize_name(content))
    graph.upsert_relation(parent_id, node.id, relation_type_label)
    make_person(graph, node.id)
    return node

def upsert_extreme_talent_person(graph: Graph, parent_id: str, content: str, relation_type_label: str, node_id: Union[str, None] = None, normalize: bool = True) -> GraphNode:
    name = normalize_name(content) if normalize else content
    node = graph.upsert_node(name, id=node_id)
    graph.upsert_relation(parent_id, node.id, relation_type_label)
    make_extreme_talent_person(graph, node.id)
    return node

def upsert_company(graph: Graph, parent_id: str, content: str, relation_type_label: str) -> GraphNode:
    node = graph.upsert_node(content)
    graph.upsert_relation(parent_id, node.id, relation_type_label)
    make_company(graph, node.id)
    return node

def upsert_person_property(graph: Graph, parent_id: str, content: str, relation_type_label: str) -> GraphNode:
    if relation_type_label:
        node, relation = graph.upsert_property(parent_id, content, relation_type_label)
        make_ideapad_attribute(graph, relation)
        return node
    else:
        node, _ = graph.upsert_related_node(parent_id, content, relation_type_label, upsert_node=False)
        make_ideapad_none(graph, node)
        return node

def upsert_related_node(graph: Graph, parent_id: str, content: str, relation_type_label: str) -> GraphNode:
    node, _ = graph.upsert_related_node(parent_id, content, relation_type_label, upsert_node=False)
    # make_ideapad_none(graph, node)
    return node

# ---

def add_crunchbase_data(graph: Union[None, Graph] = None) -> Graph:
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
    # Get category groups sorted by frequency
    category_groups = org_df["category_group_list"]\
        .str.slice(1, -1)\
        .str.split(",").explode()\
        .str.strip()\
        .value_counts()\
        .to_dict()

    # Create joint table

    df = founders\
      .merge(top_vc_funding_rounds, left_on="org_uuid", right_on="company_uuid", suffixes=("", "_from_funding_rounds"), how="inner")\
      .merge(org_df, left_on="org_uuid", right_on="uuid", suffixes=("", "_from_org"), how="inner")\
      .dropna(subset=["company_name"])\
      .fillna("")

    # Load into graph

    list_of_top_vcs_node = graph.upsert_node("List of Top VCs", id=vcs_list_id)
    graph.upsert_relation(global_root_node_id, vcs_list_id)

    for _, row in df.iterrows(): 
        # Add founder
        [uuid, full_name, linkedin_url, company_name, investors] = row[['uuid', 'full_name', 'linkedin_url', 'company_name', 'investor_set']] 
        if not full_name: continue
        founder_node = graph.upsert_node(full_name, id=uuid)
        make_person(graph, founder_node.id)
        if linkedin_url:
            _, relation = graph.upsert_property(founder_node.id, linkedin_url, default_relation_types.linkedin_url.label)
            make_ideapad_attribute(graph, relation)

        # Add company and metadata
        org_node = graph.upsert_node(company_name, id=row['org_uuid'])
        make_company(graph, org_node.id)
        value = row["country_code"]
        # Add global property values
        if value:
            node = graph.upsert_node(str(value))
            relation = graph.upsert_relation(org_node.id, node.id, "Country")
            make_ideapad_attribute(graph, relation)
        value = row["state_code"] 
        if value:
            node = graph.upsert_node(str(value))
            relation = graph.upsert_relation(org_node.id, node.id, "State")
            make_ideapad_attribute(graph, relation)
        # Add local property values
        value = row["short_description"]
        if value:
            _, relation = graph.upsert_property(org_node.id, str(value), "Description")
            make_ideapad_attribute(graph, relation)
        value = row["homepage_url"]
        if value:
            _, relation = graph.upsert_property(org_node.id, str(value), "Link")
            make_ideapad_attribute(graph, relation)

        categories = row['category_list'] or ''
        for category in categories.split(','):
            if org_node.content == category:
                print(f"Skipping upserting category with same text as org node: {category}")
                continue
            node, _ = graph.upsert_related_node(org_node.id, category, "Tag")
            make_ideapad_none(graph, node)

        category_group = str(row['category_group_list'] or '')
        if len(category_group) > 0:
            _, relation = graph.upsert_property(org_node.id, category_group, default_relation_types.industry.label)
            make_ideapad_attribute(graph, relation)

        # Relate founder to company 
        graph.upsert_relation(org_node.id, founder_node.id, default_relation_types.founder.label)

        # Add investors
        for investor in investors:
            if investor not in top_vcs: continue
            investor_node = graph.upsert_related_node(org_node.id, investor, default_relation_types.investor.label)[0]
            make_investor(graph, investor_node.id)
            # Add to list
            graph.upsert_relation(vcs_list_id, investor_node.id)

    return graph


def add_yc_companies(graph: Union[None, Graph] = None) -> Graph:
    graph = graph or Graph()

    text = open(yc_companies_path, "r").read()

    def process_yc_companies(content, parent_stack, relation_type_label):
        label_lower = relation_type_label.lower()
        if len(parent_stack) == 0:
            return upsert_related_node(graph, global_root_node_id, content, relation_type_label)
        elif len(parent_stack) == 1:
            return upsert_company(graph, parent_stack[-1].id, content, relation_type_label)
        elif "founder" in label_lower:
            return upsert_person(graph, parent_stack[-1].id, content, relation_type_label)
        else:
            return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)

    parse_text_graph(text, process_yc_companies)

    return graph


def add_extreme_talent(graph: Union[None, Graph] = None) -> Graph:
    graph = graph or Graph()

    # Create extreme talent lists node
    extreme_talent_lists_node = graph.upsert_node("Extreme Talent Lists", id=extreme_talent_lists_node_id)
    graph.upsert_relation(global_root_node_id, extreme_talent_lists_node.id)

    # Add all good signal text files to the graph
    for name, file_path in extreme_talent_lists_paths.items():
        if not os.path.exists(file_path):
            print(f"WARNING: Good signal file not found: {file_path}")
            continue
        text = open(file_path, "r").read()
        print(f"Adding {file_path} to graph")

        if name == "intelligentcrazypeople":
            def add_intelligent_crazy_people(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                if len(parent_stack) == 0:
                    return upsert_related_node(graph, extreme_talent_lists_node.id, content, relation_type_label)
                elif len(parent_stack) == 1:
                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                elif len(parent_stack) == 2:
                    return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                else:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
            parse_text_graph(text, add_intelligent_crazy_people)

        elif name == "International Olympiad Winners":
            def add_international_olympiad_winners(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                label_lower = relation_type_label.lower()
                if len(parent_stack) == 0:
                    return upsert_related_node(graph, extreme_talent_lists_node.id, content, relation_type_label)
                elif "gold" in label_lower or "silver" in label_lower or "bronze" in label_lower:
                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                elif graph.is_person(parent_stack[-1].id):
                    return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                else:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
            parse_text_graph(text, add_international_olympiad_winners)

        elif name == "MLH Top Hackers":
            def add_mlh_top_hackers(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                if len(parent_stack) == 0:
                    return upsert_related_node(graph, extreme_talent_lists_node.id, content, relation_type_label)
                elif len(parent_stack) == 1:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif len(parent_stack) == 2:
                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                else:
                    return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
            parse_text_graph(text, add_mlh_top_hackers)
            # Remove "Can't Live Without" relations
            for relation in graph.get_relations():
                if relation.relation_type_label == "Can't Live Without":
                    graph.remove_relation(relation.id)

        elif name == "Scholarships and Fellowships List":
            def add_scholarships_and_fellowships_list(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                if len(parent_stack) == 0:
                    return upsert_related_node(graph, extreme_talent_lists_node.id, content, relation_type_label)
                elif len(parent_stack) == 1:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)

                sublist_name = node_to_text(parent_stack[1])
                if sublist_name == "Thiel Fellows":
                    if len(parent_stack) == 2:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Schwarzman Scholars" or sublist_name == "Rhodes Scholars":
                    if len(parent_stack) == 2 and not relation_type_label:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 3:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Marshall Scholars":
                    if len(parent_stack) == 3:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif graph.is_person(parent_stack[-1].id):
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "MacArthur Fellows":
                    if len(parent_stack) == 2:
                        if content == "description" or len(relation_type_label) > 0:
                            return None
                        else:
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 3:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Kleiner Perkins Fellows" or sublist_name == "Fulbright Scholars":
                    if len(parent_stack) == 2:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 3:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Goldwater Scholars":
                    if len(parent_stack) == 4:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 5:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Foresight Institute Fellows":
                    if len(parent_stack) < 3:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 3:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Davidson Fellowship":
                    if len(parent_stack) >= 3:
                        sublist2_name = node_to_text(parent_stack[2])
                        year = sublist2_name.split(" ")[0]
                        person_depth = 4 if year == "2023" or year == "2022" or year == "2021" else 3
                        if len(parent_stack) == person_depth:
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                        elif len(parent_stack) == person_depth + 1:
                            return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                        else:
                            return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                raise Exception("Unknown sublist name: " + sublist_name)
            parse_text_graph(text, add_scholarships_and_fellowships_list)
        
        elif name == "Misc Competition Winners":
            def add_misc_competition_winners(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                if len(parent_stack) == 0:
                    return upsert_related_node(graph, extreme_talent_lists_node.id, content, relation_type_label)
                elif len(parent_stack) == 1:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)

                sublist_name = node_to_text(parent_stack[1])
                if sublist_name == "Google Science Fair Winners":
                    if len(parent_stack) == 4 and not relation_type_label:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Hackathon Winners":
                    sublist2_name = node_to_text(parent_stack[2]) if len(parent_stack) > 2 else ""
                    if sublist2_name == "CalHacks Hackathon Winners":
                        parent_node = parent_stack[-1]
                        if len(parent_stack) == 5 and relation_type_label == "Contributor":
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                        elif graph.is_person(parent_node.id):
                            return upsert_person_property(graph, parent_node.id, content, relation_type_label)
                        else:
                            return upsert_related_node(graph, parent_node.id, content, relation_type_label)
                    elif sublist2_name == "MIT Hackathon Winners":
                        sublist3_name = node_to_text(parent_stack[2])
                        if sublist3_name == "MIT $100K":
                            if relation_type_label == "Winner" or len(parent_stack) == 8:
                                return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                            else:
                                return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                        else:
                            if len(parent_stack) == 5:
                                if content == "Kevin Lin":
                                    # Special case for Kevin Lin to differentiate from the twitter founder
                                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, "Kevin Lin (phd student @ uc berkeley)", \
                                                                        relation_type_label, node_id="kevin-lin-phd", normalize=False)
                                else:
                                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)

                            elif len(parent_stack) == 6:
                                return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                            else:
                                return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        if len(parent_stack) == 5 and relation_type_label == "Contributor":
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                        elif graph.is_person(parent_stack[-1].id):
                            return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                        else:
                            return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Intel Regeneron STS Finalists":
                    if len(parent_stack) < 3:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 3:
                        if content == "Jesse Zhang":
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, "Jesse Zhang (boulder, co)",\
                                                                relation_type_label, node_id="jesse-zhang-boulder-co", normalize=False)
                        else:
                            return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "ISEF":
                    if len(parent_stack) == 5:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "NSF":
                    if len(parent_stack) > 3:
                        sublist3_name = node_to_text(parent_stack[3])
                        if sublist3_name == "Alan T Waterman Award":
                            if len(parent_stack) > 4 and node_to_text(parent_stack[4]) == "Alan T Waterman Award Recipients":
                                if len(parent_stack) == 6:
                                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                                elif len(parent_stack) == 7:
                                    return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                            return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                        elif sublist3_name == "Presidential Early Career Award for Scientists and Engineers":
                            if len(parent_stack) == 4 and not relation_type_label:
                                return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                            elif len(parent_stack) == 5:
                                return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                            else:
                                return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                        elif sublist3_name == "President's National Medal of Science":
                            if len(parent_stack) == 5 and not relation_type_label:
                                return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                            elif len(parent_stack) == 6:
                                return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                            else:
                                return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "Siemens Competition" or sublist_name == "National Speech & Debate Tournament Winners" or sublist_name == "The William Lowell Putnam Mathematical Competition Winners":
                    if len(parent_stack) == 4:
                        return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                    elif len(parent_stack) == 5:
                        return upsert_person_property(graph, parent_stack[-1].id, content, relation_type_label)
                    else:
                        return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
                elif sublist_name == "YoungArts":
                    # This list mixes people and organizations in a way that's hard
                    # to parse, so we'll just skip it
                    return None
                return None
            parse_text_graph(text, add_misc_competition_winners)
        elif name == "List of Prestigious Coding Competition Winners":
            def add_coding_competition_winners(content: str, parent_stack: List[GraphNode], relation_type_label: str):
                label_lower = (relation_type_label or "").lower()
                if "gold" in label_lower or "silver" in label_lower or "bronze" in label_lower:
                    return upsert_extreme_talent_person(graph, parent_stack[-1].id, content, relation_type_label)
                else:
                    return upsert_related_node(graph, parent_stack[-1].id, content, relation_type_label)
            parse_text_graph(text, add_coding_competition_winners)
        else:
            print(f"WARNING: Good path specified but not implemented: {name}")
            # Add everything else to extreme talent lists
            # add_text_graph(text, extreme_talent_lists_node["id"], graph=graph)
    return graph


# def add_josh_langam(graph: Graph):
#     with open(josh_langsam_path, "r") as f:
#         josh_langsam_dict = json.load(f)

#     # Get josh langsam node ids
#     josh_langsam_node_ids = set()
#     for node in josh_langsam_dict["nodesById"].values():
#         if node["content"][0]["value"] == "Joshua Langsam" or node["content"][0]["value"] == "Josh Langsam":
#             josh_langsam_node_ids.add(node["id"])

#     for relation in josh_langsam_dict["relationsById"].values():
#         # Only add relations which connect to josh langsam nodes
#         if relation["fromId"] not in josh_langsam_node_ids and relation["toId"] not in josh_langsam_node_ids:
#             continue

#         # Get or create relation type
#         relation_type = josh_langsam_dict["relationTypesById"].get(relation["relationTypeId"])
#         relation_type = graph.get_or_create_relation_type(relation_type["label"], relation_type["reverseLabel"])
#         graph.add_relation_type(relation_type)

#         # Get or create nodes
#         serialized_from_node = josh_langsam_dict["nodesById"].get(relation["fromId"])
#         serialized_to_node = josh_langsam_dict["nodesById"].get(relation["toId"])
#         if not serialized_from_node or not serialized_to_node:
#             continue
#         from_node = graph.get_or_create_node(serialized_from_node["content"][0]["value"])
#         graph.add_node(from_node)
#         to_node = graph.get_or_create_node(serialized_to_node["content"][0]["value"])
#         graph.add_node(to_node)

#         # Add relation
#         graph.upsert_relation(from_node["id"], to_node["id"], relation_type["id"])

#         # Add person type to Josh Langam
#         if node_to_text(from_node) == "Joshua Langam":
#             persons_node = graph.get_node(person_type_node_id)
#             if persons_node:
#                 graph.upsert_relation(persons_node["id"], from_node["id"], "type")
#         if node_to_text(to_node) == "Joshua Langam":
#             persons_node = graph.get_node(person_type_node_id)
#             if persons_node:
#                 graph.upsert_relation(from_node["id"], persons_node["id"], "type")

#     return graph


def filter_by_people(graph: Graph, people_node_ids: set[str]) -> Graph:
    filtered_graph = Graph()

    # Add people nodes
    all_people_node_ids = set()
    for node in graph.get_people_nodes():
        all_people_node_ids.add(node.id)
        if node.id in people_node_ids:
            filtered_graph.add_node(node)
    def is_person_outside_list(node_id: str):
        return node_id in all_people_node_ids and node_id not in people_node_ids

    # Add company nodes connected to people nodes
    all_company_node_ids = set()
    company_node_ids = set()
    for company_node in graph.get_companies_nodes():
        all_company_node_ids.add(company_node.id)
        for relation, node, _ in graph.walk_adjacent(company_node.id, 1):
            if node.id in people_node_ids:
                company_node_ids.add(company_node.id)
                filtered_graph.add_node(company_node)
                filtered_graph.add_relation(relation)
                break
    def is_company_outside_list(node_id: str):
        return node_id in all_company_node_ids and node_id not in company_node_ids

    # Add investors connected to included people and companies
    all_investors_node_ids = set()
    investor_node_ids = set()
    for investor_node in graph.get_investor_nodes():
        all_investors_node_ids.add(investor_node.id)
        for relation, node, _ in graph.walk_adjacent(investor_node.id, 1):
            if node.id in company_node_ids or node.id in people_node_ids:
                filtered_graph.add_node(node)
                filtered_graph.add_relation(relation)
                investor_node_ids.add(investor_node.id)
                break
    def is_investor_outside_list(node_id: str):
        return node_id in all_investors_node_ids and node_id not in investor_node_ids

    # Add ancestors of selected nodes
    visited = set()
    stack: list[tuple[str, list[GraphRelation], int]] = [(global_root_node_id, [], 0)]
    filtered_graph.add_node(graph.get_node(global_root_node_id))
    while stack:
        current_id, path_relations, step = stack.pop()

        # Ignore people, companies, and investors outside of the list
        if is_person_outside_list(current_id) or is_company_outside_list(current_id) or is_investor_outside_list(current_id):
            continue
        
        # Add all relations and nodes in path when we hit a person node
        if current_id in people_node_ids or current_id in company_node_ids or current_id in investor_node_ids:
            for relation in path_relations:
                filtered_graph.add_relation(relation)
                from_node = graph.get_node(relation.from_id)
                to_node = graph.get_node(relation.to_id)
                if from_node: filtered_graph.add_node(from_node)
                if to_node: filtered_graph.add_node(to_node)
            continue

        # Don't go too deep
        next_step = step + 1
        if next_step > 10:
            continue
        if current_id in visited:
            continue

        # Walk down to children
        for relation, node, _ in graph.walk_adjacent(current_id, 1):
            if is_ideapad_relation_type(relation.relation_type_label):
                continue
            stack.append((node.id, path_relations + [relation], next_step))

        visited.add(current_id)
        
    # Add adjacent nodes to investor nodes
    for investor_node_id in investor_node_ids:
        for relation, node, _ in graph.walk_descendants(investor_node_id, 1):
            if is_person_outside_list(node.id): continue
            if is_company_outside_list(node.id): continue
            if is_investor_outside_list(node.id): continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(node)

    # Add nodes and relations adjacent to people nodes
    for node_id in people_node_ids:
        for relation, node, _ in graph.walk_descendants(node_id, 1):
            if is_person_outside_list(node.id): continue
            if is_company_outside_list(node.id): continue
            if is_investor_outside_list(node.id): continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(node)

    # Add relations associated with company nodes
    for company_node_id in company_node_ids:
        for relation, node, _ in graph.walk_descendants(company_node_id, 1):
            if is_person_outside_list(node.id): continue
            if is_company_outside_list(node.id): continue
            if is_investor_outside_list(node.id): continue
            filtered_graph.add_relation(relation)
            filtered_graph.add_node(node)

    # Remove empty nodes
    nodes = list(filtered_graph.nodes.values())
    for node in nodes:
        if node.content == "":
            filtered_graph.remove_node(node.id)

    # Remove nodes with no relations
    node_ids = set(node.id for node in filtered_graph.nodes.values())
    for node_id in node_ids:
        if len(filtered_graph.get_relations_with_from_id(node_id)) == 0 and len(filtered_graph.get_relations_with_to_id(node_id)) == 0:
            filtered_graph.remove_node(node_id)
        
    # Remove relations that aren't connected to anything in the filtered graph
    relations = list(filtered_graph.relations.values())
    for relation in relations:
        if not filtered_graph.has(relation.from_id) or not filtered_graph.has(relation.to_id):
            filtered_graph.remove_relation(relation.id)

    # Add ideapad metadata
    for relation in graph.relations.values():
        if is_ideapad_relation_type(relation.relation_type_label) and filtered_graph.has(relation.from_id):
            filtered_graph.add_relation(relation)
            from_node = graph.get_node(relation.from_id)
            to_node = graph.get_node(relation.to_id)
            if from_node: filtered_graph.add_node(from_node)
            if to_node: filtered_graph.add_node(to_node)
    for relation in filtered_graph.relations.values():
        if relation.relation_type_label in graph._is_ideapad_show_as_attribute_relation_type_labels:
            filtered_graph._is_ideapad_show_as_attribute_relation_type_labels.add(relation.relation_type_label)
        if relation.id in graph._is_ideapad_show_as_none_object_ids:
            filtered_graph._is_ideapad_show_as_none_object_ids.add(relation.id)
    for node in filtered_graph.nodes.values():
        if node.id in graph._is_ideapad_show_as_none_object_ids:
            filtered_graph._is_ideapad_show_as_none_object_ids.add(node.id)

    return filtered_graph


if __name__ == "__main__":
    graph = Graph()

    # Add type nodes to global root
    graph.upsert_relation(global_root_node_id, person_type_node_id)
    graph.upsert_relation(global_root_node_id, company_type_node_id)

    print("Adding linkedin data...")
    graph = add_linkedin(graph)

    # print("Adding josh langam data...")
    # graph = add_josh_langam(graph)

    print("Adding yc companies data...")
    graph = add_yc_companies(graph)

    print("Adding extreme talent data...")
    graph = add_extreme_talent(graph)
    
    print("Adding crunchbase data...")
    graph = add_crunchbase_data(graph)

    # Get counts of people, companies, and investors
    all_people_nodes = graph.get_people_nodes()
    all_people_node_ids = set(node.id for node in all_people_nodes)
    all_company_node_ids = set(node.id for node in graph.get_companies_nodes())
    all_investor_node_ids = set(node.id for node in graph.get_investor_nodes())
    all_extreme_talent_node_ids = set(node.id for node in graph.get_extreme_talent_nodes())
    top_investor_node_ids = set(node.id for node in graph.get_related_nodes_from_id(vcs_list_id))

    # Get set of top investors each person is connected to
    people_to_top_investors_set = {}
    for investor_node_id in top_investor_node_ids:
        for relation, node, _ in graph.walk_adjacent(investor_node_id, 1):
            # Add people directly connected to top investors
            if node.id in all_people_node_ids:
                people_to_top_investors_set[node.id] = people_to_top_investors_set.get(node.id, set()) | {investor_node_id}
            # Add people connected to companies that have top investors
            if node.id in all_company_node_ids:
                for relation, node, _ in graph.walk_adjacent(node.id, 1):
                    if node.id in all_people_node_ids:
                        people_to_top_investors_set[node.id] = people_to_top_investors_set.get(node.id, set()) | {investor_node_id}

    # Get set of companies each person is connected to
    people_to_company_ids = {}
    people_to_people_ids = {}
    for person_node_id in all_people_node_ids:
        for relation, node, _ in graph.walk_adjacent(person_node_id, 1):
            if node.id in all_company_node_ids:
                people_to_company_ids[person_node_id] = people_to_company_ids.get(person_node_id, set()) | {node.id}
            if node.id in all_people_node_ids:
                people_to_people_ids[person_node_id] = people_to_people_ids.get(person_node_id, set()) | {node.id}

    important_node_ids = all_people_node_ids | all_company_node_ids | all_investor_node_ids

    # Sort people
    linkedin_people: list[GraphNode] = []
    extreme_talent_not_connected: list[GraphNode] = []
    extreme_talent_connected: list[GraphNode] = []
    everyone_else: list[GraphNode] = []
    linkedin_people_ids = set(n.id for n in graph.get_related_nodes_from_id(linkedin_users_node_id))
    for node in all_people_nodes:
        if node.id in linkedin_people_ids:
            linkedin_people.append(node)
        elif graph.is_extreme_talent(node.id):
            if len(people_to_top_investors_set.get(node.id, set())) > 0:
                extreme_talent_connected.append(node)
            else:
                extreme_talent_not_connected.append(node)
        else:
            everyone_else.append(node)
    def sort_key(node):
        return (
            len(people_to_company_ids.get(node.id, set())) + len(people_to_top_investors_set.get(node.id, set())),
            # Then by text
            node_to_text(node),
        )
    sorted_people: list[GraphNode] = linkedin_people + sorted(extreme_talent_connected, key=sort_key, reverse=True) + sorted(extreme_talent_not_connected + everyone_else, key=sort_key, reverse=True)
    # Print stats about different groups
    extreme_talent = extreme_talent_connected + extreme_talent_not_connected
    print(f"LinkedIn people: {len(linkedin_people)}")
    print(f"Extreme talent: {len(extreme_talent)} (very connected ones: {len(extreme_talent_connected)})")
    print(f"Everyone else: {len(everyone_else)}")

    # Unless a relation is between important nodes (people, companies, or investors)
    # Flag it as an ideapad attribute
    relations = list(graph.relations.values())
    relations_with_ideapad_attr = set(r.id for r in graph.get_relations_with_to_id(ideapad_show_as_attribute_node_id))
    relations_with_ideapad_none = set(r.id for r in graph.get_relations_with_to_id(ideapad_show_as_none_node_id))

    for relation in relations:
        if relation.id in relations_with_ideapad_attr:
            continue
        if relation.id in relations_with_ideapad_none:
            continue
        from_node = graph.get_node(relation.from_id)
        to_node = graph.get_node(relation.to_id)
        if not from_node or not to_node:
            continue
        from_is_important_node = from_node.id in important_node_ids
        to_is_important_node = to_node.id in important_node_ids
        # If it's e.g. a relation b/w a person and company, leave as-is
        if from_is_important_node and to_is_important_node:
            continue
        # If it's a relation about a person/company, make it an ideapad attribute
        if from_is_important_node:
            make_ideapad_attribute(graph, relation)

    # Find all nodes the extreme talent list nodes
    extreme_talent_lists_node_ids = {extreme_talent_lists_node_id}
    person_to_extreme_talent_lists = defaultdict(set) # node id -> list of extreme talent lists path string
    def collect_extreme_talent_lists(node_id: str, ancestors: list, depth = 0):
        if depth > 10: return # Don't go too deep
        for relation, node, _ in graph.walk_descendants(node_id, 1):
            if node.id in all_people_node_ids:
                ancestor_ids = [ancestor.id for ancestor in ancestors]
                ancestor_path_string = "/".join([node_to_text(ancestor) for ancestor in ancestors])
                extreme_talent_lists_node_ids.update(ancestor_ids)
                person_to_extreme_talent_lists[node.id].add(ancestor_path_string)
            # Walk down to children
            if relation.relation_type_label in ["child", ""] and not graph.is_typed(node.id):
                collect_extreme_talent_lists(node.id, ancestors + [node], depth + 1)
    collect_extreme_talent_lists(extreme_talent_lists_node_id, [])
    # Flag nodes as extreme talent lists
    for node_id in extreme_talent_lists_node_ids:
        make_extreme_talent_list(graph, node_id)
    # Add all extreme talent lists to person nodes as attribute
    for person_node_id, extreme_talent_lists in person_to_extreme_talent_lists.items():
        ancestor_path_string = ",".join([f'"{list_name}"' for list_name in sorted(extreme_talent_lists)])
        upsert_extreme_talent_source_lists(graph, person_node_id, ancestor_path_string)

    # Add extreme talent ancestors to important nodes
    important_node_ids = important_node_ids | extreme_talent_lists_node_ids

    # Hide all non-important nodes
    # nodes = list(graph.nodes.values())
    # for node in nodes:
    #     if node.id not in important_node_ids:
    #         make_ideapad_none(graph, node)

    # Create mock data with industries split out
    # graph_industries = Graph()
    # industries = set()
    # for relation in graph.relations.values():
    #     if relation.relation_type_label == default_relation_types.industry.label:
    #         to_node = graph.get_node(relation.to_id)
    #         if to_node:
    #             text = node_to_text(to_node)
    #             industries.update(text.split(","))
    # for industry in industries:
    #     mock_node = create_node(str(uuid.uuid4())[:10])
    #     graph_industries.add_node(mock_node)
    #     _, relation = graph_industries.upsert_related_node(mock_node.id, industry, default_relation_types.industry.label)
    #     make_ideapad_attribute(graph_industries, relation)
    # with open(os.path.join(output_dir, f"lippdemo-industries.json"), "w") as f:
    #     json.dump(graph_industries.to_dict(), f)

    # Create full version
    graph_full = filter_by_people(graph, set([node.id for node in sorted_people[:2000]]))
    # graph_full = filter_by_people(graph, set([node["id"] for node in sorted_people]))
    assign_canonical_relation(graph_full)
    # assert_graph_integrity(graph_full._graph)
    full_path = os.path.join(output_dir, f"lippdemo.json")
    with open(full_path, "w") as f:
        json.dump(graph_full.to_dict(), f)
    print(f"Saved full version to {full_path}")
    
    # Create lite version
    graph_lite = filter_by_people(graph, set(node.id for node in sorted_people[:300]))
    assign_canonical_relation(graph_lite)
    # assert_graph_integrity(graph_lite._graph)
    lite_path = os.path.join(output_dir, f"lippdemo-lite.json")
    with open(lite_path, "w") as f:
        json.dump(graph_lite.to_dict(), f)

    
    print(f"Saved lite version to {lite_path}")
    
