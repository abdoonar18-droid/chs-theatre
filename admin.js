// ─── CHS Theatre — manager dashboard ─────────────────────────────────
(function () {
  const API = window.CHS_API, CFG = window.CHS_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = iso(new Date());
  const fmt12 = (hm) => { const [h, m] = hm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
  const dateLong = (s) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parse(s));
  const EQUIP = { wiredMic: "Wired mic", wirelessMic: "Wireless mic", laptop: "Laptop", lighting: "Lighting system", podium: "Podium", dataShow: "Data show", torch: "Torch", liveView: "Live view", smoke: "Smoke machine", tables: "Tables", chairs: "Chairs", backstage: "Backstage", dressing: "Dressing rooms", laser: "Laser pointer", mouse: "Wireless mouse" };
  const COUNTED = ["wiredMic", "wirelessMic", "tables", "chairs"];
  const equipText = (eq) => Object.keys(EQUIP).filter((k) => eq && eq[k]).map((k) => EQUIP[k] + (COUNTED.includes(k) ? ` ×${eq[k]}` : "")).join(" · ");
  const when = (date, _p, start, end) => (start && end ? `${fmt12(start)} – ${fmt12(end)}` : "");
  const label = { pending: "Pending", approved: "Approved", rejected: "Declined", cancelled: "Cancelled" };

  let tt;
  function toast(msg, bad) {
    const el = $("#toast"); el.className = "toast" + (bad ? " bad" : "");
    el.innerHTML = icon(bad ? "alert" : "check") + `<span>${esc(msg)}</span>`;
    requestAnimationFrame(() => el.classList.add("on")); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 3800);
  }

  function details(r) {
    const row = (k, v) => (v ? `<div class="rv"><dt>${k}</dt><dd>${v}</dd></div>` : "");
    return `<dl style="margin:0">
      ${row("Event", esc(r.title) + (r.desc ? `<div class="hint" style="margin-top:3px">${esc(r.desc)}</div>` : ""))}
      ${row("When", `${dateLong(r.date)}<div class="hint" style="margin-top:3px">${when(r.date, r.periods, r.start, r.end)}</div>`)}
      ${r.rehDate ? row("Rehearsal", `${dateLong(r.rehDate)}<div class="hint" style="margin-top:3px">${when(r.rehDate, r.rehPeriods, r.rehStart, r.rehEnd)}</div>`) : ""}
      ${row("Teacher", `${esc(r.name)}<div class="hint" style="margin-top:3px"><a href="mailto:${esc(r.email)}" style="color:var(--gold)">${esc(r.email)}</a></div>`)}
      ${row("Department", esc(r.dept))}
      ${row("HOD", esc(r.hod))}
      ${row("Audience", `${r.audience} — ${esc((r.audTypes || []).join(", "))}${r.audNote ? `<div class="hint" style="margin-top:3px">${esc(r.audNote)}</div>` : ""}`)}
      ${row("Facilities", esc(equipText(r.equipment)) || "—")}
      ${row("Other needs", esc(r.other))}
      ${row("Status", `<span class="tag ${r.status}">${label[r.status] || r.status}</span>${r.reason ? `<div class="hint" style="margin-top:6px">${esc(r.reason)}</div>` : ""}`)}
    </dl>`;
  }

  // ── decide via email link ──
  const qs = new URLSearchParams(location.search);
  if (qs.get("id") && qs.get("t")) return decideView(qs.get("id"), qs.get("t"), qs.get("d"));
  const pin = store.get("chs-admin-pin");
  if (pin) dashboard(pin); else gate();

  async function decideView(id, token, want) {
    app.innerHTML = `<div class="decide-wrap"><div class="card decide"><div class="skeleton" style="height:30px;width:50%"></div><div style="height:14px"></div>${'<div class="skeleton" style="height:40px;margin-bottom:8px"></div>'.repeat(6)}</div></div>`;
    let res;
    try { res = await API.call("get", { id, token }); } catch { return toast("Couldn’t reach the server.", true); }
    if (!res.ok) { app.innerHTML = `<div class="decide-wrap"><div class="card decide empty">${icon("lock")}<div>This link is no longer valid.</div></div></div>`; return; }
    const r = res.item;
    const render = (done) => {
      app.innerHTML = `<div class="decide-wrap"><div class="card decide">
        <div style="display:flex;align-items:center;gap:12px"><img src="logo-dark.png" style="width:38px" alt=""><div><small style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)">Request ${esc(r.id)}</small><h1>${esc(r.title)}</h1></div></div>
        ${done ? `<div class="big-state"><div class="ring" style="background:${r.status === "approved" ? "rgba(87,196,138,.15);color:var(--ok)" : "rgba(224,71,78,.15);color:#ff8a8f"}">${icon(r.status === "approved" ? "check" : "x")}</div>
          <b style="font-family:var(--f-display);font-size:24px;font-weight:500">${r.status === "approved" ? "Approved — calendar invite sent" : r.status === "cancelled" ? "Booking cancelled" : "Declined"}</b>
          <p class="hint">${esc(r.name)} has been emailed.</p></div>` : ""}
        <div class="review" style="margin-top:16px">${details(r)}</div>
        ${!done && (r.status === "pending" || r.status === "approved") ? `
          <div class="field" style="margin-top:16px"><label for="reason">Note to the teacher <span class="opt">(optional)</span></label><textarea class="input" id="reason" placeholder="${r.status === "pending" ? "e.g. Please email me the slides by Tuesday" : "Reason for cancelling"}"></textarea></div>
          <div class="acts">
            ${r.status === "pending" ? `<button class="btn ok grow" data-d="approve" style="flex:1">${icon("check")}<span>Approve</span></button><button class="btn primary" data-d="reject" style="flex:1">${icon("x")}<span>Decline</span></button>` : `<button class="btn primary" data-d="cancel" style="flex:1">${icon("x")}<span>Cancel booking</span></button>`}
          </div>` : ""}
        <div style="text-align:center;margin-top:18px"><a href="print.html?id=${encodeURIComponent(r.id)}&t=${encodeURIComponent(token)}" target="_blank" rel="noopener" class="hint" style="color:var(--gold)">Print / PDF</a> · <a href="admin.html" class="hint" style="color:var(--muted)">Open full dashboard →</a></div>
      </div></div>`;
      $$("[data-d]").forEach((b) => b.addEventListener("click", () => act(b, b.dataset.d)));
      if (want && !done) { const b = $(`[data-d="${want}"]`); if (b) { b.style.outline = "2px solid var(--gold)"; b.style.outlineOffset = "3px"; } }
    };
    async function act(btn, d) {
      $$("[data-d]").forEach((b) => (b.disabled = true)); btn.insertAdjacentHTML("afterbegin", '<span class="spinner"></span>');
      try {
        const out = await API.call("decide", { id, token, decision: d, reason: ($("#reason") || {}).value || "" });
        if (!out.ok) { toast(out.message || "Couldn’t update this request.", true); $$("[data-d]").forEach((b) => (b.disabled = false)); btn.querySelector(".spinner")?.remove(); return; }
        Object.assign(r, out.item); render(true);
      } catch { toast("Couldn’t reach the server.", true); $$("[data-d]").forEach((b) => (b.disabled = false)); btn.querySelector(".spinner")?.remove(); }
    }
    render(r.status === "rejected" || r.status === "cancelled");
  }

  // ── PIN gate ──
  function gate() {
    app.innerHTML = `<div class="gate"><div class="card">
      <img src="logo-dark.png" alt="">
      <h1>Theatre manager</h1><p>Enter your 6-digit PIN</p>
      <div class="pin">${'<input inputmode="numeric" maxlength="1" autocomplete="one-time-code" />'.repeat(6)}</div>
      <button class="btn primary block" id="go">${icon("lock")}<span>Unlock</span></button>
      ${API.DEMO ? '<p class="hint" style="margin-top:14px">Demo PIN: 1234 (then press Unlock)</p>' : ""}
    </div></div>`;
    const ins = $$(".pin input");
    ins.forEach((i, k) => {
      i.addEventListener("input", () => { i.value = i.value.replace(/\D/g, "").slice(-1); if (i.value && ins[k + 1]) ins[k + 1].focus(); if (ins.every((x) => x.value)) go(); });
      i.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !i.value && ins[k - 1]) ins[k - 1].focus(); if (e.key === "Enter") go(); });
      i.addEventListener("paste", (e) => { const v = (e.clipboardData.getData("text") || "").replace(/\D/g, ""); if (v) { e.preventDefault(); v.split("").slice(0, 6).forEach((c, j) => (ins[j].value = c)); go(); } });
    });
    ins[0].focus();
    $("#go").addEventListener("click", go);
    async function go() {
      const p = ins.map((i) => i.value).join("");
      if (p.length < 4) return;
      const res = await API.call("list", { pin: p }).catch(() => null);
      if (!res || !res.ok) { toast("Wrong PIN", true); ins.forEach((i) => (i.value = "")); ins[0].focus(); return; }
      store.set("chs-admin-pin", p); dashboard(p, res.items);
    }
  }

  // ── dashboard ──
  let items = [], tab = "pending", q = "";
  async function dashboard(p, preload) {
    app.innerHTML = `
      <header class="top"><div class="wrap">
        <a class="brand" href="index.html"><img src="logo-dark.png" alt=""><div><b>CHS Theatre</b><small>Manager</small></div></a>
        <div class="spacer"></div>
        <button class="pill-btn" id="rf">${icon("refresh")}<span>Refresh</span></button>
        <button class="icon-btn" id="lo" aria-label="Sign out">${icon("logout")}</button>
      </div></header>
      <main class="wrap" style="padding:18px 0 60px">
        <div class="sec-head"><div><h2>Requests</h2><p>Approve with one tap — the teacher and your calendar are updated automatically.</p></div></div>
        <div class="stats" id="stats"></div>
        <div class="toolbar"><div class="tabs" id="tabs"></div><input class="input" id="q" placeholder="Search teacher, event, dept…" /></div>
        <div id="list">${'<div class="card skeleton" style="height:84px;margin-bottom:12px"></div>'.repeat(3)}</div>
      </main>`;
    $("#lo").addEventListener("click", () => { store.set("chs-admin-pin", null); gate(); });
    $("#rf").addEventListener("click", () => load(p));
    $("#q").addEventListener("input", (e) => { q = e.target.value.toLowerCase(); renderList(p); });
    if (preload) { items = preload; renderAll(p); } else load(p);
  }
  async function load(p) {
    try {
      const res = await API.call("list", { pin: p });
      if (!res.ok) { store.set("chs-admin-pin", null); return gate(); }
      items = res.items; renderAll(p);
    } catch { toast("Couldn’t reach the server.", true); }
  }
  function groups() {
    const pending = items.filter((r) => r.status === "pending").sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = items.filter((r) => r.status === "approved" && r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = items.filter((r) => !pending.includes(r) && !upcoming.includes(r)).sort((a, b) => b.date.localeCompare(a.date));
    return { pending, upcoming, past };
  }
  function renderAll(p) {
    const g = groups();
    const month = today.slice(0, 7);
    const thisMonth = items.filter((r) => r.status === "approved" && r.date.startsWith(month)).length;
    const byDept = {};
    items.filter((r) => r.status === "approved").forEach((r) => (byDept[r.dept] = (byDept[r.dept] || 0) + 1));
    const top = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
    const next = g.upcoming[0];
    $("#stats").innerHTML = `
      <div class="card stat hot"><small>Waiting for you</small><b>${g.pending.length}</b><em>pending requests</em></div>
      <div class="card stat next"><small>Next on stage</small><b style="margin-top:10px">${next ? esc(next.title) : "—"}</b><em>${next ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(parse(next.date)) : "Nothing booked"}</em></div>
      <div class="card stat"><small>This month</small><b>${thisMonth}</b><em>approved bookings</em></div>
      <div class="card stat"><small>Top departments</small>${top.length ? top.slice(0, 3).map(([d, n]) => `<div class="bar-row"><span>${esc(d)}</span><i style="width:${(n / top[0][1]) * 100}%"></i><span>${n}</span></div>`).join("") : '<em style="display:block;margin-top:12px">No data yet</em>'}</div>`;
    $("#tabs").innerHTML = [["pending", "Pending", g.pending.length], ["upcoming", "Upcoming", g.upcoming.length], ["past", "Past & other", g.past.length]]
      .map(([k, l, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${l}<span class="cnt">${n}</span></button>`).join("");
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderAll(p); }));
    renderList(p);
  }
  function renderList(p) {
    let list = groups()[tab];
    if (q) list = list.filter((r) => [r.id, r.title, r.name, r.dept, r.email].join(" ").toLowerCase().includes(q));
    const host = $("#list");
    if (!list.length) { host.innerHTML = `<div class="card empty">${icon(tab === "pending" ? "check" : "calendar")}<div>${tab === "pending" ? "All caught up — no pending requests." : "Nothing here yet."}</div></div>`; return; }
    host.innerHTML = list.map((r) => {
      const d = parse(r.date);
      return `<div class="card req" data-id="${esc(r.id)}">
        <button class="req-h">
          <div class="req-date"><small>${new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d)}</small><b>${d.getDate()}</b></div>
          <div class="req-t"><b>${esc(r.title)}</b><small>${esc(r.dept)} · ${esc(r.name)} · ${when(r.date, r.periods, r.start, r.end)}</small></div>
          <span class="tag ${r.status}">${label[r.status]}</span>
        </button>
        <div class="req-b"><div><div class="req-in">
          ${details(r)}
          <div class="acts"><a class="btn ghost" style="text-decoration:none" href="print.html?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">${icon("printer")}<span>Print / PDF</span></a></div>
          ${r.status === "pending" || r.status === "approved" ? `
            <div class="field" style="margin:14px 0 0"><input class="input reason" placeholder="Note to the teacher (optional)" /></div>
            <div class="acts">${r.status === "pending" ? `<button class="btn ok" data-d="approve" style="flex:1">${icon("check")}<span>Approve</span></button><button class="btn primary" data-d="reject" style="flex:1">${icon("x")}<span>Decline</span></button>` : `<button class="btn ghost" data-d="cancel">${icon("x")}<span>Cancel booking</span></button>`}</div>` : ""}
        </div></div></div>
      </div>`;
    }).join("");
    $$(".req", host).forEach((card) => {
      $(".req-h", card).addEventListener("click", () => card.classList.toggle("open"));
      $$("[data-d]", card).forEach((b) => b.addEventListener("click", async () => {
        const d = b.dataset.d;
        if (d === "cancel" && !confirm("Cancel this booking? The teacher will be emailed and the calendar event removed.")) return;
        $$("[data-d]", card).forEach((x) => (x.disabled = true)); b.insertAdjacentHTML("afterbegin", '<span class="spinner"></span>');
        try {
          const out = await API.call("decide", { id: card.dataset.id, pin: p, decision: d, reason: $(".reason", card).value });
          if (!out.ok) throw new Error(out.message || "Failed");
          const i = items.findIndex((x) => x.id === card.dataset.id); items[i] = out.item;
          toast(d === "approve" ? "Approved — invite sent to calendar" : d === "reject" ? "Declined — teacher notified" : "Booking cancelled");
          card.style.transition = "opacity .4s, transform .4s"; card.style.opacity = "0"; card.style.transform = "translateX(30px)";
          setTimeout(() => renderAll(p), 380);
        } catch (e) { toast(e.message || "Couldn’t update.", true); $$("[data-d]", card).forEach((x) => (x.disabled = false)); b.querySelector(".spinner")?.remove(); }
      }));
    });
  }
})();
