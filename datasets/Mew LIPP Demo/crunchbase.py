import os
from collections import defaultdict

import pandas as pd

# Define data directory path
DATA_DIR = os.path.join('input-data', 'GoodSignal', 'Crunchbase')  # Adjust this path as needed

# input: people.csv, jobs.csv, funding_rounds.csv, organizations.csv 
# output: crunchbase.csv (filtered for only invested in by top VCs, then inner join relevant files)

crunchbase_path = os.path.join("output-data", 'crunchbase.txt')

def get_crunchbase_df():
    # Target investors to match - using word boundaries for more precise matching
    target_investors = [
        r'\bSequoia Capital\b',r'\bSequoia Capital China\b',r'\bSequoia Capital India\b',
        r'\bSequoia Capital Israel\b',r'\bSequoia Capital Hong Kong\b', r'\bSV Angel\b',
        r'\bLightspeed Venture Partners\b',
        r'\bAndreessen Horowitz\b', r'\bKleiner Perkins\b', r'\bKhosla Ventures\b',
        r'\bTiger Global Management\b', r'\bDragoneer Investment Group\b', r'\bGreenspring Associates\b',
        r'\bNew Enterprise Associates\b', r'\bLegend Capital\b', r'\bKaitai Capital\b',
        r'\bAccel\b', r'\bBessemer Venture Partners\b',
        r'\bFirst Round Capital\b', r'\bSpark Capital\b', r'\bFounders Fund\b',
        r'\bIntel Capital\b',r'\bMenlo Ventures\b',r'\bGeneral Catalyst\b'
    ]
    
    people = pd.read_csv(os.path.join(DATA_DIR, 'people.csv'), usecols=[
        'first_name', 'last_name', 'linkedin_url', 'uuid'
    ])
        
    jobs = pd.read_csv(os.path.join(DATA_DIR, 'jobs.csv'), usecols=[
        'org_uuid', 'title', 'person_uuid'
    ])
        
    funding_rounds = pd.read_csv(os.path.join(DATA_DIR, 'funding_rounds.csv'), usecols=[
        'company_name', 'country_code', 'state_code', 'investment_type',
        'announced_on', 'raised_amount_usd', 'investor_names', 'company_uuid'
    ])
        
    organizations = pd.read_csv(os.path.join(DATA_DIR, 'organizations.csv'), usecols=[
        'uuid', 'short_description', 'homepage_url', 'category_list', 'category_group_list'
    ])
        
    # Filter for founders/CEOs, handling case variations and common title patterns
    founder_pattern = r'\bfounder\b'  # Removed unnecessary capture group
    people_jobs = pd.merge(
        people,
        jobs[jobs['title'].str.contains(founder_pattern, case=False, na=False, regex=True)],
        left_on='uuid',
        right_on='person_uuid',
        how='inner'
    )
    # Filter for target investors with more precise regex matching
    funding_rounds = funding_rounds[
        funding_rounds['investor_names'].str.contains(
            '|'.join(target_investors),
            case=False,
            na=False,
            regex=True
        )
    ]
        
    # Normalize Sequoia Capital variants
    funding_rounds['investor_names'] = funding_rounds['investor_names'].str.replace(
        r'\bSequoia Capital (China|India|Israel|Hong Kong)\b',
        'Sequoia Capital',
        regex=True
    )
        
    # First merge funding_rounds with organizations
    funding_orgs = pd.merge(
        funding_rounds,
        organizations,
        left_on='company_uuid',
        right_on='uuid',
        how='inner'
    )
        
    # Then merge with people_jobs
    merged = pd.merge(
        funding_orgs,
        people_jobs,
        left_on='company_uuid',
        right_on='org_uuid',
        how='inner'
    )
        
    # Drop unnecessary columns and handle potential missing columns
    columns_to_drop = ['person_uuid', 'uuid', 'org_uuid']
    merged = merged.drop([col for col in columns_to_drop if col in merged.columns], axis=1)
        
    # Sort alphabetically by company name
    merged = merged.sort_values('company_name', ascending=True)
        
    return merged

def create_crunchbase_csv():
    print("Creating crunchbase.csv...")
    crunchbase_df = get_crunchbase_df()
    output_path = os.path.join(DATA_DIR, 'crunchbase.csv')  
    crunchbase_df.to_csv(output_path, index=False, date_format='%Y-%m-%d')
    print(f"Successfully processed {len(crunchbase_df)} records")
    print(f"Output saved to: {output_path}")

def crunchbase_df_to_txt(crunchbase_df):
    print("Starting crunchbase_df_to_txt...")

    companies = defaultdict(lambda: {
        'country_code': '',
        'state_code': '',
        'investor_names': set(),
        'founders': {},
        'short_description': '',
        'tags': set(),
        'homepage_url': ''
    })

    for _, row in crunchbase_df.fillna('').iterrows():
        company = row['company_name']
        companies[company]['country_code'] = row['country_code']
        companies[company]['state_code'] = row['state_code']
        companies[company]['short_description'] = row['short_description']
        companies[company]['homepage_url'] = row['homepage_url']

        # Combine category lists into tags
        category_tags = set()
        if row['category_list']:
            category_tags.update(tag.strip() for tag in row['category_list'].split(','))
        companies[company]['tags'] = category_tags

        # Clean investor names by removing all special characters and extra whitespace
        investors_str = row['investor_names']
        investors_str = investors_str.replace('{', '').replace('}', '')
        investors_str = investors_str.replace('"', '').replace("'", '')
        investors = [investor.strip() for investor in investors_str.split(',') if investor.strip()]
        # Remove any empty strings or duplicate whitespace and add to set
        investors = {' '.join(inv.split()) for inv in investors if inv}
        companies[company]['investor_names'] = investors

        # Use full name as key to prevent duplicate founders
        full_name = f"{row['first_name'].strip()} {row['last_name'].strip()}"
        if full_name not in companies[company]['founders']:
            companies[company]['founders'][full_name] = {
            	'linkedin_url': row['linkedin_url'].strip(),
            	'title': row['title'].strip()
            }
            print(f"\tAdded founder: {full_name}")

    lines = [] # list of strings
    lines.append("-List of Companies Funded by Top VCs")
    company_count = 0
    for company, data in sorted(companies.items()):
        company_count += 1
        print(f"Writing company {company_count} of {len(companies)}: {company}")
            
        lines.append(f"\t-{company}")
        if data['country_code']:
            lines.append(f"\t\t-Country:: {data['country_code']}")
        if data['state_code']:
            lines.append(f"\t\t-State:: {data['state_code']}")
        if data['short_description']:
            lines.append(f"\t\t-Description:: {data['short_description']}")
        if data['homepage_url']:
            lines.append(f"\t\t-Link:: {data['homepage_url']}")
			
        # Write tags
        for tag in sorted(data['tags']):
            if tag:  # Only write non-empty tags
                lines.append(f"\t\t-Tag:: {tag}")
			
        # Write investors directly with Investor::
        for investor in sorted(data['investor_names']):
            lines.append(f"\t\t-Investor:: {investor}")

        # Write founders directly with Founder::
        for founder_name, founder_data in sorted(data['founders'].items()):
            lines.append(f"\t\t-Founder:: {founder_name}")
            if founder_data['linkedin_url']:
                lines.append(f"\t\t\t-LinkedIn:: {founder_data['linkedin_url']}")
            lines.append(f"\t\t\t-Title:: {founder_data['title']}")

    return "\n".join(lines)

def create_crunchbase_txt():
    print("Starting create_crunchbase_txt...")
    crunchbase_df = get_crunchbase_df()
    crunchbase_txt = crunchbase_df_to_txt(crunchbase_df)
    with open(crunchbase_path, 'w') as file:
        file.write(crunchbase_txt)
    return crunchbase_txt

def get_or_create_crunchbase_path():
    if not os.path.exists(crunchbase_path):
        create_crunchbase_txt()
    return crunchbase_path

if __name__ == "__main__":
    create_crunchbase_txt()
