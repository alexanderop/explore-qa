#!/usr/bin/env python3
"""Generate battle-timeline.html for an agent-battle run.

Usage: python3 .claude/skills/battle-playground/generate.py <charter> [--open]

If <charter> is omitted, picks the charter with the most recent battle run
(three matching reports, one per agent, from the same day).
"""
from __future__ import annotations
import json
import os
import re
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent.parent
SKILL_DIR = Path(__file__).resolve().parent
TEMPLATE = SKILL_DIR / "template.html"

AGENTS = ("claude", "codex", "copilot")
ACCENTS = {"claude": "#a78bfa", "codex": "#22d3ee", "copilot": "#f59e0b"}

# Words that score a "think" event as a key moment.
MOMENT_RE = re.compile(
    r"(found|issue|bug|unexpected|anomaly|incorrect|missing|error|confirm|reprodu|"
    r"notable|interesting|dropp|fail|broken|filter|closing quote|no[- ]?result\w*|"
    r"zero[- ]?result\w*|H1\b|auto[- ]?navigat\w*|suspicious)",
    re.I,
)

# Highlight regex used in the HTML template too, kept in sync deliberately.

# --- Charter discovery ----------------------------------------------------

def discover_charter() -> str:
    """Return the charter dir that has the most recent 3-agent run."""
    root = REPO / "qa-runs" / "charters"
    if not root.exists():
        sys.exit("error: qa-runs/charters/ not found")
    best_charter, best_ts = None, ""
    for charter_dir in root.iterdir():
        if not charter_dir.is_dir():
            continue
        groups = group_reports(charter_dir)
        if not groups:
            continue
        ts = groups[-1][0]
        if ts > best_ts:
            best_ts = ts
            best_charter = charter_dir.name
    if not best_charter:
        sys.exit("error: no agent-battle runs found under qa-runs/charters/")
    return best_charter


def group_reports(charter_dir: Path) -> list[tuple[str, dict[str, Path]]]:
    """Return [(timestamp, {agent: report_path}), ...] sorted chronologically.

    Only returns groups that include all three agents within the same date.
    """
    by_date: dict[str, dict[str, tuple[str, Path]]] = {}
    pat = re.compile(r"^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(\w+)_agent-browser\.md$")
    for p in charter_dir.iterdir():
        m = pat.match(p.name)
        if not m:
            continue
        date, time_, agent = m.group(1), m.group(2), m.group(3)
        if agent not in AGENTS:
            continue
        by_date.setdefault(date, {})[agent] = (time_, p)
    out: list[tuple[str, dict[str, Path]]] = []
    for date, agents in by_date.items():
        if not all(a in agents for a in AGENTS):
            continue
        # Anchor timestamp on claude's time (agents start within ~1s of each other).
        ts = f"{date}_{agents['claude'][0]}"
        out.append((ts, {a: agents[a][1] for a in AGENTS}))
    out.sort()
    return out


# --- Report parsing -------------------------------------------------------

def parse_frontmatter(md_path: Path) -> dict[str, str]:
    text = md_path.read_text()
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    fm: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip().strip('"')
    return fm


def parse_first_finding(md_path: Path) -> dict[str, str]:
    """Return {'sev': ..., 'title': ...} from the first finding summary row."""
    text = md_path.read_text()
    # Row form: | F-01 | Minor | Title | Scenario | screenshot |
    m = re.search(r"\|\s*F-0?1\s*\|\s*(\w+)\s*\|\s*([^|]+?)\s*\|", text)
    if m:
        return {"sev": m.group(1), "title": m.group(2).strip()}
    return {"sev": "None", "title": "no finding"}


# --- Log parsing ----------------------------------------------------------

def parse_ts(s: str | None) -> float | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def short(s: object, n: int = 120) -> str:
    return str(s or "").replace("\n", " ").strip()[:n]


def classify_cmd(cmd: str, nm: str = "") -> str:
    ls = (cmd or nm or "").lower()
    if "screenshot" in ls: return "shot"
    if "snapshot" in ls: return "snap"
    if "agent-browser open" in ls or "wait --url" in ls or "get url" in ls or "reload" in ls:
        return "nav"
    if "fill " in ls or " click " in ls or "click @" in ls or " press " in ls or "keyboard type" in ls:
        return "act"
    if " eval " in ls or 'eval "' in ls or "eval '" in ls:
        return "inspect"
    if "console" in ls or "errors" in ls or "network" in ls or "--help" in ls:
        return "inspect"
    return "tool"


def parse_claude(path: Path) -> list[dict]:
    events: list[dict] = []
    for line in path.read_text().splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        t = ev.get("type", "")
        if t == "assistant" and isinstance(ev.get("message"), dict):
            for item in ev["message"].get("content", []):
                if not isinstance(item, dict):
                    continue
                it = item.get("type")
                if it == "tool_use":
                    nm = item.get("name", "")
                    inp = item.get("input", {}) or {}
                    if not isinstance(inp, dict):
                        inp = {}
                    desc = inp.get("description", "") or ""
                    cmd = inp.get("command", "") or ""
                    if nm == "Bash":
                        kind = classify_cmd(cmd)
                        label = desc or short(cmd, 80)
                    elif nm == "TodoWrite":
                        kind = "todo"
                        todos = inp.get("todos", []) or []
                        done = sum(1 for td in todos if isinstance(td, dict) and td.get("status") == "completed")
                        label = f"todos {done}/{len(todos)}"
                    elif nm == "Write":
                        kind = "write"
                        label = "write " + os.path.basename(inp.get("file_path", ""))
                    elif nm == "Read":
                        kind = "read"
                        label = "read " + os.path.basename(inp.get("file_path", ""))
                    else:
                        kind, label = "tool", nm
                    events.append({"kind": kind, "label": short(label, 90), "detail": short(cmd, 240)})
                elif it == "text":
                    txt = (item.get("text") or "").strip()
                    if txt:
                        events.append({"kind": "think", "label": short(txt, 100), "detail": short(txt, 500)})
        elif t == "result":
            events.append({"kind": "done", "label": "run complete", "detail": f"duration_ms={ev.get('duration_ms')}"})
    return events


def parse_codex(path: Path) -> list[dict]:
    events: list[dict] = []
    for line in path.read_text().splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        t = ev.get("type", "")
        if t == "item.completed":
            it = ev.get("item", {}) or {}
            if not isinstance(it, dict):
                continue
            itype = it.get("type", "")
            if itype == "agent_message":
                txt = it.get("text", "")
                if txt:
                    events.append({"kind": "think", "label": short(txt, 100), "detail": short(txt, 500)})
            elif itype == "command_execution":
                cmd = it.get("command", "") or ""
                events.append({"kind": classify_cmd(cmd), "label": short(cmd, 90), "detail": short(cmd, 300)})
        elif t == "task.completed":
            events.append({"kind": "done", "label": "run complete", "detail": ""})
    return events


def parse_copilot(path: Path) -> tuple[list[dict], float | None]:
    events: list[dict] = []
    first: float | None = None
    for line in path.read_text().splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        t = ev.get("type", "")
        ts = parse_ts(ev.get("timestamp"))
        if ts and first is None:
            first = ts
        rel = (ts - first) if (ts is not None and first is not None) else None
        d = ev.get("data") or {}
        if not isinstance(d, dict):
            continue
        if t == "assistant.message":
            content = (d.get("content") or "").strip()
            if content:
                events.append({"t": rel, "kind": "think", "label": short(content, 100), "detail": short(content, 500)})
            trs = d.get("toolRequests") or []
            if not isinstance(trs, list):
                trs = []
            for tr in trs:
                if not isinstance(tr, dict):
                    continue
                nm = tr.get("name", "") or ""
                args = tr.get("arguments", {})
                if not isinstance(args, dict):
                    args = {}
                cmd = args.get("command") or args.get("cmd") or args.get("script") or args.get("query", "") or ""
                desc = args.get("description", "") or ""
                if nm == "sql":
                    kind = "todo"
                elif nm in ("view", "edit", "str_replace_editor"):
                    kind = "write"
                else:
                    kind = classify_cmd(cmd, nm)
                label = short(cmd, 90) if cmd else (desc or nm)
                events.append({"t": rel, "kind": kind, "label": short(label, 90), "detail": short(cmd or desc, 300)})
        elif t == "interaction.completed":
            events.append({"t": rel, "kind": "done", "label": "run complete", "detail": ""})
    return events, first


# --- Milestone + key-moment derivation ------------------------------------

def charter_keywords(charter_path: Path) -> list[tuple[str, str]]:
    """Extract (label, regex) pairs from a charter's scenarios section.

    A scenario usually looks like:  - **Scenario 2 — Submit laufschuhe**: ...
    or `### Scenario 2 — Submit laufschuhe`. We pull the number + title and
    extract the first non-stopword as the match keyword.
    """
    if not charter_path.exists():
        return []
    text = charter_path.read_text()
    out: list[tuple[str, str]] = []
    pat = re.compile(
        r"(?:^|\n)\s*(?:[-*]\s*|#+\s+)?\**\s*Scenario\s+(\d+)\s*[—-]\s*([^\n*|]+?)\s*\**\s*(?::|\n|$)",
        re.I,
    )
    stop = {"the", "a", "an", "and", "or", "for", "with", "via", "using", "from", "to",
            "on", "in", "of", "by", "is", "are", "submit", "enter", "check", "open",
            "verify", "validate", "test", "use", "case", "search", "query", "term"}
    for m in pat.finditer(text):
        num, title = m.group(1), m.group(2).strip().strip(".").strip()
        words = re.findall(r"[A-Za-zäöüßÄÖÜ][\wäöüßÄÖÜ%öäü-]{2,}", title)
        key = next((w for w in words if w.lower() not in stop), None)
        if not key:
            continue
        label = f"Scn {num} · {key.lower()}"
        # Regex: escape and try case-insensitive match, include common URL-encoded umlauts
        encoded = (
            key.replace("ü", "(?:ü|u%CC%88|%C3%BC|ue)")
               .replace("ö", "(?:ö|%C3%B6|oe)")
               .replace("ä", "(?:ä|%C3%A4|ae)")
        )
        out.append((label, re.escape(key) if encoded == key else encoded))
    # De-dup by label
    seen = set()
    uniq: list[tuple[str, str]] = []
    for l, p in out:
        if l in seen:
            continue
        seen.add(l)
        uniq.append((l, p))
    return uniq


def add_milestones(events: list[dict], keywords: list[tuple[str, str]]) -> list[dict]:
    seen: dict[str, float] = {}
    for e in events:
        if e.get("kind") == "think":
            continue
        blob = (str(e.get("label", "")) + " " + str(e.get("detail", ""))).lower()
        for label, pat in keywords:
            if label in seen:
                continue
            if re.search(pat, blob, re.I):
                seen[label] = e["t"]
    # report milestone
    for e in events:
        if e.get("kind") == "think":
            continue
        blob = (str(e.get("label", "")) + " " + str(e.get("detail", ""))).lower()
        if "Report" not in seen and re.search(r"(write.*\.md|report\.md|final.*report|close.*browser)", blob):
            seen["Report"] = e["t"]
            break
    return sorted([{"label": k, "t": v} for k, v in seen.items()], key=lambda m: m["t"])


def extract_key_moments(events: list[dict]) -> list[dict]:
    thinks = [e for e in events if e.get("kind") == "think"]
    scored: list[tuple[int, dict]] = []
    for e in thinks:
        text = str(e.get("label", "")) + " " + str(e.get("detail", ""))
        s = len(MOMENT_RE.findall(text))
        scored.append((s, e))
    scored.sort(key=lambda x: (-x[0], x[1]["t"]))
    out: list[dict] = []
    seen: set[str] = set()
    for s, e in scored:
        if s == 0:
            continue
        txt = e.get("detail") or e.get("label", "")
        key = str(txt)[:60]
        if key in seen:
            continue
        seen.add(key)
        out.append({"t": e["t"], "text": str(e.get("detail", "")) or str(e.get("label", ""))})
        if len(out) >= 5:
            break
    if not out:
        for e in thinks[:3]:
            out.append({"t": e["t"], "text": str(e.get("detail", "")) or str(e.get("label", ""))})
    out.sort(key=lambda m: m["t"])
    return out


# --- Time assignment ------------------------------------------------------

def spread(events: list[dict], duration: float) -> list[dict]:
    """Assign pseudo-timestamps linearly across [0, duration]. Preserves order."""
    n = max(1, len(events))
    for i, e in enumerate(events):
        e["t"] = round(i * duration / n, 2)
    return events


def scale_to_duration(events: list[dict], duration: float) -> list[dict]:
    """Events already have `t` from real timestamps; scale so last event ≈ duration."""
    max_t = max((e.get("t") or 0) for e in events) or duration
    n = len(events)
    for i, e in enumerate(events):
        if e.get("t") is None:
            e["t"] = round(i * duration / max(1, n), 2)
    if max_t > 0 and max_t < duration:
        scale = duration / max_t
        for e in events:
            e["t"] = round(e["t"] * scale, 2)
    else:
        for e in events:
            e["t"] = round(e["t"] or 0, 2)
    return events


# --- Screenshots ----------------------------------------------------------

def screenshots_for(charter_dir: Path, agent: str, ts: str) -> list[dict]:
    shots_dir = charter_dir / "_attachments" / f"{ts}_{agent}_agent-browser" / "screenshots"
    if not shots_dir.exists():
        return []
    rel_base = f"./_attachments/{ts}_{agent}_agent-browser/screenshots"
    return [
        {"name": p.name, "rel": f"{rel_base}/{p.name}"}
        for p in sorted(shots_dir.iterdir())
        if p.suffix.lower() == ".png"
    ]


# --- Main -----------------------------------------------------------------

def build_data(charter: str) -> dict:
    charter_dir = REPO / "qa-runs" / "charters" / charter
    if not charter_dir.exists():
        sys.exit(f"error: qa-runs/charters/{charter}/ not found")
    groups = group_reports(charter_dir)
    if not groups:
        sys.exit(f"error: no complete battle found for {charter} (need all 3 agents)")
    ts_group, reports = groups[-1]  # most recent

    charter_md = REPO / "charters" / f"{charter}.md"
    keywords = charter_keywords(charter_md)

    agents_out: dict[str, dict] = {}
    site = "unknown"
    date = ts_group.split("_")[0]
    for agent in AGENTS:
        report_path = reports[agent]
        fm = parse_frontmatter(report_path)
        finding = parse_first_finding(report_path)
        body = report_path.read_text()
        site_m = re.search(r"\*\*Site:\*\*\s*([^\s\n]+)", body)
        if site_m:
            site = site_m.group(1)
        duration = int(float(fm.get("duration_s", "0") or 0))
        model = fm.get("model", "") or ""
        # Exact timestamp per agent — each has its own dir
        m = re.match(r"^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_", report_path.name)
        if not m:
            sys.exit(f"error: could not parse timestamp from {report_path.name}")
        agent_ts = f"{m.group(1)}_{m.group(2)}"
        log_path = charter_dir / "_attachments" / f"{agent_ts}_{agent}_agent-browser" / "logs" / f"{agent}-session.jsonl"
        if not log_path.exists():
            sys.exit(f"error: log not found for {agent}: {log_path}")
        if agent == "claude":
            events = parse_claude(log_path)
            events = spread(events, duration or 1)
        elif agent == "codex":
            events = parse_codex(log_path)
            events = spread(events, duration or 1)
        else:
            events, _ = parse_copilot(log_path)
            events = scale_to_duration(events, duration or 1)
        # Milestones and key moments from charter keywords
        milestones = add_milestones(events, keywords)
        key_moments = extract_key_moments(events)
        shots = screenshots_for(charter_dir, agent, agent_ts)
        agents_out[agent] = {
            "duration": duration,
            "events": events,
            "finding": {"sev": finding["sev"], "title": finding["title"]},
            "screenshots": len(shots),
            "shots": shots,
            "milestones": milestones,
            "key_moments": key_moments,
            "model": model,
            "accent": ACCENTS[agent],
        }
    return {"charter": charter, "site": site, "date": date, "agents": agents_out}


def render(data: dict) -> str:
    tpl = TEMPLATE.read_text()
    title = f"{data['charter']} — agent battle timeline"
    html = (
        tpl.replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
           .replace("{{TITLE}}", title)
           .replace("{{CHARTER}}", data["charter"])
           .replace("{{DATE}}", data["date"])
           .replace("{{SITE}}", data["site"])
    )
    return html


def main(argv: list[str]) -> int:
    charter = None
    do_open = False
    for a in argv[1:]:
        if a == "--open":
            do_open = True
        elif a.startswith("-"):
            print(f"unknown flag: {a}", file=sys.stderr)
            return 2
        else:
            charter = a
    if not charter:
        charter = discover_charter()
        print(f"[battle-playground] charter not given — using most recent: {charter}")
    data = build_data(charter)
    out = REPO / "qa-runs" / "charters" / charter / "battle-timeline.html"
    out.write_text(render(data))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    if do_open:
        webbrowser.open(f"file://{out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
