import os

import pandas as pd

# Define data directory path
DATA_DIR = os.path.join('GoodSignal', 'Crunchbase')  # Adjust this path as needed

# input: people.csv, jobs.csv, funding_rounds.csv, organizations.csv 
# output: crunchbase.csv (filtered for only invested in by top VCs, then inner join relevant files)

def inner_join_funding_jobs():
    print("Starting inner_join_funding_jobs...")
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
    
    try:
        # Updated CSV paths with data directory
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
        
        # Updated output path with data directory
        output_path = os.path.join(DATA_DIR, 'crunchbase.csv')
        merged.to_csv(output_path, index=False, date_format='%Y-%m-%d')
        
        print(f"Successfully processed {len(merged)} records")
        print(f"Output saved to: {output_path}")
        
    except FileNotFoundError as e:
        print(f"Error: Required CSV file not found - {e}")
        print(f"Please ensure all required files exist in: {DATA_DIR}")
    except pd.errors.EmptyDataError:
        print("Error: One or more CSV files are empty")
    except Exception as e:
        print(f"Unexpected error occurred: {e}")

if __name__ == "__main__":
    inner_join_funding_jobs()
    print('crunchbase.csv created')