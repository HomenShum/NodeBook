import csv
import os
from collections import defaultdict

# Add at top of file, after imports
DATA_DIR = os.path.join('GoodSignal', 'Crunchbase')  # Change this to your desired data directory path

# input: crunchbase.csv
# output: crunchbase.txt

def convert_csv_to_outline(input_csv, output_txt):
	print("Starting convert_csv_to_outline...")

	# Update input/output paths to use DATA_DIR
	input_path = os.path.join(DATA_DIR, input_csv)
	output_path = os.path.join(DATA_DIR, output_txt)
	
	print(f"Starting conversion from {input_path} to {output_path}")
	
	companies = defaultdict(lambda: {
		'country_code': '',
		'state_code': '',
		'investor_names': set(),
		'founders': {},
		'short_description': '',
		'tags': set(),
		'homepage_url': ''
	})

	with open(input_path, mode='r', encoding='utf-8') as csvfile:
		reader = csv.DictReader(csvfile)
		row_count = 0
		for row in reader:
			row_count += 1
			# print(f"Processing row {row_count}: Company = {row['company_name']}")
			
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
			companies[company]['investor_names'].update(investors)

			# Use full name as key to prevent duplicate founders
			full_name = f"{row['first_name'].strip()} {row['last_name'].strip()}"
			if full_name not in companies[company]['founders']:
				companies[company]['founders'][full_name] = {
					'linkedin_url': row['linkedin_url'].strip(),
					'title': row['title'].strip()
				}
				print(f"\tAdded founder: {full_name}")

	print(f"\nWriting output to {output_path}")
	with open(output_path, mode='w', encoding='utf-8') as outfile:
		outfile.write("-List of Companies Funded by Top VCs\n")
		company_count = 0
		for company, data in sorted(companies.items()):
			company_count += 1
			print(f"Writing company {company_count} of {len(companies)}: {company}")
			
			outfile.write(f"\t-{company}\n")
			if data['country_code']:
				outfile.write(f"\t\t-Country:: {data['country_code']}\n")
			if data['state_code']:
				outfile.write(f"\t\t-State:: {data['state_code']}\n")
			if data['short_description']:
				outfile.write(f"\t\t-Description:: {data['short_description']}\n")
			if data['homepage_url']:
				outfile.write(f"\t\t-Link:: {data['homepage_url']}\n")
			
			# Write tags
			for tag in sorted(data['tags']):
				if tag:  # Only write non-empty tags
					outfile.write(f"\t\t-Tag:: {tag}\n")
			
			# Write investors directly with Investor::
			for investor in sorted(data['investor_names']):
				outfile.write(f"\t\t-Investor:: {investor}\n")

			# Write founders directly with Founder::
			for founder_name, founder_data in sorted(data['founders'].items()):
				outfile.write(f"\t\t-Founder:: {founder_name}\n")
				if founder_data['linkedin_url']:
					outfile.write(f"\t\t\t-LinkedIn:: {founder_data['linkedin_url']}\n")
				outfile.write(f"\t\t\t-Title:: {founder_data['title']}\n")

	print(f"\nConversion complete! Processed {row_count} rows into {len(companies)} companies")
	print('created file crunchbase.txt from crunchbase.csv')
if __name__ == "__main__":
	convert_csv_to_outline("crunchbase.csv", "crunchbase.txt")