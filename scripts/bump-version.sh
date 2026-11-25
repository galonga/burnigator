#!/usr/bin/env bash
# Increments the build number in VERSION (CalVer YEAR.MONTH.BUILD) when
# application files changed relative to the base branch. Idempotent: does
# nothing if VERSION is already ahead of the base, or no app files changed.
#
# Usage: scripts/bump-version.sh [--staged] [base-ref]
#   base-ref  defaults to origin/main (falls back to main)
#   --staged  look at the index instead of the working tree (pre-commit hook);
#             also `git add VERSION` after bumping.
# Env: BUMP_DATE=YYYY-MM overrides the current month (for tests).
# Uses the same file matching as .github/scripts/check-version-bump.sh.
set -euo pipefail

staged=0
base=""
for a in "$@"; do
  case "$a" in
    --staged) staged=1 ;;
    *) base="$a" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
# shellcheck source=../.github/scripts/lib-app-files.sh
. .github/scripts/lib-app-files.sh

if [ -z "$base" ]; then
  for c in origin/main main; do
    if git rev-parse --verify -q "$c^{commit}" >/dev/null; then base=$c; break; fi
  done
fi
[ -n "$base" ] || { echo "bump-version: no base ref found; pass one explicitly." >&2; exit 1; }
mb=$(git merge-base "$base" HEAD) || { echo "bump-version: no merge base with $base." >&2; exit 1; }

if [ "$staged" = 1 ]; then
  changed=$(git diff --cached --name-only "$mb")
else
  changed=$(printf '%s\n%s\n' "$(git diff --name-only "$mb")" "$(git ls-files --others --exclude-standard)")
fi
if [ -z "$(printf '%s\n' "$changed" | app_files)" ]; then
  echo "bump-version: no application files changed; nothing to do."
  exit 0
fi

pattern='^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]+$'
old=$(git show "$mb:VERSION" 2>/dev/null | tr -d '[:space:]' || true)
if [ -z "$old" ]; then
  ob=$(git show "$mb:index.php" 2>/dev/null | grep -oE "aria-label=[\"']Build [0-9]+[\"']" | head -1 | grep -oE '[0-9]+' || true)
  old="0.0.${ob:-0}"
fi
cur=$(tr -d '[:space:]' < VERSION 2>/dev/null || true)
if [ -n "$cur" ] && ! printf '%s' "$cur" | grep -Eq "$pattern"; then
  echo "bump-version: VERSION ('$cur') is not YEAR.MONTH.BUILD." >&2
  exit 1
fi

old_build=$((10#${old##*.}))
if [ -n "$cur" ] && [ $((10#${cur##*.})) -gt "$old_build" ]; then
  echo "bump-version: VERSION already bumped ($old -> $cur); nothing to do."
  exit 0
fi

ym=${BUMP_DATE:-$(date +%Y-%m)}
new="${ym%-*}.${ym#*-}.$((old_build + 1))"
printf '%s\n' "$new" > VERSION
if [ "$staged" = 1 ]; then git add VERSION; fi
echo "bump-version: $old -> $new"
