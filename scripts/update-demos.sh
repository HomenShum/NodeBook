#!/bin/bash
set -e

# Create a copy of the original .env.local file
cp .env.local .env.local.copy

echo "Updating main branch"
git checkout main && git pull origin main

# List of demo branches to update
demo_branches=("lidemo" "lippdemo" "scrapedemo")

for branch in "${demo_branches[@]}"; do
  echo "Updating ${branch} branch"
  git checkout "$branch"
  git pull
  git merge main --no-edit
  git push
  
  echo "Migrating ${branch} branch"
  yarn vercel env pull --environment=preview --git-branch="$branch" .env.local
  yarn db:migrate
done

# Reset .env.local to the original state
git checkout main
cp .env.local.copy .env.local
rm .env.local.copy

echo "Done"