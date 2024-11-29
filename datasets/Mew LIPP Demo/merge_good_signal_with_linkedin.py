import csv
import os
import re
from collections import defaultdict

import emoji
import pandas as pd

# input: /LinkedIn/(all .csv files in directory), goodsignal.txt
# output: lippdemo.txt

class Node:
    """
    A class representing a node in the outline tree structure.
    Each node contains a raw line of text, an optional link, and references to children/parent nodes.
    """
    def __init__(self, raw_line, link=None):
        self.raw_line = raw_line  # The entire line as in the Markdown file
        self.link = link
        self.children = []
        self.parent = None

    def add_child(self, child):
        """Add a child node and set its parent reference"""
        child.parent = self
        self.children.append(child)

def parse_outline(file_path):
    """
    Parse an outline file into a tree structure.
    Returns:
    - roots: List of root level nodes
    - name_to_nodes: Dictionary mapping names to their corresponding nodes
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    roots = []  # List to hold multiple root nodes
    stack = []  # Stack to manage hierarchy based on indentation
    name_to_nodes = defaultdict(list)  # Maps names to nodes for easy lookup

    for line_num, line in enumerate(lines, 1):
        # Calculate indentation level
        stripped = line.lstrip('\t')
        indent_level = len(line) - len(stripped)
        stripped = stripped.strip()

        # Skip empty lines
        if not stripped:
            continue

        # Each line in our ontological outline format starts with a dash (-) to indicate hierarchy.
        # This block processes each line to extract either key-value pairs or simple text nodes.
        if stripped.startswith('-'):
            # Clean up the line by removing the dash and any whitespace
            stripped = stripped[1:].strip()  

            # Look for key-value pairs in the format "Key:: Value"
            match = re.match(r'([^:]+)::\s*(.+)', stripped)
            
            if match:
                # Successfully found a key-value pair
                key, value = match.groups()
                node = Node(f"{key}:: {value}")
            else:
                # Line doesn't contain a key-value pair, so treat it as a simple text node
                node = Node(stripped)

            # Maintain proper tree structure based on indentation
            while stack and stack[-1][0] >= indent_level:
                stack.pop()
            if stack:
                parent = stack[-1][1]
                parent.add_child(node)
            else:
                roots.append(node)
            stack.append((indent_level, node))

            # Add to name_to_nodes for any text that could be a name
            # This includes both key-value pairs and simple text nodes
            name_value = emoji.replace_emoji(stripped, '')
            if match:
                # For key-value pairs, only use the value if it looks like a name
                _, value = match.groups()
                name_value = emoji.replace_emoji(value, '')
            
            # Clean and normalize the name before adding to name_to_nodes
            name_value = name_value.strip()
            if name_value:  # Only add non-empty strings
                # Store original value but use lowercase key for lookup
                name_to_nodes[name_value.lower()].append(node)
                
                # Generate simplified version (without middle components)
                name_parts = name_value.split()
                if len(name_parts) > 2:
                    simplified = f"{name_parts[0]} {name_parts[-1]}"
                    name_to_nodes[simplified.lower()].append(node)

    return roots, name_to_nodes

def get_ancestral_path(node, all_roots):
    """Get the path from a node to its root, including the root if necessary"""
    path = []
    current = node
    while current.parent:
        path.insert(0, current.parent)
        current = current.parent
    # If the node has no parent, it's a root node; ensure it's included
    if current not in all_roots:
        path.insert(0, current)
    return path

def collect_subtree(node, included_nodes):
    """Collect all nodes in a subtree into the included_nodes set"""
    included_nodes.add(node)
    for child in node.children:
        collect_subtree(child, included_nodes)

def is_under_companies_funded(node):
    """Check if node is under 'List of Companies Funded by Top VCs'"""
    current = node
    while current.parent:
        if current.parent.raw_line == "List of Companies Funded by Top VCs":
            return True
        current = current.parent
    return False

def merge_nodes(roots, included_nodes):
    """
    Create a new tree containing only the nodes in included_nodes.
    Preserves the structure of included nodes while pruning excluded ones.
    """
    new_roots = []
    for root in roots:
        if root in included_nodes:
            new_root = Node(root.raw_line, root.link)
            for child in root.children:
                merged_child = merge_nodes_recursive(child, included_nodes)
                if merged_child:
                    new_root.add_child(merged_child)
            new_roots.append(new_root)
        else:
            # Even if the root isn't included, its children might be
            for child in root.children:
                merged_children = merge_nodes([child], included_nodes)  # Pass as list
                new_roots.extend(merged_children)
    return new_roots

def merge_nodes_recursive(node, included_nodes):
    """Recursive helper for merge_nodes"""
    if node not in included_nodes:
        return None
    new_node = Node(node.raw_line, node.link)
    for child in node.children:
        merged_child = merge_nodes_recursive(child, included_nodes)
        if merged_child:
            new_node.add_child(merged_child)
    return new_node

def write_outline(roots, file, level=0):
    """Write the tree structure to a file in outline format"""
    for node in roots:
        indent = '\t' * level
        file.write(f"{indent}-{node.raw_line}\n")
        if node.children:
            write_outline(node.children, file, level + 1)

def create_output_lines(roots, level=0):
    """Create a list of lines from the tree structure"""
    lines = []
    for node in roots:
        indent = '\t' * level
        lines.append(f"{indent}-{node.raw_line}")
        if node.children:
            lines.extend(create_output_lines(node.children, level + 1))
    return lines

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

def extract_unique_names(linked_in_folder):
    """
    Extract unique names and their details from LinkedIn CSV files.
    Returns:
    - unique_names: Set of unique full names
    - name_details: Dictionary mapping names to company/position info
    - name_sources: Dictionary mapping names to their source files
    - name_mappings: Dictionary mapping full names to their simplified versions
    """
    print('extracting unique names')
    unique_names = set()
    name_details = defaultdict(list)
    name_sources = defaultdict(set)
    name_mappings = {}  # Maps full names to simplified versions

    print('going to open files')
    for filename in os.listdir(linked_in_folder):
        print(f'processing file {filename}')
        file_path = os.path.join(linked_in_folder, filename)
        if os.path.isfile(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as csvfile:
                    for _ in range(3):
                        next(csvfile)
                    reader = csv.DictReader(csvfile)
                    print('opened file successfully.')
                    if 'First Name' in reader.fieldnames and 'Last Name' in reader.fieldnames:
                        for row in reader:
                            first = clean_first_name(row['First Name'].strip())
                            last = clean_last_name(row['Last Name'])
                            company = row.get('Company', '').strip()
                            position = row.get('Position', '').strip()
                            if first and last:
                                first = emoji.replace_emoji(first, '')
                                last = emoji.replace_emoji(last, '')
                                
                                full_name = f"{first} {last}"
                                unique_names.add(full_name)
                                source_name = os.path.splitext(filename)[0]
                                name_sources[full_name.lower()].add(source_name)
                                
                                if company and position:
                                    name_details[full_name.lower()].append({
                                        'company': company,
                                        'position': position
                                    })
                                
                                # Create simplified version for all names with more than 2 parts
                                name_parts = full_name.split()
                                if len(name_parts) > 2:
                                    simplified_name = f"{name_parts[0]} {name_parts[-1]}"
                                    name_mappings[full_name] = simplified_name
                                    unique_names.add(simplified_name)
                                    name_sources[simplified_name.lower()].add(source_name)
                                    if company and position:
                                        name_details[simplified_name.lower()].append({
                                            'company': company,
                                            'position': position
                                        })
                    else:
                        pass
            except Exception as e:
                print(f"Error processing file {filename}: {str(e)}")
                pass
    return unique_names, name_details, name_sources, name_mappings

def merge_good_wignal_with_linkedin(input_folder, input_file, output_file):
    """
    Main function to merge LinkedIn data with the good signal outline.
    
    Args:
    - input_folder: Folder containing LinkedIn CSV files
    - input_file: Path to the good signal outline file
    - output_file: Path where the merged result will be written
    """
    print("Starting merge_good_wignal_with_linkedin...")
    # Parse the outline file into a tree structure
    roots, name_to_nodes = parse_outline(input_file)
    linked_in_folder = input_folder

    # Extract unique names and their details from LinkedIn files
    unique_names, name_details, name_sources, name_mappings = extract_unique_names(linked_in_folder)
    input_strings = unique_names

    print(f"Total unique names extracted from LinkedIn: {len(input_strings)}")
    print(f"Total names in outline mapping: {len(name_to_nodes)}")

    # Debug: Print some sample names from both sets
    print("\nSample LinkedIn names:")
    for name in list(input_strings)[:5]:
        print(f"  {name}")

    included_nodes = set()
    match_count = 0
    added_names = set()  # To track first instances

    # Process each name from LinkedIn data
    for string in input_strings:
        string_lower = string.lower()  # Convert to lowercase for matching only
        if string_lower in name_to_nodes:
            nodes = name_to_nodes[string_lower]
            for node in nodes:
                # Get the original text before any modifications
                original_text = node.raw_line
                
                # Check if this name has more than 2 parts (including middle names/initials)
                name_parts = string.split()  # Use original case string
                if len(name_parts) > 2:
                    # Create simplified version (first + last name only)
                    simplified_name = f"{name_parts[0]} {name_parts[-1]}"
                    # Update node's text with simplified version
                    if "::" in original_text:
                        key, _ = original_text.split("::", 1)
                        node.raw_line = f"{key}:: {simplified_name}"
                    else:
                        node.raw_line = simplified_name
                    # Add original full name as a child node
                    full_name_node = Node(f"Full Name:: {string}")
                    node.add_child(full_name_node)
                    included_nodes.add(full_name_node)
                
                # Add the original node to included_nodes
                included_nodes.add(node)
                
                # Add company, position, and connection details if available
                if string_lower in name_details and string_lower not in added_names:
                    details = name_details[string_lower][0]  # Get the first occurrence
                    company = details.get('company')
                    position = details.get('position')
                    if company:
                        company_node = Node(f"Current Company:: {company}")
                        node.add_child(company_node)
                        included_nodes.add(company_node)
                    if position:
                        position_node = Node(f"Current Position:: {position}")
                        node.add_child(position_node)
                        included_nodes.add(position_node)
                    
                    # Add connection information
                    if string_lower in name_sources:
                        for source in name_sources[string_lower]:
                            knows_node = Node(f"Knows:: {source}")
                            node.add_child(knows_node)
                            included_nodes.add(knows_node)
                            
                    added_names.add(string_lower)
                
                # Add path to roots and collect subtree
                path = get_ancestral_path(node, roots)
                for ancestor in path:
                    included_nodes.add(ancestor)
                collect_subtree(node, included_nodes)
                
                # If under "List of Companies Funded by Top VCs", include investor siblings
                if is_under_companies_funded(node) and node.parent:
                    for sibling in node.parent.children:
                        if (sibling.raw_line.startswith("Investor::") or
                            sibling.raw_line.startswith("Description::") or
                            sibling.raw_line.startswith("Tag::") or
                            sibling.raw_line.startswith("Link::")):
                            included_nodes.add(sibling)
                
                match_count += 1

    print(f"\nTotal matches found: {match_count}")

    # Create and write the final merged tree
    pruned_roots = merge_nodes(roots, included_nodes)
    lines = create_output_lines(pruned_roots) if pruned_roots else []
    
    # Append list of investors
    crunchbase_path = os.path.join('Good Signal', 'Crunchbase', 'crunchbase.csv')
    # Read investors column from crunchbase CSV
    try:
        df = pd.read_csv(crunchbase_path)
        # Create a dictionary to store investor counts
        investor_counts = {}
        
        # Process each row's investor_names
        for investors in df['investor_names'].dropna():
            # Clean and split the investor string
            investors = investors.replace('{','').replace('}','').replace('"','').replace("'",'')
            investor_list = [inv.strip() for inv in investors.split(',') if inv.strip()]
            
            # Increment count for each investor
            for investor in investor_list:
                investor_counts[investor] = investor_counts.get(investor, 0) + 1
        
        # Convert to sorted list of tuples (investor, count)
        sorted_investors = list(investor_counts.items())

        # Exclude any investors that aren't mentioned anywhere else in the outline
        def in_output(investor):
            for line in lines:
                if investor in line:
                    return True
            return False
        sorted_investors = [v for v in sorted_investors if v[1] > 1 and in_output(v[0])]

        # Only select the top 10 investors
        sorted_investors = sorted(sorted_investors, key=lambda x: x[1], reverse=True)[:10]
        
    except Exception as e:
        print(f"Error reading Crunchbase investors: {e}")
        sorted_investors = []

    # Append the investors list to the output file
    lines.append("-List of Top Investors")
    for investor, _ in sorted_investors:
        lines.append(f"\t-Investor:: {investor}")

    with open(output_file, 'w', encoding='utf-8') as f:
        for line in lines:
            f.write(line + '\n')

if __name__ == "__main__":
    merge_good_wignal_with_linkedin("LinkedIn", "Good Signal/goodsignal.txt", "lippdemo.txt")