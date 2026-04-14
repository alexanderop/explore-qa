# Brain

Two layers:

- `brain/_core/` — generic, site-agnostic QA principles. Shipped with explore-qa. Auto-inlined into every run.
- `brain/sites/<site>/` — per-site knowledge written by the `reflect` skill after runs. Auto-inlined only for the active site.

Site folders are gitignored by default so your team's knowledge stays local to your fork.
