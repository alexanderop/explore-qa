---
name: dom-over-visual
type: principle
links: [[principles/absence-burden-of-proof]]
---

# DOM counter-check beats visual inspection

Modern web UIs render many components lazily: accordion panels are initially
empty, sub-sheets hydrate only when opened, filters load via JS. **What looks
visually missing often exists in the DOM** — and vice versa, what looks visually
present can be a server-render artifact without real function.

## Standard eval

```
{{browser}} eval "Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.getAttribute('data-testid')).filter((v,i,a)=>a.indexOf(v)===i)"
```

(The eval subcommand name varies across browser CLIs — see `{{browser}} --help`.)

## When mandatory

- Before any "missing" finding (see [[principles/absence-burden-of-proof]]).
- When an element is visually present but not clickable.
- When a list looks "empty" but the component had a loader spinner.

## What goes in the report

Quote the eval command **and** its result in the report — not just "not found
in the DOM". That makes false-positives auditable after the fact.
