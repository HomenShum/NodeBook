#!/bin/bash
set -e
echo "Updating main branch"
git checkout main && git pull origin main

echo "Updating lidemo branch"
git checkout lidemo && git pull && git merge main && git push

echo "Updating lippdemo branch"
git checkout lippdemo && git pull && git merge main && git push

echo "Updating scrapedemo branch"
git checkout scrapedemo && git pull && git merge main && git push
