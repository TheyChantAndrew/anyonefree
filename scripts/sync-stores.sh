#!/usr/bin/env bash
# Copy the latest scouted data into the site. Falls back to labeled SAMPLE data.
set -e
cd "$(dirname "$0")/.."
SRC="${1:-/workspace/tcg-heist/stores.json}"
if [ -s "$SRC" ] && python3 -c "import json,sys;d=json.load(open('$SRC'));s=d['stores'] if isinstance(d,dict) else d;sys.exit(0 if s else 1)"; then
  cp "$SRC" public/stores.json; echo "Copied real data from $SRC"
else
  cp data/sample-stores.json public/stores.json; echo "No real data yet; using SAMPLE data"
fi
# Then: git add public/stores.json && git commit -m "Update stores" && git push  (Vercel auto-redeploys)
