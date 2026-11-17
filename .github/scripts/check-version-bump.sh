#!/usr/bin/env bash
# Fails if application code changed but the VERSION file did not move forward.
# VERSION uses CalVer: YEAR.MONTH.BUILD (for example 2026.11.1359). The last
# number is the build number and must increase with every change to files that
# ship to visitors. See CONTRIBUTING.md and RELEASING.md.
set -euo pipefail

base="${1:?base ref}"
head="${2:-HEAD}"

changed=$(git diff --name-only "$base" "$head")

# Files that ship to visitors. Docs, workflows and vendored libs are exempt.
app_changed=$(printf '%s\n' "$changed" \
  | grep -E '\.(php|js|css)$|^sw\.js$' \
  | grep -vE '^(assets/vendor/|\.github/|tests/)' || true)

if [ -z "$app_changed" ]; then
  echo "No application files changed; no version bump needed."
  exit 0
fi

pattern='^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]+$'

new=$(git show "$head:VERSION" 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$new" ] || ! printf '%s' "$new" | grep -Eq "$pattern"; then
  echo "::error file=VERSION::VERSION is missing or not in the form YEAR.MONTH.BUILD (found '$new')."
  exit 1
fi

old=$(git show "$base:VERSION" 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$old" ]; then
  # Before VERSION existed, the build number lived in the footer of index.php.
  old_build=$(git show "$base:index.php" 2>/dev/null | grep -oE "aria-label=[\"']Build [0-9]+[\"']" | head -1 | grep -oE '[0-9]+' || true)
  old="0.0.${old_build:-0}"
fi

old_build="${old##*.}"
new_build="${new##*.}"
if [ "$new_build" -le "$old_build" ]; then
  echo "::error file=VERSION::Application files changed but the build number in VERSION did not increase (base $old, head $new)."
  echo "Changed application files:"; echo "$app_changed"
  exit 1
fi

echo "Version moved from $old to $new."
