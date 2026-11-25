# Shared by check-version-bump.sh and scripts/bump-version.sh (source, don't run).
# Reads file names on stdin, prints those that ship to visitors. Docs,
# workflows, tests and vendored libs are exempt.
app_files() {
  grep -E '\.(php|js|css)$|^sw\.js$' | grep -vE '^(assets/vendor/|\.github/|tests/)' || true
}
