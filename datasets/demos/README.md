# Mew demo datasets

This repository contains the code for creating the following demo datasets:

Linkedin:
- Mew full: https://lidemo.ideaflow.app/
- Mew lite: https://lidemo-lite.ideaflow.app/
- Ideapad full: https://ideapad.io/lidemo-2025-01-22-4/
- Ideapad lite: https://ideapad.io/lidemo-lite-2025-02-11-1/

Linkedin++:
- Mew full: https://lippdemo.ideaflow.app/
- Mew lite: https://lippdemo-lite.ideaflow.app/
- Ideapad full: https://ideapad.io/lippdemo-2025-01-22-1/
- Ideapad lite: https://ideapad.io/lippdemo-lite-2025-01-22-2/

Scrapedemo:
- Mew full: https://scrapedemo.ideaflow.app/
- Mew lite: https://scrapedemo-lite.ideaflow.app/

## Setup

Install dependencies:

```
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a folders for the input and output data:

```
mkdir data data/input data/output
```

Download and unzip the input data from [here](https://drive.google.com/drive/u/1/folders/1Jx-xXHLq2-YUrece0wNbKAgUUIheKJFr) and place it's contents in the `data/input` folder.

## Create datasets

Linkedin:
```
python src/lidemo.py
```

Linkedin++:
```
python src/lippdemo.py
```

Scrapedemo:
```
python src/scrapedemo.py
```

Each script creates both the full and lite versions of the dataset.

You'll find the datasets in the `data/output` folder.

## Upload datasets

### Mew

- **Go to mew demo instance** you want to update (links above)
- **Clear old dataset:** In settings, click "Clear all data"
- **Import new dataset:** Click "Import Data" in settings and wait for import to complete before closing

### Ideapad

- **Uploading to Mew** first is necessary to create an ideapad compatible dataset. So make sure you've done the [above](#mew) already.
- **Click "Export to Ideapad"** in the mew demo instance settings to download the full dataset as a json file
- **Go to ideapad** and **create new board** in list view (naming convention example: "lidemo-2025-02-11.1")
- **Click "Go into board"** then **"Graph"** in the header
- **Upload via settings:** Open right sidebar settings, click "Upload a .json file..." and select your downloaded json
- **Wait ~5s** for upload to complete (check network tab), then refresh the page
