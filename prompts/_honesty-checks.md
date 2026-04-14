## Absence burden of proof (against false-positive "feature missing")

Before you report anything as "missing" / "not present" / "no X filter", you
MUST document at least two independent checks. A single visual glance is NOT
enough — many UI components are accordions, sub-sheets, or lazy-loaded.

Mandatory checks before any "missing" finding:

1. Expand accordions/collapsibles one by one (even if the panel initially looks
   empty or shows a loader — wait for hydration and recheck).
2. Press any "show more" / "more filters" / "more" buttons, including sub-sheets
   that open as their own panel.
3. DOM counter-check via the eval subcommand of your browser CLI (see `{{browser}} --help`)
   — for example, query `document.querySelectorAll('[data-testid]')` or search for
   the term directly. If the term exists in the DOM it is NOT "missing" — at worst
   it is "hard to discover" (different finding, different severity).
4. Scroll to the end of the relevant drawer/container.

Phrase absence only as strictly as you actually verified it:
"Not reachable in the tested path after [steps]" rather than "does not exist".
If any check disproves the finding: drop it or reframe it.
