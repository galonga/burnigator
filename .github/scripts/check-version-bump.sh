#!/usr/bin/env bash
# Fails if application code changed but the footer build number (index.php)
# or the service-worker cache version (sw.js) did not change.
# See "Development notes" in README.md.
set -euo pipefail

base="${1:?base ref}"
head="${2:-HEAD}"

changed=$(git diff --name-only "$base" "$head")

# Files that ship to visitors. Docs, workflows and vendored libs are exempt.
app_changed=$(printf '%s\n' "$changed" \
  | grep -E '\.(php|js|css)$|^sw\.js$' \
  | grep -vE '^(assets/vendor/|\.github/)' || true)

if [ -z "$app_changed" ]; then
  echo "No application files changed; no version bump needed."
  exit 0
fi

build_of() { git show "$1:index.php" | grep -o 'aria-label="Build [0-9]*"' | head -1; }
cache_of() { git show "$1:sw.js" | grep -o "CACHE_PREFIX+'v[0-9]*'" | head -1; }

status=0
if [ "$(build_of "$base")" = "$(build_of "$head")" ]; then
  echo "::error file=index.php::Application files changed but the footer build number in index.php was not incremented."
  status=1
fi
if [ "$(cache_of "$base")" = "$(cache_of "$head")" ]; then
  echo "::error file=sw.js::Application files changed but the CACHE_NAME version in sw.js was not incremented."
  status=1
fi

if [ "$status" -ne 0 ]; then
  echo "Changed application files:"; echo "$app_changed"
fi
exit "$status"
