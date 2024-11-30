from crunchbase import create_crunchbase_txt
from merge_good_signal import create_good_signal_txt
from merge_good_signal_with_linkedin import merge_good_wignal_with_linkedin

if __name__ == "__main__":
   print("Starting...")
   create_crunchbase_txt()
#    create_good_signal_txt()
   merge_good_wignal_with_linkedin("LinkedIn", "Good Signal/goodsignal.txt", "lippdemo.txt")

