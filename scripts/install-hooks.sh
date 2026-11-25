#!/usr/bin/env bash
# Optional: enables the repo hooks in scripts/hooks so VERSION is bumped on commit.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath scripts/hooks
echo "Hooks enabled (core.hooksPath = scripts/hooks). Undo: git config --unset core.hooksPath"
