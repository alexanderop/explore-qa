---
name: absence-burden-of-proof
type: principle
links: [[principles/dom-over-visual]]
---

# Absence burden of proof

Before you report anything as "missing" / "not present" / "no X", you MUST
document **at least two independent checks**. A single visual glance is NOT
enough — many UI components are accordions, sub-sheets, or lazy-loaded.

## Mandatory checks before any "missing" finding

1. **Accordions / collapsibles** in the relevant drawer, expanded one by one —
   even if the panel initially looks empty or shows a loader. Wait for
   hydration, recheck.
2. **"Show more" buttons** — "show more filters", "show more", "next" — including
   sub-sheets that open as their own panel.
3. **DOM counter-check** via the eval subcommand of your browser CLI
   (see [[principles/dom-over-visual]]).
4. **Scroll** to the end of the drawer/container.

## Phrasing rule

Phrase absence only as strictly as you actually verified it:

- ✅ "Not reachable in the tested path after [concrete steps]."
- ❌ "Does not exist."

If any check disproves the finding: drop it or reframe it as
"hard to discover" with severity Minor.
