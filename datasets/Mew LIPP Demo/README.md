# Mew demo datasets

## Getting started

Install dependencies:

```
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a folders for the input and output data:

```
mkdir input-data output-data
```

Place the contents of the [this google drive folder](https://drive.google.com/drive/u/1/folders/17kzsQtV4cR8QWTlzNi4NSTckTI_8yIO4) in the `input-data` folder.


## Scrapedemo dataset

Requires `input-data/stanford-independent-labs.txt` to exist.

```
python scrapedemo.py
```

## LinkedIn dataset

Requires `input-data/josh_langam_only.json` to exist.

```
python lidemo.py
```


# Old

Run the python files in this order:
- /GoodSignal/Crunchbase/1_filter_merge.py
- /GoodSignal/Crunchbase/2_convert_csv_to_outline.py
- /GoodSignal/merge_good_signal.py
- /merge_good_signal_with_linkedin.py

Manually add at the end:
- Manually add in ‘josh_langam_only.json’.I
  - This was the file I mentioned earlier Taylor, where I used ‘export subtree’ and I
can’t seem to actually get the import to happen. You can take a crack at it-the
file is the main Mew LIPP Demo folder.
- Create a node called “List of Top VCs”. Manually connect the following VC names:
  - Sequoia Capital
  - SV Angel
  - Lightspeed Venture Partners
  - Andreessen Horowitz
  - Kleiner Perkins
  - Khosla Ventures
  - Tiger Global Management
  - Dragoneer Investment Group
  - New Enterprise Associates
  - Accel
  - Bessemer Venture Partners
  - First Round Capital
  - Spark Capital
  - Founders Fund
  - Intel Capital
  - Menlo Ventures
  - General Catalyst

Note for Taylor:
- Taylor can create a system to convert the ‘lippdemo.txt’ output into a ‘lippdema.ison’ file so that the import plays nice with Mew.