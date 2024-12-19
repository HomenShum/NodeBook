#!/bin/bash
set -e

vercel_token=$1

# Create a copy of the original .env.local file
if [ -f .env.local ]; then
  mv .env.local .env.local.copy
fi

echo "Updating main branch"
git checkout main && git pull origin main

# branches=("mew-lite" "lidemo" "lidemo-lite" "lippdemo" "lippdemo-lite" "scrapedemo" "scrapedemo-lite")
branches=("mew-lite")

for branch in "${branches[@]}"; do
  echo "Updating ${branch} branch"
  git checkout "$branch"
  git pull
  git merge main --no-edit
  git push
  
  echo "Migrating ${branch} branch"
  if [ -n "$vercel_token" ]; then
    yarn vercel env pull --environment=preview --git-branch="$branch" --token="$vercel_token" .env.local
  else
    yarn vercel env pull --environment=preview --git-branch="$branch" .env.local
  fi
  yarn db:migrate -y
done

# Reset .env.local to the original state
git checkout main
if [ -f .env.local.copy ]; then
  # If we had an original .env.local, restore it from the backup
  mv .env.local.copy .env.local
else
  # If we didn't have an original .env.local, remove the one created during the process
  rm -f .env.local
fi

echo "Done"