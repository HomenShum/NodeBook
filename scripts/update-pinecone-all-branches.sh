#!/bin/bash
# This script creates/updates the pinecone indices for all branches.
# It is intended to be run in a GitHub Actions workflow.
# See scripts/upload-to-pinecone.ts for more details.
#
# Usage:
# >>> ./update-pinecone-all-branches.sh <vercel-token>
set -e

branches=("nodebook-lite" "lidemo" "lidemo-lite" "lippdemo" "lippdemo-lite" "scrapedemo" "scrapedemo-lite")
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
  echo "Processing branch: $branch"
  yarn tsx scripts/upload-to-pinecone.ts --since-hours 24
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