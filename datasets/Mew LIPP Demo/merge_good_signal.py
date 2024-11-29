import os

# input: all Good Signal files, starting with all .txt files in current directory, 
# 	as well as /Crunchbase/crunchbase.txt. 
# 	(Excludes goodsignal.txt, if the script has been run before)
# output 'goodsignal.txt' (union)

data_dir = os.path.abspath("./GoodSignal")

def get_good_signal_txt():
	"""
	Combines content from all .txt files in the current directory into a single output file.
	"""
	# Initialize empty string to store combined content
	combined_content = ""
	
	# Track if we found any files to process
	files_processed = False
	# Get all files in the current directory
	
	
	# Process files in current directory
	for filename in os.listdir(data_dir):
		# ignore previous output of script to prevent duplication
		if filename == 'goodsignal.txt':
			continue
		# Check if file is a .txt file
		if filename.endswith('.txt'):
			files_processed = True
			file_path = os.path.join(data_dir, filename)
			# Only process files, not directories
			if os.path.isfile(file_path):
				try:
					print(f"Reading file: {filename}")
					# Read file with UTF-8 encoding
					with open(file_path, 'r', encoding='utf-8') as f:
						content = f.read().rstrip('\n')  # Remove trailing newlines
						if combined_content:  # Only add newline between files
							combined_content += '\n'
						combined_content += content
				except Exception as e:
					print(f"Error reading {filename}: {str(e)}")
	
	# Also process Crunchbase file
	crunchbase_path = os.path.join(data_dir, 'Crunchbase', 'crunchbase.txt')
	if os.path.exists(crunchbase_path):
		try:
			print("Reading Crunchbase file")
			files_processed = True
			with open(crunchbase_path, 'r', encoding='utf-8') as f:
				content = f.read().rstrip('\n')
				if combined_content:
					combined_content += '\n'
				combined_content += content
		except Exception as e:
			print(f"Error reading Crunchbase file: {str(e)}")
	else:
		print("Warning: Crunchbase file not found at", crunchbase_path)

	if not files_processed:
		print("No .txt files found in the current directory")
		return ""

	return combined_content


def create_good_signal_txt():
	print("Starting create_good_signal_txt...")
	combined_content = get_good_signal_txt()
	output_path = os.path.join(data_dir, 'goodsignal.txt')
	with open(output_path, 'w', encoding='utf-8') as f:
		f.write(combined_content)
	print(f"Created {output_path}")
			

if __name__ == "__main__":
	create_good_signal_txt()
