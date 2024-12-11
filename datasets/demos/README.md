# Mew demo datasets

This repository contains the code for creating the demo datasets for the following demo instances:

- Linkedin: https://lidemo.ideaflow.app/
- Linkedin lite: https://lidemo-lite.ideaflow.app/
- Linkedin++: https://lippdemo.ideaflow.app/
- Linkedin++ lite: https://lippdemo-lite.ideaflow.app/
- Scrapedemo: https://scrapedemo.ideaflow.app/
- Scrapedemo lite: https://scrapedemo-lite.ideaflow.app/

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

Upload the datasets to the following demo instances (links above). Make sure to clear the old dataset before uploading a new one (there's a button for that in the settings).

