# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues at `galonga/burnigator`. Use the `gh` CLI.

## Conventions

- Create: `gh issue create --repo galonga/burnigator --title "..." --body "..."`
- Read: `gh issue view <number> --repo galonga/burnigator`
- List: `gh issue list --repo galonga/burnigator --state open`
- Comment: `gh issue comment <number> --repo galonga/burnigator --body "..."`
- Apply or remove labels with `gh issue edit <number> --repo galonga/burnigator --add-label "..."` or `--remove-label "..."`.
- Close an issue only after posting the resolution context.

## Pull requests as a triage surface

**No.** Pull requests are not treated as feature requests; triage skills should process GitHub Issues only.
