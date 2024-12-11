# Mew demo datasets

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

Place the contents of the [this google drive folder](https://drive.google.com/drive/u/1/folders/17kzsQtV4cR8QWTlzNi4NSTckTI_8yIO4) in the `data/input` folder.

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

Upload the datasets to the following demo instances. Make sure to clear the old dataset (from settings) before uploading a new one.

Linkedin: https://lidemo.ideaflow.app/
Linkedin lite: https://lidemo-lite.ideaflow.app/
Linkedin++: https://lippdemo.ideaflow.app/
Linkedin++ lite: https://lippdemo-lite.ideaflow.app/
Scrapedemo: https://scrapedemo.ideaflow.app/
Scrapedemo lite: https://scrapedemo-lite.ideaflow.app/
