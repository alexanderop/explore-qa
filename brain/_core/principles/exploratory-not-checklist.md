---
name: exploratory-not-checklist
type: principle
links: [[principles/dom-over-visual]]
---

# Exploratory testing is not checklist execution

**Definition (Kaner & Bach):** "Exploratory testing is simultaneous learning,
test design, and test execution." Learning, test design, and execution run
**in parallel**, not sequentially.

## In a run

- Charter scenarios are a **starting point**, not a mandatory order.
- If something unusual catches your eye mid-step (layout break, slow request,
  odd behavior), follow the trail — even if it isn't in the script.
- Document the deviation. What you did not observe is not "ok" — it is "not tested".

## Anti-pattern

- Marching through scenarios 1, 2, 3 and marking each "pass" without stopping
  to ask what the system just told you about itself.
- Suppressing findings because they don't belong to a planned scenario.
