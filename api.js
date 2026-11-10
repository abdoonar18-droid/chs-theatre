// ─── API layer: Google Apps Script backend, or a local demo mock ─────
(function () {
  const CFG = window.CHS_CONFIG;
  const DEMO = !CFG.API_URL;

  async function call(action, payload = {}) {
    if (DEMO) return mock(action, payload);
    const res = await fetch(CFG.API_URL, {
      method: "POST",
      // text/plain keeps it a "simple" request (no CORS preflight to Apps Script)
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error("Network error " + res.status);
    return res.json();
  }

  // ── shared slot helpers (same logic lives in Code.gs) ──
  const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const overlaps = (s1, e1, s2, e2) => toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
  function slotsOf(r) {
    const s = [{ kind: "event", date: r.date, start: r.start, end: r.end }];
    if (r.rehDate) s.push({ kind: "rehearsal", date: r.rehDate, start: r.rehStart, end: r.rehEnd });
    return s;
  }
  window.CHS_SLOTS = { toMin, toHM, overlaps, slotsOf };

  // ── demo mock (localStorage) ──
  const KEY = "chs-theatre-demo-db-v2";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); } };
  const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  function seed() {
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const base = { email: "teacher@" + CFG.SCHOOL_DOMAIN, hod: "—", audience: 90, audTypes: ["Students"], equipment: {}, other: "", token: "demo" };
    const db = { seq: 41, rows: [
      { ...base, id: "T-0038", status: "approved", name: "Shireen Bakri", dept: "MYP", title: "Grade 6 parents orientation", date: d(4), start: "13:00", end: "14:00", created: Date.now() },
      { ...base, id: "T-0039", status: "approved", name: "Rami Haddad", dept: "DP", title: "TOK exhibition", date: d(6), start: "08:30", end: "11:00", created: Date.now() },
      { ...base, id: "T-0040", status: "pending", name: "Lina Saleh", dept: "Arabic", title: "Poetry competition", date: d(6), start: "12:30", end: "14:00", created: Date.now() },
      { ...base, id: "T-0041", status: "approved", name: "Omar", dept: "Music", title: "Winter concert", date: d(11), start: "17:00", end: "19:30", rehDate: d(10), rehStart: "13:00", rehEnd: "15:00", created: Date.now() },
    ] };
    save(db); return db;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function mock(action, p) {
    await wait(action === "submit" ? 900 : 250);
    const db = load();
    const live = db.rows.filter((r) => r.status === "approved" || r.status === "pending");
    if (action === "config") return { dayStart: CFG.DAY_START, dayEnd: CFG.DAY_END, demo: true };
    if (action === "availability") {
      const out = [];
      live.forEach((r) => slotsOf(r).forEach((s) => out.push({ ...s, id: r.id, status: r.status, dept: r.dept })));
      return { slots: out };
    }
    if (action === "submit") {
      const r = p.data;
      const conflicts = [];
      slotsOf(r).forEach((mine) => live.forEach((o) => slotsOf(o).forEach((s) => {
        if (s.date === mine.date && overlaps(mine.start, mine.end, s.start, s.end)) conflicts.push({ kind: mine.kind, date: s.date, id: o.id });
      })));
      if (conflicts.length) return { ok: false, error: "conflict", conflicts };
      db.seq++; const id = "T-" + String(db.seq).padStart(4, "0");
      const et = Math.random().toString(36).slice(2);
      db.rows.push({ ...r, id, status: "pending", created: Date.now(), token: Math.random().toString(36).slice(2), editToken: et });
      save(db); return { ok: true, id, et };
    }
    const mineOf = (q) => db.rows.find((x) => x.id === q.id && x.editToken && x.editToken === q.et);
    const pub = ({ token, editToken, ...r }) => r;
    if (action === "mine") return { items: (p.items || []).map(mineOf).filter(Boolean).map(pub) };
    if (action === "getMine") { const r = mineOf(p); return r ? { ok: true, item: pub(r) } : { ok: false, error: "auth" }; }
    if (action === "update") {
      const r = mineOf(p); if (!r) return { ok: false, error: "auth" };
      const n = p.data;
      const clash = live.filter((o) => o.id !== r.id).some((o) => slotsOf(o).some((s) => slotsOf(n).some((m) => s.date === m.date && overlaps(m.start, m.end, s.start, s.end))));
      if (clash) return { ok: false, error: "conflict" };
      const moved = ["date", "start", "end", "rehDate", "rehStart", "rehEnd"].some((k) => (r[k] || "") !== (n[k] || ""));
      const reapproval = r.status === "approved" && moved;
      Object.assign(r, n, { email: r.email, updated: Date.now() });
      if (reapproval) r.status = "pending";
      save(db); return { ok: true, id: r.id, status: r.status, reapproval };
    }
    if (action === "withdraw") { const r = mineOf(p); if (!r) return { ok: false, error: "auth" }; r.status = "cancelled"; r.reason = "Withdrawn by the teacher"; save(db); return { ok: true, id: r.id, status: r.status }; }
    if (action === "list") return p.pin === "1234" ? { ok: true, items: db.rows } : { ok: false, error: "pin" };
    if (action === "get") { const r = db.rows.find((x) => x.id === p.id); return r && (p.pin === "1234" || p.token === r.token) ? { ok: true, item: r } : { ok: false, error: "auth" }; }
    if (action === "decide") {
      const r = db.rows.find((x) => x.id === p.id);
      if (!r || !(p.pin === "1234" || p.token === r.token)) return { ok: false, error: "auth" };
      r.status = p.decision === "approve" ? "approved" : p.decision === "cancel" ? "cancelled" : "rejected";
      r.reason = p.reason || ""; r.decidedAt = Date.now(); save(db); return { ok: true, item: r };
    }
    return { ok: false, error: "unknown" };
  }

  window.CHS_API = { call, DEMO };
})();
