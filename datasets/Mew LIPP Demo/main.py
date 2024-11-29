from convert_csv_to_outline import convert_csv_to_outline
from filter_merge import inner_join_funding_jobs
from merge_good_signal import create_good_signal_txt
from merge_good_signal_with_linkedin import merge_good_wignal_with_linkedin

if __name__ == "__main__":
   print("Starting...")
#    inner_join_funding_jobs()
#    convert_csv_to_outline("crunchbase.csv", "crunchbase.txt")
#    create_good_signal_txt()
   merge_good_wignal_with_linkedin("LinkedIn", "Good Signal/goodsignal.txt", "lippdemo.txt")

