#!/bin/bash
set -e

# Create a copy of the original .env.local file
cp .env.local .env.local.copy

echo "Updating main branch"
git checkout main && git pull origin main

branches=("mew-lite" "lidemo" "lidemo-lite" "lippdemo" "lippdemo-lite" "scrapedemo" "scrapedemo-lite")

for branch in "${branches[@]}"; do
  echo "Updating ${branch} branch"
  git checkout "$branch"
  git pull
  git merge main --no-edit
  git push
  
  echo "Migrating ${branch} branch"
  if [ -n "$VERCEL_TOKEN" ]; then
    yarn vercel env pull --environment=preview --git-branch="$branch" --token="$VERCEL_TOKEN" .env.local
  else
    yarn vercel env pull --environment=preview --git-branch="$branch" .env.local
  fi
  yarn db:migrate -y
done

# Reset .env.local to the original state
git checkout main
cp .env.local.copy .env.local
rm .env.local.copy

echo "Done"