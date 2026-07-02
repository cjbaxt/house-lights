#!/bin/bash
set -e

echo "▶ Dumping database to JSON..."
source backend/.venv/bin/activate && python3 scripts/dump_to_json.py
echo "✓ Database dumped"

echo ""
echo "▶ Staging data files..."
git add frontend/public/data
CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
echo "  $CHANGED file(s) staged"

echo ""
echo "▶ Committing..."
if git diff --cached --quiet; then
  echo "  (nothing to commit, data unchanged)"
else
  git commit -m "Update data $(date '+%Y-%m-%d')"
  echo "✓ Committed"
fi

echo ""
echo "▶ Pushing to main (triggers GitHub Actions)..."
if git push origin main 2>/dev/null; then
  echo "✓ Pushed to main"
else
  echo "  (already up to date)"
fi

echo ""
echo "▶ Waiting for GitHub Actions to start..."
sleep 5

RUN_ID=$(gh run list --repo cjbaxt/house-lights --branch main --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
if [ -z "$RUN_ID" ]; then
  echo "  Could not find a workflow run — check https://github.com/cjbaxt/house-lights/actions"
  exit 0
fi

echo "  Run ID: $RUN_ID"
echo "  Watching: https://github.com/cjbaxt/house-lights/actions/runs/$RUN_ID"
echo ""

SECONDS_WAITED=0
while true; do
  STATUS=$(gh run view "$RUN_ID" --repo cjbaxt/house-lights --json status,conclusion --jq '[.status, .conclusion] | join(" ")')
  STATE=$(echo "$STATUS" | awk '{print $1}')
  CONCLUSION=$(echo "$STATUS" | awk '{print $2}')

  if [ "$STATE" = "completed" ]; then
    echo ""
    if [ "$CONCLUSION" = "success" ]; then
      echo "✓ Deployed successfully!"
      echo "  https://cjbaxt.github.io/house-lights"
    else
      echo "✗ Deployment failed (conclusion: $CONCLUSION)"
      echo "  https://github.com/cjbaxt/house-lights/actions/runs/$RUN_ID"
    fi
    break
  fi

  printf "  Still running... (%ds)\r" "$SECONDS_WAITED"
  sleep 10
  SECONDS_WAITED=$((SECONDS_WAITED + 10))

  if [ "$SECONDS_WAITED" -gt 300 ]; then
    echo ""
    echo "  Timed out waiting — check manually:"
    echo "  https://github.com/cjbaxt/house-lights/actions/runs/$RUN_ID"
    break
  fi
done
