import type { ReplayData } from "./types.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodeBlob(data: ReplayData): string {
  // Escape closing script tag so the JSON can't prematurely end the <script> block.
  return JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
}

export function renderReplay(data: ReplayData): string {
  const title = `${data.meta.charter} — ${data.meta.agent} · replay`;
  const blob = encodeBlob(data);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="replay-data">${blob}</script>
<script>${JS}</script>
</body>
</html>
`;
}

const CSS = `
:root {
  --bg: #0b0f14;
  --panel: #111821;
  --border: #1f2a37;
  --fg: #e5e7eb;
  --muted: #94a3b8;
  --accent: #a78bfa;
  --critical: #ef4444;
  --major: #f59e0b;
  --minor: #3b82f6;
  --pass: #22c55e;
  --findings: #f59e0b;
  --error: #ef4444;
  --high: #22c55e;
  --medium: #f59e0b;
  --low: #94a3b8;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
#root { padding: 16px; max-width: 1400px; margin: 0 auto; }
header { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; }
h1 { font-size: 16px; margin: 0; font-weight: 600; }
.meta { color: var(--muted); font-size: 12px; display: flex; gap: 12px; flex-wrap: wrap; }
.meta b { color: var(--fg); font-weight: 500; }
.verdict { width: 100%; color: var(--fg); font-style: italic; padding-top: 4px; }
.status-pill { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.status-pass { background: rgba(34,197,94,.18); color: var(--pass); }
.status-findings { background: rgba(245,158,11,.18); color: var(--findings); }
.status-error { background: rgba(239,68,68,.18); color: var(--error); }

.timeline { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 12px 16px 22px 16px; position: relative; margin-bottom: 16px; }
.tl-axis { position: relative; height: 6px; background: #1e293b; border-radius: 3px; cursor: pointer; }
.tl-dots { position: relative; height: 20px; margin-top: 6px; }
.tl-milestones { position: relative; height: 18px; margin-bottom: 4px; }
.tl-flags { position: relative; height: 18px; margin-bottom: 4px; }
.tl-labels { position: relative; color: var(--muted); font-size: 11px; height: 14px; margin-top: 4px; }
.dot { position: absolute; width: 6px; height: 6px; border-radius: 50%; top: 50%; transform: translate(-50%, -50%); background: var(--accent); opacity: .7; cursor: pointer; }
.dot:hover { opacity: 1; transform: translate(-50%, -50%) scale(1.6); }
.dot.kind-think { background: #a78bfa; }
.dot.kind-shot { background: #22d3ee; width: 8px; height: 8px; }
.dot.kind-snap { background: #38bdf8; }
.dot.kind-nav { background: #10b981; }
.dot.kind-act { background: #f97316; }
.dot.kind-inspect { background: #eab308; }
.dot.kind-done { background: #22c55e; width: 8px; height: 8px; }
.dot.kind-tool, .dot.kind-write, .dot.kind-read, .dot.kind-todo { background: #64748b; }
.ms { position: absolute; top: 0; transform: translateX(-50%); color: #e2e8f0; font-size: 11px; white-space: nowrap; padding: 0 4px; background: rgba(0,0,0,.35); border-radius: 3px; cursor: pointer; }
.ms:before { content: "●"; margin-right: 4px; color: var(--accent); }
.flag { position: absolute; top: 0; transform: translateX(-50%); font-size: 12px; cursor: pointer; user-select: none; padding: 0 4px; border-radius: 3px; font-weight: 600; }
.flag[data-sev="Critical"] { color: var(--critical); }
.flag[data-sev="Major"] { color: var(--major); }
.flag[data-sev="Minor"] { color: var(--minor); }
.flag[data-sev="Unknown"] { color: var(--muted); }
.tl-labels span { position: absolute; transform: translateX(-50%); }
.playhead { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #f43f5e; pointer-events: none; }

.grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.panel h2 { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; margin: 0; border-bottom: 1px solid var(--border); font-weight: 600; display: flex; align-items: center; justify-content: space-between; }

.media-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); }
.media-tab { padding: 8px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); cursor: pointer; border-right: 1px solid var(--border); background: transparent; border-top: none; border-bottom: 2px solid transparent; }
.media-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.media-tab[disabled] { opacity: 0.35; cursor: not-allowed; }

.media { padding: 14px; }
.media img { max-width: 100%; border: 1px solid var(--border); border-radius: 4px; cursor: zoom-in; }
.media .empty { color: var(--muted); font-style: italic; }
.media pre { background: #0a0d12; border: 1px solid var(--border); border-radius: 4px; padding: 10px; font-size: 11px; line-height: 1.5; max-height: 420px; overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--fg); font-family: ui-monospace, "SF Mono", Menlo, monospace; margin: 0; }
.shot-caption { color: var(--muted); margin-top: 6px; font-size: 11px; }

.detail { padding: 12px 14px; max-height: 540px; overflow-y: auto; }
.detail .item { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.04); }
.detail .time { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 11px; }
.detail .kind { display: inline-block; min-width: 56px; color: var(--accent); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.detail .label { color: var(--fg); }
.detail .body { color: var(--muted); white-space: pre-wrap; font-size: 12px; margin-top: 4px; padding-left: 60px; display: none; }
.detail .body .result { margin-top: 4px; background: #0a0d12; border: 1px solid var(--border); border-radius: 3px; padding: 6px 8px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; max-height: 180px; overflow: auto; }
.detail .item.expanded .body { display: block; }
.detail .item { cursor: pointer; }
.detail .item.highlight { background: rgba(167,139,250,.08); border-radius: 4px; padding-left: 6px; padding-right: 6px; }

.console { margin-top: 16px; }
.console-summary { display: flex; gap: 14px; padding: 8px 14px; color: var(--muted); font-size: 12px; border-bottom: 1px solid var(--border); }
.console-summary b { color: var(--fg); font-weight: 500; }
.console-list { max-height: 320px; overflow-y: auto; }
.console-row { padding: 7px 14px; border-bottom: 1px solid rgba(255,255,255,.04); font-size: 12px; }
.console-row:last-child { border-bottom: none; }
.console-level { display: inline-block; min-width: 70px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.console-level[data-lvl="error"] { color: var(--critical); }
.console-level[data-lvl="warning"] { color: var(--major); }
.console-level[data-lvl="info"] { color: var(--minor); }
.console-level[data-lvl="log"] { color: var(--muted); }
.console-msg { color: var(--fg); }
.console-src { display: block; padding-left: 70px; color: var(--muted); font-size: 11px; font-family: ui-monospace, "SF Mono", Menlo, monospace; margin-top: 2px; }

.findings { margin-top: 16px; }
.finding-item { padding: 10px 14px; border-bottom: 1px solid var(--border); cursor: pointer; }
.finding-item:last-child { border-bottom: none; }
.finding-item:hover { background: rgba(255,255,255,.03); }
.finding-title { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.finding-id { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--muted); font-size: 11px; }
.finding-sev { font-size: 10px; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; font-weight: 600; letter-spacing: 0.5px; }
.finding-sev[data-sev="Critical"] { background: rgba(239,68,68,.2); color: var(--critical); }
.finding-sev[data-sev="Major"] { background: rgba(245,158,11,.2); color: var(--major); }
.finding-sev[data-sev="Minor"] { background: rgba(59,130,246,.2); color: var(--minor); }
.finding-sev[data-sev="Unknown"] { background: rgba(148,163,184,.2); color: var(--muted); }
.finding-conf { font-size: 10px; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; font-weight: 600; letter-spacing: 0.5px; margin-left: auto; }
.finding-conf[data-c="high"] { background: rgba(34,197,94,.18); color: var(--high); }
.finding-conf[data-c="medium"] { background: rgba(245,158,11,.18); color: var(--medium); }
.finding-conf[data-c="low"] { background: rgba(148,163,184,.18); color: var(--low); }
.finding-body { color: var(--muted); font-size: 12px; margin-top: 4px; display: none; }
.finding-item.open .finding-body { display: block; }
.finding-body ol { padding-left: 18px; margin: 4px 0; }
.finding-body .kv { margin: 2px 0; }
.finding-body .kv b { color: var(--fg); font-weight: 500; }
.verifs { margin-top: 6px; border-left: 2px solid rgba(167,139,250,.3); padding-left: 10px; }
.verifs .vrow { padding: 3px 0; }
.verifs .vt { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 11px; margin-right: 6px; }
.verifs .vk { color: var(--accent); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }
.verifs .vl { color: var(--fg); }
.verifs .vempty { color: var(--muted); font-style: italic; }

.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.92); display: none; align-items: center; justify-content: center; z-index: 100; cursor: zoom-out; padding: 20px; }
.lightbox.open { display: flex; }
.lightbox img { max-width: 98%; max-height: 98%; }

.empty-state { padding: 40px; text-align: center; color: var(--muted); font-style: italic; }
`;

const JS = `
"use strict";
const DATA = JSON.parse(document.getElementById("replay-data").textContent);
const root = document.getElementById("root");
const fmt = (n) => {
  const s = Math.max(0, Math.floor(n));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return m + ":" + ss;
};
const pct = (t, max) => (max > 0 ? (100 * t) / max : 0);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]));

const maxT = Math.max(DATA.meta.durationS || 1, ...DATA.events.map((e) => e.t || 0));
const tilde = DATA.meta.timingMode === "approximate" ? "≈" : "";

const state = { currentShot: null, mediaTab: "shot" };

function render() {
  const m = DATA.meta;
  const statusCls = "status-" + m.status;
  const consoleErrors = DATA.console.filter((c) => c.level === "error").length;
  const consoleWarnings = DATA.console.filter((c) => c.level === "warning").length;
  root.innerHTML = \`
    <header>
      <h1>\${esc(m.charter)}</h1>
      <span class="status-pill \${statusCls}">\${esc(m.status)}</span>
      <div class="meta">
        <span><b>Agent:</b> \${esc(m.agent)}</span>
        <span><b>Browser:</b> \${esc(m.browser)}</span>
        <span><b>Site:</b> \${esc(m.site)}</span>
        <span><b>Model:</b> \${esc(m.model)}</span>
        <span><b>Date:</b> \${esc(m.date)} \${esc(m.time)}</span>
        <span><b>Duration:</b> \${tilde}\${esc(m.durationHms)}</span>
        <span><b>Findings:</b> \${DATA.findings.length}</span>
        <span><b>Console:</b> \${consoleErrors}e / \${consoleWarnings}w</span>
        <span><b>Prompt:</b> <code>\${esc(m.promptHash)}</code></span>
      </div>
      \${m.verdict ? \`<div class="verdict">"\${esc(m.verdict)}"</div>\` : ""}
    </header>

    <div class="timeline">
      <div class="tl-milestones" id="ms-row"></div>
      <div class="tl-flags" id="fl-row"></div>
      <div class="tl-axis" id="axis">
        <div class="playhead" id="playhead" style="left:0"></div>
      </div>
      <div class="tl-dots" id="dots"></div>
      <div class="tl-labels" id="labels"></div>
    </div>

    <div class="grid">
      <div class="panel">
        <h2>Moment</h2>
        <div class="media-tabs" id="media-tabs">
          <button class="media-tab active" data-tab="shot">Screenshot</button>
          <button class="media-tab" data-tab="dom">DOM snapshot</button>
        </div>
        <div class="media" id="media"><div class="empty">Click a dot or flag on the timeline to see a moment.</div></div>
      </div>
      <div class="panel">
        <h2>Transcript</h2>
        <div class="detail" id="detail"></div>
      </div>
    </div>

    <div class="panel console">
      <h2>Console / network <span style="color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">\${DATA.console.length} entries</span></h2>
      <div id="console-body"></div>
    </div>

    <div class="panel findings">
      <h2>Findings (\${DATA.findings.length})</h2>
      <div id="findings-list"></div>
    </div>

    <div class="lightbox" id="lightbox"><img id="lightbox-img" alt=""></div>
  \`;

  renderMilestones();
  renderFlags();
  renderDots();
  renderLabels();
  renderDetail();
  renderFindings();
  renderConsole();

  document.getElementById("axis").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * maxT;
    setPlayhead(t);
  });
  document.getElementById("media-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".media-tab");
    if (!btn || btn.disabled) return;
    state.mediaTab = btn.dataset.tab;
    document.querySelectorAll(".media-tab").forEach((b) => b.classList.toggle("active", b === btn));
    renderMedia();
  });
  document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").classList.remove("open");
  });
}

function renderMilestones() {
  const row = document.getElementById("ms-row");
  row.innerHTML = DATA.milestones
    .map((m) => \`<div class="ms" style="left:\${pct(m.t, maxT)}%" data-t="\${m.t}" title="\${esc(m.label)}">\${esc(m.label)}</div>\`)
    .join("");
  row.querySelectorAll(".ms").forEach((el) => {
    el.addEventListener("click", () => setPlayhead(Number(el.dataset.t)));
  });
}

function renderFlags() {
  const row = document.getElementById("fl-row");
  row.innerHTML = DATA.findings
    .filter((f) => f.anchorT !== undefined && f.anchorT !== null)
    .map((f) => \`<div class="flag" data-sev="\${esc(f.severity)}" data-id="\${esc(f.id)}" data-t="\${f.anchorT}" title="\${esc(f.id)} — \${esc(f.title)}" style="left:\${pct(f.anchorT, maxT)}%">⚑ \${esc(f.id)}</div>\`)
    .join("");
  row.querySelectorAll(".flag").forEach((el) => {
    el.addEventListener("click", () => {
      setPlayhead(Number(el.dataset.t));
      openFinding(el.dataset.id);
    });
  });
}

function renderDots() {
  const row = document.getElementById("dots");
  row.innerHTML = DATA.events
    .map((e, i) => \`<div class="dot kind-\${esc(e.kind)}" data-idx="\${i}" data-t="\${e.t}" style="left:\${pct(e.t, maxT)}%" title="\${esc(e.kind)} · \${esc(e.label)}"></div>\`)
    .join("");
  row.querySelectorAll(".dot").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.idx);
      setPlayhead(DATA.events[idx].t, idx);
    });
  });
}

function renderLabels() {
  const row = document.getElementById("labels");
  const step = Math.max(1, Math.round(maxT / 6));
  let html = "";
  for (let t = 0; t <= maxT; t += step) {
    html += \`<span style="left:\${pct(t, maxT)}%">\${tilde}\${fmt(t)}</span>\`;
  }
  row.innerHTML = html;
}

function renderDetail(highlightIdx) {
  const el = document.getElementById("detail");
  if (DATA.events.length === 0) {
    el.innerHTML = '<div class="empty-state">No session events captured.</div>';
    return;
  }
  el.innerHTML = DATA.events
    .map((e, i) => {
      const bodyParts = [];
      if (e.detail) bodyParts.push(esc(e.detail));
      if (e.result) bodyParts.push('<div class="result">' + esc(e.result) + '</div>');
      const body = bodyParts.length ? \`<div class="body">\${bodyParts.join("")}</div>\` : "";
      return \`
        <div class="item \${i === highlightIdx ? "expanded highlight" : ""}" data-idx="\${i}" data-t="\${e.t}">
          <span class="time">\${tilde}\${fmt(e.t)}</span>
          <span class="kind">\${esc(e.kind)}</span>
          <span class="label">\${esc(e.label)}</span>
          \${body}
        </div>
      \`;
    })
    .join("");
  el.querySelectorAll(".item").forEach((item) => {
    item.addEventListener("click", () => {
      item.classList.toggle("expanded");
      const idx = Number(item.dataset.idx);
      setPlayhead(DATA.events[idx].t, idx);
    });
  });
  if (highlightIdx !== undefined) {
    const target = el.querySelector(\`.item[data-idx="\${highlightIdx}"]\`);
    if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function renderConsole() {
  const el = document.getElementById("console-body");
  if (!DATA.console || DATA.console.length === 0) {
    el.innerHTML = '<div class="empty-state">No console errors or warnings captured.</div>';
    return;
  }
  const counts = DATA.console.reduce((acc, c) => {
    acc[c.level] = (acc[c.level] || 0) + 1;
    return acc;
  }, {});
  const summary = ["error", "warning", "info", "log"]
    .filter((l) => counts[l])
    .map((l) => \`<span><b>\${l}:</b> \${counts[l]}</span>\`)
    .join("");
  el.innerHTML = \`
    <div class="console-summary">\${summary}</div>
    <div class="console-list">
      \${DATA.console
        .map(
          (c) => \`
        <div class="console-row">
          <span class="console-level" data-lvl="\${esc(c.level)}">\${esc(c.level)}</span>
          <span class="console-msg">\${esc(c.message)}</span>
          \${c.source ? \`<span class="console-src">\${esc(c.source)}</span>\` : ""}
        </div>\`,
        )
        .join("")}
    </div>
  \`;
}

function renderFindings() {
  const el = document.getElementById("findings-list");
  if (DATA.findings.length === 0) {
    el.innerHTML = '<div class="empty-state">No findings.</div>';
    return;
  }
  el.innerHTML = DATA.findings
    .map((f) => {
      const steps = (f.reproSteps || []).map((s) => \`<li>\${esc(s)}</li>\`).join("");
      const verifs = (f.verifications || [])
        .map(
          (v) => \`
          <div class="vrow">
            <span class="vt">\${tilde}\${fmt(v.t)}</span>
            <span class="vk">\${esc(v.kind)}</span>
            <span class="vl">\${esc(v.label)}</span>
          </div>\`,
        )
        .join("");
      const verifsBlock = f.anchorT === undefined || f.anchorT === null
        ? ""
        : verifs
          ? \`<div class="kv"><b>Post-finding verification (≤60s):</b></div><div class="verifs">\${verifs}</div>\`
          : \`<div class="kv"><b>Post-finding verification (≤60s):</b></div><div class="verifs"><div class="vempty">No inspect / snapshot / screenshot activity after the flag — low corroboration.</div></div>\`;
      const conf = f.confidence
        ? \`<span class="finding-conf" data-c="\${esc(f.confidence)}">\${esc(f.confidence)}</span>\`
        : "";
      return \`
        <div class="finding-item" data-id="\${esc(f.id)}" data-t="\${f.anchorT ?? ""}">
          <div class="finding-title">
            <span class="finding-id">\${esc(f.id)}</span>
            <span class="finding-sev" data-sev="\${esc(f.severity)}">\${esc(f.severity)}</span>
            <span>\${esc(f.title)}</span>
            \${conf}
          </div>
          <div class="finding-body">
            \${f.scenario ? \`<div class="kv"><b>Scenario:</b> \${esc(f.scenario)}</div>\` : ""}
            \${f.expected ? \`<div class="kv"><b>Expected:</b> \${esc(f.expected)}</div>\` : ""}
            \${f.actual ? \`<div class="kv"><b>Actual:</b> \${esc(f.actual)}</div>\` : ""}
            \${steps ? \`<div class="kv"><b>Repro steps:</b></div><ol>\${steps}</ol>\` : ""}
            \${f.consoleNetwork ? \`<div class="kv"><b>Console/network:</b> \${esc(f.consoleNetwork)}</div>\` : ""}
            \${f.suspectedCause ? \`<div class="kv"><b>Suspected cause:</b> \${esc(f.suspectedCause)}</div>\` : ""}
            \${verifsBlock}
          </div>
        </div>
      \`;
    })
    .join("");
  el.querySelectorAll(".finding-item").forEach((item) => {
    item.addEventListener("click", () => {
      item.classList.toggle("open");
      const t = item.dataset.t;
      if (t) setPlayhead(Number(t));
    });
  });
}

function openFinding(id) {
  const item = document.querySelector(\`.finding-item[data-id="\${id}"]\`);
  if (!item) return;
  item.classList.add("open");
  item.scrollIntoView({ block: "center", behavior: "smooth" });
}

function findScreenshotAt(t) {
  const shots = DATA.screenshots || [];
  if (shots.length === 0) return null;
  // Prefer a shot whose shotAt is set (i.e. matched to an event) and is closest to t.
  let best = null;
  let bestDelta = Infinity;
  for (const s of shots) {
    if (s.shotAt === undefined || s.shotAt === null) continue;
    const d = Math.abs(s.shotAt - t);
    if (d < bestDelta) {
      bestDelta = d;
      best = s;
    }
  }
  if (best) return best;
  // Fallback: position-based.
  const idx = Math.min(shots.length - 1, Math.max(0, Math.floor((t / maxT) * shots.length)));
  return shots[idx];
}

function renderMedia() {
  const media = document.getElementById("media");
  const shot = state.currentShot;
  const domBtn = document.querySelector('.media-tab[data-tab="dom"]');
  const hasDom = !!(shot && shot.precedingSnapshot);
  if (domBtn) domBtn.disabled = !hasDom;
  if (!shot) {
    media.innerHTML = '<div class="empty">Click a dot or flag on the timeline to see a moment.</div>';
    return;
  }
  if (state.mediaTab === "dom" && hasDom) {
    media.innerHTML = \`<pre>\${esc(shot.precedingSnapshot)}</pre><div class="shot-caption">DOM/a11y snapshot captured just before \${esc(shot.name)}</div>\`;
    return;
  }
  media.innerHTML = \`<img src="\${esc(shot.rel)}" alt="\${esc(shot.name)}" id="shot-img"><div class="shot-caption">\${esc(shot.name)}\${hasDom ? "" : " · no DOM snapshot available"}</div>\`;
  const img = document.getElementById("shot-img");
  if (img) {
    img.addEventListener("click", () => {
      document.getElementById("lightbox-img").src = img.src;
      document.getElementById("lightbox").classList.add("open");
    });
  }
}

function setPlayhead(t, highlightIdx) {
  const clamped = Math.max(0, Math.min(maxT, t));
  document.getElementById("playhead").style.left = pct(clamped, maxT) + "%";
  state.currentShot = findScreenshotAt(clamped);
  renderMedia();
  if (highlightIdx === undefined) {
    let nearest = 0;
    let minD = Infinity;
    DATA.events.forEach((e, i) => {
      const d = Math.abs((e.t || 0) - clamped);
      if (d < minD) {
        minD = d;
        nearest = i;
      }
    });
    highlightIdx = nearest;
  }
  renderDetail(highlightIdx);
}

render();
`;
