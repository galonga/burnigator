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

# Print the numeric version from FILE at REF, or nothing if it cannot be found.
# Tolerates whitespace and quote-style changes around the value.
build_of() { git show "$1:index.php" | grep -oE "aria-label=[\"']Build [0-9]+[\"']" | head -1 | grep -oE '[0-9]+' || true; }
cache_of() { git show "$1:sw.js" | grep -oE "CACHE_PREFIX[[:space:]]*\+[[:space:]]*[\"']v[0-9]+[\"']" | head -1 | grep -oE '[0-9]+' || true; }

status=0

# check LABEL FILE BASE_VALUE HEAD_VALUE: both values must be numeric and HEAD > BASE.
check() {
  local label="$1" file="$2" old="$3" new="$4"
  if [ -z "$old" ] || [ -z "$new" ]; then
    echo "::error file=$file::Could not read the $label from $file (base='${old}', head='${new}'). The check's pattern may need updating."
    status=1
  elif [ "$new" -le "$old" ]; then
    echo "::error file=$file::Application files changed but the $label in $file did not increase (base $old, head $new)."
    status=1
  fi
}

check "footer build number" index.php "$(build_of "$base")" "$(build_of "$head")"
check "CACHE_NAME version" sw.js "$(cache_of "$base")" "$(cache_of "$head")"

if [ "$status" -ne 0 ]; then
  echo "Changed application files:"; echo "$app_changed"
fi
exit "$status"
