#!/usr/bin/env bash
# Scenario tests for scripts/bump-version.sh in a throwaway repo.
set -euo pipefail
src=$(cd "$(dirname "$0")/.." && pwd)
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
cd "$t"
git init -q -b main .
git config user.email t@t
git config user.name t
mkdir -p scripts/hooks .github/scripts assets/vendor tests
cp "$src/scripts/bump-version.sh" scripts/
cp "$src/scripts/hooks/pre-commit" scripts/hooks/
cp "$src/.github/scripts/"*.sh .github/scripts/
echo 2026.11.1389 > VERSION
echo x > app.php
echo d > README.md
git add -A
git commit -qm base
fail=0
check() {
  if [ "$(cat VERSION)" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1: $(cat VERSION) != $2"; fail=1; fi
}
git checkout -qb feat

scripts/bump-version.sh main >/dev/null
check "no changes" 2026.11.1389

echo d2 >> README.md
echo t > tests/a.js
echo v > assets/vendor/l.js
scripts/bump-version.sh main >/dev/null
check "exempt files only" 2026.11.1389

echo y >> app.php
BUMP_DATE=2026-11 scripts/bump-version.sh main >/dev/null
check "bump" 2026.11.1390
BUMP_DATE=2026-11 scripts/bump-version.sh main >/dev/null
check "idempotent" 2026.11.1390

git checkout -q VERSION
BUMP_DATE=2027-01 scripts/bump-version.sh main >/dev/null
check "year/month rollover" 2027.01.1390
git checkout -q VERSION

git add -A
git commit -qm c
git checkout -q VERSION
BUMP_DATE=2026-11 scripts/bump-version.sh main >/dev/null
check "bump after commit" 2026.11.1390
git checkout -q VERSION

"$src/scripts/install-hooks.sh" >/dev/null
echo z >> app.php
git add app.php
BUMP_DATE=2026-12 git commit -qm hook
check "pre-commit hook" 2026.12.1390
if git show --stat --format= HEAD | grep -q VERSION; then echo "ok   VERSION in commit"; else echo "FAIL VERSION not in commit"; fail=1; fi
exit $fail
