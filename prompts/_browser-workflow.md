## Browser tool

You interact with the web using the `{{browser}}` CLI (and only that tool).

## Preparation (MANDATORY before the first step)

Run `{{browser}} --help` **first** to learn the available commands and flags.
If a subcommand is unclear: `{{browser}} <command> --help`.
Do not rely on remembered syntax — always check the live CLI. Different
browser CLIs have different subcommands and flag names; do not guess them.

## Setup

Unless the charter specifies otherwise, run all scenarios in a **mobile viewport
(iPhone 15 Pro)**. If your browser tool does not already preconfigure that via
environment variables (check `--help`), set the viewport explicitly at the start
of the session.

## Per-step workflow

1. Capture the current page/DOM state (snapshot, accessibility tree, whatever
   your tool offers).
2. Interact using the element identifier the CLI hands you (click, type) rather
   than guessing CSS selectors.
3. **Screenshots only on findings and key states**, NOT after every step.
   Token/time budget. Key states: initial load after the consent banner, main
   result views, a filter applied, a sort changed. Every finding MUST have a
   screenshot. Filename: `<scenario>_<step>_<desc>.png` (e.g. `02_03_filter-applied.png`).
   **Pass an absolute path** to the screenshot subcommand:
   `{{screenshotDir}}/<scenario>_<step>_<desc>.png`. Never pass a bare
   `screenshots/…` or any other relative path — the screenshot tool resolves
   relative paths against the current working directory of the shell, not
   against the run directory, and your file will land outside the run folder
   and be invisible to the report. After taking the screenshot, verify the
   file exists at that exact absolute path before referencing it in the
   report; if it is missing, re-take it, do not fabricate the reference.
   In the report body itself, use the relative form
   `./screenshots/<file>.png` — the report lives next to the `screenshots/`
   directory, so the relative form renders correctly only there.
4. Capture console messages, errors, and failing network requests (4xx/5xx) —
   find the matching subcommand via `--help`. Persist only the **relevant**
   excerpts to `{{logDir}}`, not full dumps.
5. Note the observation (expected vs. actual) — a short scratch note for the report.

At the end: close the browser cleanly (see `--help`).
