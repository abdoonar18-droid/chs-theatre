// ─── CHS Theatre — booking app ───────────────────────────────────────
(function () {
  const CFG = window.CHS_CONFIG, API = window.CHS_API, I18N = window.CHS_I18N, L = window.CHS_LISTS;
  const { toMin, toHM, overlaps } = window.CHS_SLOTS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ── state ──
  let lang = store.get("chs-lang", (navigator.language || "en").startsWith("ar") ? "ar" : "en");
  let DS = CFG.DAY_START, DE = CFG.DAY_END;
  const STEP = CFG.STEP_MIN || 15;
  let slots = [];
  let loaded = false;
  const today = iso(new Date());
  const minDate = iso(addDays(new Date(), CFG.MIN_DAYS_AHEAD));
  let mainMonth = monthOf(today), pickMonth = monthOf(minDate);
  let selDay = today;
  const remembered = store.get("chs-me", {});
  const f = {
    name: remembered.name || "", email: remembered.email || "", dept: remembered.dept || "", deptOther: remembered.deptOther || "", hod: remembered.hod || "",
    title: "", desc: "", audience: 50, audTypes: [], audNote: "",
    date: "", start: "", end: "",
    reh: false, rehDate: "", rehStart: "", rehEnd: "",
    equipment: {}, other: "", agree: false,
  };
  let step = 1;
  const STEPS = 5;
  const DURS = [30, 60, 90, 120, 180];
  let editing = null; // { id, et, status, date, rehDate } while editing an existing request
  // requests sent from this device: [{ id, et }] (older builds stored bare ids)
  const myList = () => store.get("chs-mine", []).map((x) => (typeof x === "string" ? { id: x } : x));
  const addMine = (id, et) => store.set("chs-mine", [{ id, et }, ...myList().filter((x) => x.id !== id)].slice(0, 30));

  // ── utils ──
  function iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monthOf(s) { return s.slice(0, 7); }
  function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  const t = (k, vars) => { let s = (I18N[lang][k] ?? I18N.en[k] ?? k); if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]); return s; };
  const loc = () => (lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB");
  const fmtDate = (s, o = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat(loc(), o).format(parse(s));
  const fmtMonth = (m) => new Intl.DateTimeFormat(loc(), { month: "long", year: "numeric" }).format(parse(m + "-01"));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt12 = (hm) => { const [h, m] = hm.split(":").map(Number); const ap = lang === "ar" ? (h < 12 ? "ص" : "م") : (h < 12 ? "am" : "pm"); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`; };
  const fmtH = (hm) => { const h = Number(hm.split(":")[0]); return String(((h + 11) % 12) + 1); };
  function durLabel(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return `${m} ${t("min")}`;
    if (!m) return `${h} ${t("hr")}`;
    return m === 30 ? `${h}½ ${t("hr")}` : `${h} ${t("hr")} ${m} ${t("min")}`;
  }
  const range = (s, e) => `${fmt12(s)} – ${fmt12(e)}`;
  const timeLabel = (s, e) => (s && e ? `${range(s, e)} · ${durLabel(toMin(e) - toMin(s))}` : "");
  function hydrateIcons(root = document) { $$("[data-icon]", root).forEach((el) => { el.outerHTML = icon(el.dataset.icon); }); }
  const deptLbl = (d) => esc(t("depts")[d] || d);

  // ── i18n apply ──
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $$("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
    $$("[data-t-html]").forEach((el) => { el.innerHTML = t(el.dataset.tHtml); });
    $$("[data-ph]").forEach((el) => { el.placeholder = t(el.dataset.ph); });
    $("#langLbl").textContent = lang === "ar" ? "English" : "عربي";
    renderAll();
  }
  $("#langBtn").addEventListener("click", () => { lang = lang === "ar" ? "en" : "ar"; store.set("chs-lang", lang); applyLang(); });

  // ── intro ──
  (function intro() {
    const el = $("#intro");
    const seen = store.get("chs-intro-seen", 0);
    if (seen) el.classList.add("quick");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish(true);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("play")));
    const total = seen ? 2300 : 4300;
    const timer = location.search.includes("intro=hold") ? 0 : setTimeout(finish, total);
    el.addEventListener("click", () => { clearTimeout(timer); finish(); });
    function finish(instant) {
      store.set("chs-intro-seen", Date.now());
      document.body.classList.remove("locked");
      if (instant === true) { el.remove(); revealHero(); return; }
      el.classList.add("out");
      setTimeout(revealHero, 200);
      setTimeout(() => el.remove(), 950);
    }
  })();
  function revealHero() { $$(".hero .reveal").forEach((e, i) => setTimeout(() => e.classList.add("in"), i * 110)); }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !e.target.closest(".hero")) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$(".reveal").forEach((e) => io.observe(e));

  // ── dust in the beams ──
  (function dust() {
    const c = $("#dust"), x = c.getContext("2d");
    let W, H, parts = [];
    const dpr = Math.min(devicePixelRatio || 1, 2);
    function size() { W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr; parts = Array.from({ length: Math.round((innerWidth * innerHeight) / 14000) }, mk); }
    function mk() { return { x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + 0.3) * dpr, vx: (Math.random() - 0.5) * 0.12 * dpr, vy: (-Math.random() * 0.18 - 0.04) * dpr, a: Math.random() * 0.5 + 0.15, p: Math.random() * 6.28 }; }
    size(); addEventListener("resize", size);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    (function loop(tm) {
      x.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.p += 0.01;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        const tw = 0.6 + 0.4 * Math.sin(p.p + tm / 900);
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283);
        x.fillStyle = `rgba(255,228,180,${p.a * tw})`; x.fill();
      }
      requestAnimationFrame(loop);
    })(0);
  })();

  // ── availability data ──
  async function loadData() {
    try {
      const [cfg, av] = await Promise.all([API.call("config"), API.call("availability")]);
      if (cfg && cfg.dayStart) { DS = cfg.dayStart; DE = cfg.dayEnd; }
      slots = av.slots || [];
      loaded = true;
    } catch (e) { toast(t("netErr"), true); loaded = true; }
    renderAll();
  }
  // while editing, the request's own slots don't count as busy
  const slotsOn = (date) => slots.filter((s) => s.date === date && s.start && s.end && !(editing && sheet.classList.contains("open") && s.id === editing.id)).sort((a, b) => a.start.localeCompare(b.start));
  const clashOn = (date, s, e, extra = []) => [...slotsOn(date), ...extra].find((x) => overlaps(s, e, x.start, x.end)) || null;
  function freeWindows(date, extra = []) {
    const busy = [...slotsOn(date), ...extra].map((s) => [toMin(s.start), toMin(s.end)]).sort((a, b) => a[0] - b[0]);
    const out = []; let cur = toMin(DS); const end = toMin(DE);
    busy.forEach(([s, e]) => { if (s > cur) out.push([cur, Math.min(s, end)]); cur = Math.max(cur, e); });
    if (cur < end) out.push([cur, end]);
    return out.filter(([s, e]) => e - s >= 30).map(([s, e]) => [toHM(s), toHM(e)]);
  }
  const pct = (hm) => ((toMin(hm) - toMin(DS)) / (toMin(DE) - toMin(DS))) * 100;
  const clampPct = (v) => Math.max(0, Math.min(100, v));

  // ── day timeline ──
  function timelineHTML(date, opt = {}) {
    const hours = [];
    for (let m = toMin(DS); m <= toMin(DE); m += 60) hours.push(toHM(m));
    const ticks = hours.map((h, i) => `<i class="tk ${i % 2 ? "minor" : ""}" style="inset-inline-start:${pct(h)}%"><span>${fmtH(h)}</span></i>`).join("");
    const blocks = slotsOn(date).map((s) => {
      const a = clampPct(pct(s.start)), b = clampPct(pct(s.end));
      return `<b class="blk ${s.status === "approved" ? "busy" : "pend"}" style="inset-inline-start:${a}%;width:${b - a}%" title="${esc(s.dept)} ${s.start}–${s.end}"></b>`;
    }).join("");
    const extra = (opt.extra || []).map((s) => { const a = clampPct(pct(s.start)), b = clampPct(pct(s.end)); return `<b class="blk own" style="inset-inline-start:${a}%;width:${b - a}%"></b>`; }).join("");
    let sel = "";
    if (opt.start && opt.end && toMin(opt.end) > toMin(opt.start)) {
      const a = clampPct(pct(opt.start)), b = clampPct(pct(opt.end));
      sel = `<b class="sel ${opt.bad ? "bad" : ""}" style="inset-inline-start:${a}%;width:${b - a}%"><span>${fmt12(opt.start)}</span></b>`;
    }
    return `<div class="tl-track">${ticks}${blocks}${extra}${sel}</div>`;
  }
  function tlMinutesFromEvent(track, ev) {
    const r = track.getBoundingClientRect();
    let x = (ev.clientX - r.left) / r.width;
    if (document.documentElement.dir === "rtl") x = 1 - x;
    const m = toMin(DS) + x * (toMin(DE) - toMin(DS));
    return Math.max(toMin(DS), Math.min(toMin(DE) - STEP, Math.round(m / STEP) * STEP));
  }

  // ── calendar renderer ──
  function renderCal(host, month, opts) {
    const [y, m] = month.split("-").map(Number);
    const startDow = new Date(y, m - 1, 1).getDay(); // Sunday-first (Jordan)
    const days = new Date(y, m, 0).getDate();
    const dows = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc(), { weekday: "short" }).format(new Date(2026, 10, 1 + i)));
    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<div></div>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${month}-${String(d).padStart(2, "0")}`;
      const past = ds < today;
      const blocked = opts.pick && ds < minDate && !(opts.allow && ds === opts.allow);
      const cls = ["day", past ? "past" : "", ds === today ? "today" : "", ds === opts.selected ? "sel" : "", blocked ? "blocked" : ""].join(" ");
      const segs = slotsOn(ds).map((s) => { const a = clampPct(pct(s.start)), b = clampPct(pct(s.end)); return `<i class="${s.status === "approved" ? "b" : "p"}" style="inset-inline-start:${a}%;width:${Math.max(b - a, 4)}%"></i>`; }).join("");
      cells += `<button class="${cls}" data-date="${ds}" ${blocked ? "disabled" : ""} aria-label="${fmtDate(ds)}"><span class="num">${d}</span><span class="mbar">${segs}</span></button>`;
    }
    const prevOk = !opts.pick || month > monthOf(minDate);
    host.innerHTML = `
      <div class="cal-head">
        <h3>${fmtMonth(month)}</h3>
        <div class="cal-nav">
          <button class="icon-btn flip" data-nav="-1" ${prevOk ? "" : "disabled style='opacity:.3'"} aria-label="Previous month">${icon("chevL")}</button>
          <button class="icon-btn flip" data-nav="1" aria-label="Next month">${icon("chevR")}</button>
        </div>
      </div>
      <div class="cal-grid">${dows.map((d) => `<div class="cal-dow">${d}</div>`).join("")}${cells}</div>`;
    host.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => opts.onNav(Number(b.dataset.nav))));
    host.querySelectorAll("[data-date]").forEach((b) => b.addEventListener("click", () => opts.onPick(b.dataset.date)));
  }
  const shiftMonth = (m, n) => { const d = parse(m + "-01"); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); };

  function renderMain() {
    renderCal($("#mainCal"), mainMonth, {
      selected: selDay,
      onNav: (n) => { mainMonth = shiftMonth(mainMonth, n); renderMain(); },
      onPick: (d) => { selDay = d; renderMain(); renderDay(); if (innerWidth < 860) $("#dayPanel").scrollIntoView({ behavior: "smooth", block: "start" }); },
    });
  }
  function renderDay() {
    const host = $("#dayPanel");
    if (!loaded) { host.innerHTML = `<div class="skeleton" style="height:28px;width:60%"></div><div style="height:16px"></div>${'<div class="skeleton" style="height:52px;margin-bottom:8px"></div>'.repeat(4)}`; return; }
    const day = slotsOn(selDay);
    const free = freeWindows(selDay);
    const rows = day.map((s) => `
      <div class="prow ${s.status === "approved" ? "busy" : "pending"}">
        <div class="pn">${icon("clock")}</div>
        <div><div class="pd">${deptLbl(s.dept)}${s.kind === "rehearsal" ? " · " + t("rehearsal") : ""}</div><div class="pt">${timeLabel(s.start, s.end)}</div></div>
        <span class="tag ${s.status === "approved" ? "busy" : "pending"}">${t(s.status === "approved" ? "booked" : "pending")}</span>
      </div>`).join("");
    const canBook = selDay >= minDate;
    const note = selDay < today ? t("pastDay") : !canBook ? t("tooSoon", { n: CFG.MIN_DAYS_AHEAD }) : "";
    host.innerHTML = `
      <h3>${fmtDate(selDay)}</h3>
      <div class="sub">${day.length ? `${day.length} · ${t("bookingsLbl")}` : t("freeAll")}</div>
      <div class="tl static">${timelineHTML(selDay)}</div>
      ${day.length ? `<div class="plist" style="margin-top:16px">${rows}</div>` : ""}
      ${day.length && free.length ? `<div class="lbl" style="margin:18px 0 8px">${t("freeWin")}</div><div class="chips">${free.map(([a, b]) => `<span class="chip ghosty">${range(a, b)}</span>`).join("")}</div>` : ""}
      <div style="flex:1;min-height:12px"></div>
      ${canBook ? `<button class="btn primary block" id="bookDay">${icon("ticket")}<span>${t("bookDay")}</span></button>` : `<div class="hint" style="margin-top:16px;text-align:center">${note}</div>`}`;
    const b = $("#bookDay", host);
    if (b) b.addEventListener("click", () => { pickDate(selDay); pickMonth = monthOf(selDay); openSheet(); });
  }

  // ── my requests ──
  async function renderMine() {
    const list = myList().filter((x) => x.et);
    $("#mineSec").hidden = !list.length;
    if (!list.length) return;
    const host = $("#mineList");
    if (!host.children.length) host.innerHTML = '<div class="skeleton" style="height:70px"></div>';
    try {
      const { items } = await API.call("mine", { items: list });
      items.sort((a, b) => (b.created || 0) - (a.created || 0));
      host.innerHTML = items.map((r) => {
        const live = (r.status === "pending" || r.status === "approved") && r.date >= today;
        return `
        <div class="card mine-item" data-id="${esc(r.id)}">
          <div class="mi-id">${esc(r.id)}</div>
          <div class="mi-t"><b>${esc(r.title)}</b><small>${fmtDate(r.date, { weekday: "short", day: "numeric", month: "short" })} · ${r.start ? range(r.start, r.end) : ""}</small>${r.reason ? `<small style="display:block;color:#ff8a8f">${esc(r.reason)}</small>` : ""}</div>
          <span class="tag ${r.status}">${t(r.status)}</span>
          ${live ? `<div class="mi-acts"><button class="pill-btn" data-act="edit">${icon("pencil")}<span>${t("edit")}</span></button><button class="pill-btn" data-act="withdraw">${icon("x")}<span>${t("withdraw")}</span></button></div>` : ""}
        </div>`;
      }).join("");
    } catch { /* keep previous */ }
  }
  $("#mineRefresh").addEventListener("click", () => { renderMine(); loadData(); });
  $("#mineList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.closest(".mine-item").dataset.id;
    const me = myList().find((x) => x.id === id); if (!me) return;
    if (b.dataset.act === "edit") return startEdit(me.id, me.et);
    if (!confirm(t("withdrawQ"))) return;
    b.disabled = true;
    try {
      const res = await API.call("withdraw", { id: me.id, et: me.et });
      if (!res.ok) throw new Error(res.message);
      toast(t("withdrawn")); loadData(); renderMine();
    } catch (err) { toast(err.message || t("netErr"), true); b.disabled = false; }
  });

  // ── edit an existing request ──
  async function startEdit(id, et) {
    let res;
    try { res = await API.call("getMine", { id, et }); } catch { return toast(t("netErr"), true); }
    if (!res.ok) return toast(t("editBad"), true);
    const r = res.item;
    addMine(id, et);
    editing = { id, et, status: r.status, date: r.date, rehDate: r.rehDate || "" };
    const known = L.depts.includes(r.dept);
    Object.assign(f, {
      name: r.name, email: r.email.split("@")[0], dept: known ? r.dept : "Other", deptOther: known ? "" : r.dept, hod: r.hod,
      title: r.title, desc: r.desc || "", audience: r.audience || 1, audTypes: r.audTypes || [], audNote: r.audNote || "",
      date: r.date, start: r.start, end: r.end,
      reh: !!r.rehDate, rehDate: r.rehDate || "", rehStart: r.rehStart || "", rehEnd: r.rehEnd || "",
      equipment: { ...(r.equipment || {}) }, other: r.other || "", agree: true,
    });
    pickMonth = monthOf(r.date);
    openSheet();
  }
  function resetForm() {
    Object.assign(f, { title: "", desc: "", audience: 50, audTypes: [], audNote: "", date: "", start: "", end: "", reh: false, rehDate: "", rehStart: "", rehEnd: "", equipment: {}, other: "", agree: false });
    const me = store.get("chs-me", {});
    Object.assign(f, { name: me.name || "", email: me.email || "", dept: me.dept || "", deptOther: me.deptOther || "", hod: me.hod || "" });
  }

  // ── contact card ──
  function renderContact() {
    const M = CFG.MANAGER, intl = "962" + M.phone.replace(/^0/, "");
    const html = `<div class="contact">
      <div class="c-ico">${icon("phone")}</div>
      <div class="c-t"><small>${t("contactT")}</small><b>${esc(M[lang] || M.en)}</b><span>${t("contactRole")} · ${esc(M.phone)}</span></div>
      <div class="c-btns"><a href="tel:+${intl}">${icon("phone")}<span>${t("call")}</span></a><a class="wa" href="https://wa.me/${intl}" target="_blank" rel="noopener">${icon("chat")}<span>${t("whatsapp")}</span></a></div>
    </div>`;
    $$(".contact-slot").forEach((el) => (el.innerHTML = html));
  }

  // ── booking sheet ──
  const sheet = $("#sheet");
  function openSheet() {
    if (!editing && f.date && f.date < minDate) f.date = "";
    step = 1; $("#done").classList.remove("on"); $("#sheetFoot").hidden = false;
    sheet.classList.add("open"); document.body.classList.add("locked");
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("show")));
    renderStep();
    history.pushState({ sheet: 1 }, "");
  }
  function closeSheet(fromPop) {
    if (editing) { editing = null; resetForm(); }
    sheet.classList.remove("show"); document.body.classList.remove("locked");
    setTimeout(() => sheet.classList.remove("open"), 600);
    if (!fromPop && history.state && history.state.sheet) history.back();
  }
  addEventListener("popstate", () => { if (sheet.classList.contains("open")) closeSheet(true); });
  $$("[data-open-booking]").forEach((b) => b.addEventListener("click", () => { pickMonth = monthOf(f.date || minDate); openSheet(); }));
  sheet.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open")) closeSheet(); });

  function renderStep(dir = 1) {
    $$(".step").forEach((s) => s.classList.remove("active", "back"));
    const cur = $(`.step[data-step="${step}"]`);
    cur.classList.add("active"); if (dir < 0) cur.classList.add("back");
    $("#stepNum").textContent = (editing ? t("editing", { id: editing.id }) + " · " : "") + t("stepOf", { a: step, b: STEPS });
    $("#stepTitle").textContent = t("steps")[step - 1];
    $$("#progress i").forEach((i, k) => i.classList.toggle("on", k < step));
    $("#backBtn").style.display = step === 1 ? "none" : "";
    $("#nextLbl").textContent = step === STEPS ? t(editing ? "save" : "send") : t("next");
    let banner = $("#editBanner");
    if (editing && step === 1) {
      if (!banner) { cur.insertAdjacentHTML("afterbegin", `<div class="edit-banner" id="editBanner">${icon("pencil")}<span></span></div>`); banner = $("#editBanner"); }
      banner.querySelector("span").textContent = t("editNote");
    } else if (banner) banner.remove();
    $("#fEmail").disabled = !!editing;
    $("#nextIco").style.display = step === STEPS ? "none" : "";
    $("#sheetBody").scrollTop = 0;
    $$(".err").forEach((e) => e.classList.remove("on"));
    if (step === 1) renderS1();
    if (step === 2) renderS2();
    if (step === 3) renderS3();
    if (step === 4) renderS4();
    if (step === 5) renderS5();
  }
  $("#backBtn").addEventListener("click", () => { if (step > 1) { step--; renderStep(-1); } });
  $("#nextBtn").addEventListener("click", () => {
    if (!validate()) return;
    if (step < STEPS) { step++; renderStep(1); } else submit();
  });

  // typing in a field clears its error state
  $("#sheetBody").addEventListener("input", (e) => {
    if (!e.target.classList.contains("input")) return;
    e.target.classList.remove("bad");
    const fe = e.target.closest(".field"); if (fe) $$("[data-err]", fe).forEach((x) => x.classList.remove("on"));
  });
  function err(k, on = true) { const e = $(`[data-err="${k}"]`); if (e) e.classList.toggle("on", on); return !on; }

  // step 1
  function renderS1() {
    $("#fName").value = f.name; $("#fEmail").value = f.email; $("#fHod").value = f.hod; $("#fDeptOther").value = f.deptOther;
    $("#deptChips").innerHTML = L.depts.map((d) => `<button type="button" class="chip ${f.dept === d ? "on" : ""}" data-v="${d}">${esc(t("depts")[d])}</button>`).join("");
    $("#deptOtherBox").classList.toggle("on", f.dept === "Other");
  }
  $("#deptChips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    f.dept = c.dataset.v; $$("#deptChips .chip").forEach((x) => x.classList.toggle("on", x === c));
    $("#deptOtherBox").classList.toggle("on", f.dept === "Other"); err("dept", false);
    if (f.dept === "Other") setTimeout(() => $("#fDeptOther").focus(), 300);
  });
  $("#fName").addEventListener("input", (e) => (f.name = e.target.value));
  $("#fEmail").addEventListener("input", (e) => {
    let v = e.target.value.trim();
    if (v.includes("@")) { v = v.split("@")[0]; e.target.value = v; }
    f.email = v;
  });
  $("#fHod").addEventListener("input", (e) => (f.hod = e.target.value));
  $("#fDeptOther").addEventListener("input", (e) => (f.deptOther = e.target.value));

  // step 2
  function renderS2() {
    $("#fTitle").value = f.title; $("#fDesc").value = f.desc; $("#fAudience").value = f.audience; $("#fAudNote").value = f.audNote;
    $("#audChips").innerHTML = L.aud.map((a) => `<button type="button" class="chip ${f.audTypes.includes(a) ? "on" : ""}" data-v="${a}">${esc(t("aud")[a])}</button>`).join("");
  }
  $("#audChips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    const v = c.dataset.v; f.audTypes = f.audTypes.includes(v) ? f.audTypes.filter((x) => x !== v) : [...f.audTypes, v];
    c.classList.toggle("on"); err("aud", false);
  });
  $("#audStepper").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    f.audience = Math.max(1, Math.min(600, (Number(f.audience) || 0) + Number(b.dataset.d)));
    if (f.audience > 1 && f.audience % 10) f.audience = Math.round(f.audience / 10) * 10 || 1;
    $("#fAudience").value = f.audience;
  });
  $("#fAudience").addEventListener("input", (e) => (f.audience = Math.max(1, Number(e.target.value) || 1)));
  $("#fTitle").addEventListener("input", (e) => (f.title = e.target.value));
  $("#fDesc").addEventListener("input", (e) => (f.desc = e.target.value));
  $("#fAudNote").addEventListener("input", (e) => (f.audNote = e.target.value));

  // step 3 — date + time
  // default time on a newly picked day: first free window that fits 1h, starting no earlier than 08:00
  function suggest(date, extra = []) {
    const wins = freeWindows(date, extra);
    for (const need of [60, 30]) {
      for (const [a, b] of wins) {
        const s = Math.max(toMin(a), toMin("08:00"));
        if (toMin(b) - s >= need) return [toHM(s), toHM(s + Math.min(60, toMin(b) - s))];
      }
    }
    return ["", ""];
  }
  function pickDate(d) {
    if (d === f.date) return;
    f.date = d;
    if (!f.start || clashOn(d, f.start, f.end)) [f.start, f.end] = suggest(d);
  }
  const rehExtra = () => (f.rehDate && f.rehDate === f.date && f.start && f.end ? [{ start: f.start, end: f.end }] : []);
  const evExtra = () => (f.reh && f.rehDate === f.date && f.rehStart && f.rehEnd ? [{ start: f.rehStart, end: f.rehEnd }] : []);

  function renderS3() {
    const allow = editing && editing.date >= today ? editing.date : "";
    renderCal($("#pickCal"), pickMonth, {
      pick: true, selected: f.date, allow,
      onNav: (n) => { pickMonth = shiftMonth(pickMonth, n); renderS3(); },
      onPick: (d) => {
        if (d < minDate && d !== allow) return;
        pickDate(d); err("date", false); renderS3();
        setTimeout(() => $("#whenBox").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      },
    });
    $("#whenBox").hidden = !f.date;
    if (!f.date) return;
    $("#pickedLbl").textContent = fmtDate(f.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    paintTime("ev");
    setSwitch($("#rehSw"), f.reh); $("#rehBox").classList.toggle("on", f.reh);
    $("#fRehDate").min = minDate; $("#fRehDate").value = f.rehDate;
    $("#rehWrap").hidden = !f.rehDate;
    if (f.rehDate) paintTime("reh");
  }
  // paints timeline + inputs + duration chips + message for the event ("ev") or rehearsal ("reh")
  function paintTime(which) {
    const ev = which === "ev";
    const date = ev ? f.date : f.rehDate, s = ev ? f.start : f.rehStart, e = ev ? f.end : f.rehEnd;
    const extra = ev ? evExtra() : rehExtra();
    const msg = timeIssue(date, s, e, extra);
    $(ev ? "#tl" : "#rehTl").innerHTML = timelineHTML(date, { start: s, end: e, bad: !!msg && !!s && !!e, extra });
    const si = $(ev ? "#fStart" : "#fRehStart"), ei = $(ev ? "#fEnd" : "#fRehEnd");
    if (si.value !== s) si.value = s; if (ei.value !== e) ei.value = e;
    si.min = ei.min = DS; si.max = ei.max = DE;
    const cur = s && e ? toMin(e) - toMin(s) : 0;
    $(ev ? "#durChips" : "#rehDurChips").innerHTML = DURS.map((d) => `<button type="button" class="chip sm ${cur === d ? "on" : ""}" data-dur="${d}">${durLabel(d)}</button>`).join("");
    const el = $(ev ? "#timeErr" : "#rehTimeErr");
    el.textContent = s && e ? msg : ""; el.classList.toggle("on", !!(s && e && msg));
  }
  function timeIssue(date, s, e, extra = []) {
    if (!s || !e) return t("errNoTime");
    if (toMin(e) <= toMin(s)) return t("errTime");
    if (toMin(s) < toMin(DS) || toMin(e) > toMin(DE)) return t("errRange", { a: fmt12(DS), b: fmt12(DE) });
    if (clashOn(date, s, e, extra)) return t("errClash");
    return "";
  }
  function setTimes(which, s, e) {
    if (which === "ev") { f.start = s; f.end = e; } else { f.rehStart = s; f.rehEnd = e; }
    paintTime(which);
    // the other timeline shows this one as "your event" when on the same day
    if (f.reh && f.rehDate && f.rehDate === f.date) paintTime(which === "ev" ? "reh" : "ev");
  }
  function bindTime(which, tlSel, sSel, eSel, durSel) {
    const get = () => (which === "ev" ? [f.date, f.start, f.end] : [f.rehDate, f.rehStart, f.rehEnd]);
    $(tlSel).addEventListener("click", (ev) => {
      const track = ev.target.closest(".tl-track"); if (!track) return;
      const [, s, e] = get();
      const dur = s && e && toMin(e) > toMin(s) ? toMin(e) - toMin(s) : 60;
      const start = tlMinutesFromEvent(track, ev);
      setTimes(which, toHM(start), toHM(Math.min(start + dur, toMin(DE))));
      if (navigator.vibrate) navigator.vibrate(6);
    });
    $(sSel).addEventListener("change", (ev) => {
      const [, s, e] = get(); const v = ev.target.value; if (!v) return;
      const dur = s && e && toMin(e) > toMin(s) ? toMin(e) - toMin(s) : 60;
      setTimes(which, v, toHM(Math.min(toMin(v) + dur, 24 * 60 - 1)));
    });
    $(eSel).addEventListener("change", (ev) => { const [, s] = get(); setTimes(which, s, ev.target.value); });
    $(durSel).addEventListener("click", (ev) => {
      const c = ev.target.closest("[data-dur]"); if (!c) return;
      const [date, s] = get();
      const start = s || suggest(date)[0] || "08:00";
      setTimes(which, start, toHM(Math.min(toMin(start) + Number(c.dataset.dur), 24 * 60 - 1)));
    });
  }
  bindTime("ev", "#tl", "#fStart", "#fEnd", "#durChips");
  bindTime("reh", "#rehTl", "#fRehStart", "#fRehEnd", "#rehDurChips");
  function setSwitch(el, on) { el.classList.toggle("on", on); el.setAttribute("aria-checked", on); }
  function bindSwitch(el, fn) { el.addEventListener("click", fn); el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fn(); } }); }
  bindSwitch($("#rehSw"), () => { f.reh = !f.reh; err("reh", false); renderS3(); });
  $("#fRehDate").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v && v < minDate && !(editing && v === editing.rehDate && v >= today)) { e.target.value = f.rehDate; toast(t("tooSoon", { n: CFG.MIN_DAYS_AHEAD }), true); return; }
    f.rehDate = v; err("reh", false);
    if (v) [f.rehStart, f.rehEnd] = suggest(v, rehExtra());
    renderS3();
  });

  // step 4
  function renderS4() {
    $("#fOther").value = f.other;
    $("#equipGrid").innerHTML = L.equip.map(([k, ic, counted]) => {
      const v = f.equipment[k] || 0;
      if (counted) return `<div class="eq count ${v ? "on" : ""}" data-k="${k}">${icon(ic)}<span>${esc(t("equip")[k])}</span>
        <div class="stepper sm"><button type="button" data-d="-1" aria-label="−">−</button><input type="number" inputmode="numeric" min="0" max="${k === "chairs" ? 600 : 50}" value="${v}" aria-label="${esc(t("equip")[k])}"/><button type="button" data-d="1" aria-label="+">+</button></div></div>`;
      return `<button type="button" class="eq ${v ? "on" : ""}" data-k="${k}" aria-pressed="${!!v}">${icon(ic)}<span>${esc(t("equip")[k])}</span></button>`;
    }).join("");
  }
  $("#equipGrid").addEventListener("click", (e) => {
    const tile = e.target.closest(".eq"); if (!tile) return;
    const k = tile.dataset.k;
    if (tile.classList.contains("count")) {
      const b = e.target.closest("button"); if (!b) return;
      const inc = k === "chairs" ? 10 : 1;
      setEquip(tile, k, Math.max(0, (f.equipment[k] || 0) + Number(b.dataset.d) * inc));
    } else {
      f.equipment[k] = f.equipment[k] ? 0 : 1;
      tile.classList.toggle("on", !!f.equipment[k]); tile.setAttribute("aria-pressed", !!f.equipment[k]);
      if (navigator.vibrate) navigator.vibrate(8);
    }
  });
  $("#equipGrid").addEventListener("input", (e) => {
    const tile = e.target.closest(".eq.count"); if (!tile) return;
    setEquip(tile, tile.dataset.k, Math.max(0, Number(e.target.value) || 0), true);
  });
  function setEquip(tile, k, v, fromInput) {
    f.equipment[k] = v; tile.classList.toggle("on", v > 0);
    if (!fromInput) tile.querySelector("input").value = v;
  }
  $("#fOther").addEventListener("input", (e) => (f.other = e.target.value));

  // step 5
  function deptName() { return f.dept === "Other" ? f.deptOther.trim() : f.dept; }
  function equipList(eq = f.equipment) {
    return L.equip.filter(([k]) => eq[k]).map(([k, , c]) => (c ? `${t("equip")[k]} ×${eq[k]}` : t("equip")[k])).join(" · ");
  }
  function renderS5() {
    const rv = (k, v) => `<div class="rv"><dt>${t(k)}</dt><dd>${v || t("none")}</dd></div>`;
    $("#reviewBox").innerHTML = `<dl style="margin:0">
      ${rv("rvWho", `${esc(f.name)}<div class="hint" dir="ltr" style="text-align:start;margin:2px 0 0">${esc(f.email)}@${CFG.SCHOOL_DOMAIN}</div>`)}
      ${rv("rvDept", deptLbl(deptName()))}
      ${rv("rvHod", esc(f.hod))}
      ${rv("rvEvent", `${esc(f.title)}${f.desc ? `<div class="hint" style="margin-top:3px">${esc(f.desc)}</div>` : ""}`)}
      ${rv("rvAud", `${f.audience} · ${f.audTypes.map((a) => t("aud")[a]).join(lang === "ar" ? "، " : ", ")}${f.audNote ? `<div class="hint" style="margin-top:3px">${esc(f.audNote)}</div>` : ""}`)}
      ${rv("rvWhen", `${fmtDate(f.date)}<div class="hint" style="margin-top:3px">${timeLabel(f.start, f.end)}</div>`)}
      ${f.reh ? rv("rvReh", `${fmtDate(f.rehDate)}<div class="hint" style="margin-top:3px">${timeLabel(f.rehStart, f.rehEnd)}</div>`) : ""}
      ${rv("rvEquip", esc(equipList()))}
      ${f.other ? rv("rvOther", esc(f.other)) : ""}
    </dl>`;
    setAgree(f.agree);
  }
  function setAgree(on) { f.agree = on; $("#agree").classList.toggle("on", on); $("#agree").setAttribute("aria-checked", on); if (on) err("agree", false); }
  bindSwitch($("#agree"), () => setAgree(!f.agree));

  // validation
  function validate() {
    $$(".step.active [data-err]").forEach((e) => e.classList.remove("on"));
    if (step === 1) {
      const fails = [];
      if (!f.name.trim()) { err("name"); fails.push($("#fName")); }
      if (!/^[a-z0-9._%+-]+$/i.test(f.email)) { err("email"); fails.push($("#fEmail")); }
      if (!f.dept || (f.dept === "Other" && !f.deptOther.trim())) { err("dept"); if (f.dept === "Other") fails.push($("#fDeptOther")); }
      if (!f.hod.trim()) { err("hod"); fails.push($("#fHod")); }
      fails.forEach((el, i) => { el.classList.remove("bad"); void el.offsetWidth; el.classList.add("bad"); if (!i) el.focus(); });
      return !$$(".step.active .err.on").length;
    }
    if (step === 2) {
      let ok = true;
      if (!f.title.trim()) { err("title"); const el = $("#fTitle"); el.classList.remove("bad"); void el.offsetWidth; el.classList.add("bad"); ok = false; }
      if (!f.audTypes.length) { err("aud"); ok = false; }
      return ok;
    }
    if (step === 3) {
      if (!f.date) { err("date"); return false; }
      const m = timeIssue(f.date, f.start, f.end, evExtra());
      if (m) { const el = $("#timeErr"); el.textContent = m; el.classList.add("on"); el.scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
      if (f.reh) {
        const r = f.rehDate ? timeIssue(f.rehDate, f.rehStart, f.rehEnd, rehExtra()) : t("errReh");
        if (r) { if (f.rehDate) { const el = $("#rehTimeErr"); el.textContent = r; el.classList.add("on"); } else err("reh"); $("#rehBox").scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
      }
      return true;
    }
    if (step === 5) { if (!f.agree) { err("agree"); return false; } }
    return true;
  }

  // submit
  async function submit() {
    const btn = $("#nextBtn");
    btn.disabled = true; $("#nextLbl").textContent = t("sending"); btn.insertAdjacentHTML("afterbegin", '<span class="spinner"></span>');
    const data = {
      name: f.name.trim(), email: `${f.email.trim().toLowerCase()}@${CFG.SCHOOL_DOMAIN}`, dept: deptName(), hod: f.hod.trim(),
      title: f.title.trim(), desc: f.desc.trim(), audience: Number(f.audience) || 0, audTypes: f.audTypes, audNote: f.audNote.trim(),
      date: f.date, start: f.start, end: f.end,
      rehDate: f.reh ? f.rehDate : "", rehStart: f.reh ? f.rehStart : "", rehEnd: f.reh ? f.rehEnd : "",
      equipment: Object.fromEntries(Object.entries(f.equipment).filter(([, v]) => v)), other: f.other.trim(), lang,
    };
    try {
      const res = editing ? await API.call("update", { id: editing.id, et: editing.et, data }) : await API.call("submit", { data });
      if (!res.ok) {
        if (res.error === "conflict") { toast(t("conflict"), true); await loadData(); step = 3; renderStep(-1); }
        else toast(res.message || t("netErr"), true);
        return;
      }
      if (res.unchanged) { toast(t("unchanged")); return; }
      store.set("chs-me", { name: f.name, email: f.email, dept: f.dept, deptOther: f.deptOther, hod: f.hod });
      if (!editing) addMine(res.id, res.et);
      showDone(res.id, data, editing ? (res.reapproval ? "re" : "saved") : "", res.status || "pending");
      editing = null; resetForm();
      loadData(); renderMine();
    } catch (e) {
      toast(t("netErr"), true);
    } finally {
      btn.disabled = false; const sp = btn.querySelector(".spinner"); if (sp) sp.remove();
      $("#nextLbl").textContent = step === STEPS ? t(editing ? "save" : "send") : t("next");
    }
  }

  function showDone(id, d, mode = "", status = "pending") {
    $$(".step").forEach((s) => s.classList.remove("active"));
    $("#sheetFoot").hidden = true;
    $("#stepNum").textContent = id; $("#stepTitle").textContent = t("tkTitle");
    $("#done h3").textContent = t(mode ? "savedT" : "doneT");
    $("#done p").textContent = mode === "re" ? t("savedReP") : mode ? t("savedP") : t("doneP");
    const sl = $("#done .status-line");
    sl.querySelector("span").textContent = status === "approved" ? t("approved") : t("awaiting");
    sl.style.color = status === "approved" ? "var(--ok)" : ""; sl.style.borderColor = status === "approved" ? "rgba(87,196,138,.35)" : "";
    sl.querySelector("i").style.background = status === "approved" ? "var(--ok)" : "";
    $$("#progress i").forEach((i) => i.classList.add("on"));
    const done = $("#done");
    $("#ticket").innerHTML = `
      <div class="t-main">
        <small>${t("tkAdmit")}</small>
        <b>${esc(d.title)}</b>
        <div class="t-meta">
          <div><span>${t("tkDate")}</span><em>${fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" })}</em></div>
          <div><span>${t("tkTime")}</span><em>${fmt12(d.start)} – ${fmt12(d.end)}</em></div>
          <div><span>${t("tkDept")}</span><em>${deptLbl(d.dept)}</em></div>
          <div><span>${t("tkAud")}</span><em>${d.audience}</em></div>
        </div>
      </div>
      <div class="t-stub"><div><span>${t("tkNo")}</span><br/><b>${esc(id)}</b></div></div>`;
    done.classList.remove("on"); void done.offsetWidth; done.classList.add("on");
    $("#sheetBody").scrollTop = 0;
    burst();
    if (navigator.vibrate) navigator.vibrate([12, 60, 20]);
  }

  function burst() {
    const c = $("#burst"), r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = r.width * dpr; c.height = r.height * dpr;
    const x = c.getContext("2d"), cx = c.width / 2, cy = 140 * dpr;
    const cols = ["#f3d999", "#d9b46a", "#d6333a", "#fff3d2", "#b01e23"];
    const ps = Array.from({ length: 110 }, () => {
      const a = Math.random() * Math.PI * 2, v = (Math.random() * 7 + 3) * dpr;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * dpr, w: (Math.random() * 6 + 3) * dpr, h: (Math.random() * 3 + 2) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] };
    });
    const start = performance.now();
    (function loop(tm) {
      const el = tm - start, life = Math.max(0, 1 - el / 2600);
      x.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => {
        p.vy += 0.18 * dpr; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = life;
        x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 0.5); x.restore();
      });
      if (el < 2700) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height);
    })(start);
  }

  // toast
  let tt;
  function toast(msg, isBad) {
    const el = $("#toast");
    el.className = "toast" + (isBad ? " bad" : "");
    el.innerHTML = icon(isBad ? "alert" : "check") + `<span>${esc(msg)}</span>`;
    requestAnimationFrame(() => el.classList.add("on"));
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 4200);
  }

  function renderAll() {
    renderContact();
    renderMain(); renderDay();
    if (sheet.classList.contains("open") && !$("#done").classList.contains("on")) renderStep();
    renderMine();
  }

  // ── boot ──
  if (API.DEMO) document.body.insertAdjacentHTML("beforeend", `<div class="demo-badge">${t("demo")}</div>`);
  hydrateIcons();
  applyLang();
  loadData().then(() => {
    // edit link from an email: ?edit=T-0042&k=<edit key>
    const q = new URLSearchParams(location.search);
    if (q.get("edit") && q.get("k")) {
      history.replaceState(null, "", location.pathname);
      setTimeout(() => startEdit(q.get("edit"), q.get("k")), 600);
    }
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
