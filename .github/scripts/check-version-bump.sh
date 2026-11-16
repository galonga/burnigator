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

status=0

# check LABEL FILE PATTERN: the number matched by PATTERN in FILE must be present
# in both refs and larger at head. Patterns tolerate whitespace/quote changes.
check() {
  local label="$1" file="$2" pattern="$3" old new
  old=$(git show "$base:$file" | grep -oE "$pattern" | head -1 | grep -oE '[0-9]+' || true)
  new=$(git show "$head:$file" | grep -oE "$pattern" | head -1 | grep -oE '[0-9]+' || true)
  if [ -z "$old" ] || [ -z "$new" ]; then
    echo "::error file=$file::Could not read the $label from $file (base='$old', head='$new'). The check's pattern may need updating."
    status=1
  elif [ "$new" -le "$old" ]; then
    echo "::error file=$file::Application files changed but the $label in $file did not increase (base $old, head $new)."
    status=1
  fi
}

check "footer build number" index.php "aria-label=[\"']Build [0-9]+[\"']"
check "CACHE_NAME version" sw.js "CACHE_PREFIX[[:space:]]*\\+[[:space:]]*[\"']v[0-9]+[\"']"

if [ "$status" -ne 0 ]; then
  echo "Changed application files:"; echo "$app_changed"
fi
exit "$status"
