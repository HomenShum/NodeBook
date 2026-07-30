#!/bin/bash
# This script updates all branches specified below to match the main.
# Each of these branches has a corresponding preview deployment on Vercel which we
# want to keep in sync with the main branch.
#
# Usage:
#
# When running locally with an already linked vercel project, you can run the script
# without the vercel token.
# >>> ./update-branches.sh
#
# If running in CI, you need to pass the vercel token as an argument.
# >>> ./update-branches.sh <vercel-token>
set -e

branches=("nodebook-lite" "nodebook-extra-lite" "lidemo" "lidemo-lite" "lippdemo" "lippdemo-lite" "scrapedemo" "scrapedemo-lite" "geometry-vc")
vercel_token=$1

# Create a copy of the original .env.local file
if [ -f .env.local ]; then
  mv .env.local .env.local.copy
fi
current_branch=$(git rev-parse --abbrev-ref HEAD)

# Link the vercel project if we have a token
if [ -n "$vercel_token" ]; then
  yarn vercel link --yes --project prj_M9QeEZasw5AkcJ8Z6sf2WCwelhjz --token="$vercel_token"
fi

git fetch origin main
for branch in "${branches[@]}"; do
  echo "Updating ${branch}"
  # FETCH_HEAD refers to main since we just fetched it above
  git push origin FETCH_HEAD:${branch} --force
  
  echo "Migrating ${branch} branch"
  if [ -n "$vercel_token" ]; then
    yarn vercel env pull --environment=preview --git-branch="$branch" --token="$vercel_token" .env.local
  else
    yarn vercel env pull --environment=preview --git-branch="$branch" .env.local
  fi
  yarn db:migrate -y
done

# Reset .env.local to the original state
if [ -f .env.local.copy ]; then
  # If we had an original .env.local, restore it from the backup
  mv .env.local.copy .env.local
else
  # If we didn't have an original .env.local, remove the one created during the process
  rm -f .env.local
fi

git checkout "$current_branch"

echo "Done"