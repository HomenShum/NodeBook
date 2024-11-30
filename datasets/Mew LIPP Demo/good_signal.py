import glob
import os

from crunchbase import get_or_create_crunchbase_path

good_signal_dir = os.path.join("input-data", "GoodSignal")
output_path = os.path.join("output-data", 'goodsignal.txt')

def get_good_signal_txt():
	"""
	Combines content from all .txt files in the current directory into a single output file.
	"""
	# Collect all paths to process
	paths_to_process = []
	# Get all .txt files from data directory, excluding goodsignal.txt
	for path in glob.glob(os.path.join(good_signal_dir, '*.txt')):
		paths_to_process.append(path)
	# Add crunchbase path
	crunchbase_path = get_or_create_crunchbase_path()
	paths_to_process.append(crunchbase_path)
	if not paths_to_process:
		print("No files found to process")
		return ""
	
	# Process all collected paths
	contents = []
	for file_path in paths_to_process:
		print(f"Reading file: {os.path.basename(file_path)}")
		with open(file_path, 'r', encoding='utf-8') as f:
			contents.append(f.read().rstrip('\n'))

	return '\n'.join(contents)

def create_good_signal_txt():
	print("Starting create_good_signal_txt...")
	combined_content = get_good_signal_txt()
	with open(output_path, 'w', encoding='utf-8') as f:
		f.write(combined_content)
	print(f"Created {output_path}")

if __name__ == "__main__":
	create_good_signal_txt()
