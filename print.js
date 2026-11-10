// ─── Printable reservation form (A4) — same layout as the paper form ──
(async function () {
  const API = window.CHS_API, CFG = window.CHS_CONFIG;
  const wrap = document.getElementById("wrap");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const dLong = (s) => (s ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parse(s)) : "");
  const fmt12 = (hm) => { if (!hm) return ""; const [h, m] = hm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
  const stamp = (ms) => (ms ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms)) : "");
  const EQUIP = [["wiredMic", "Sound system — wired mic", 1], ["wirelessMic", "Sound system — wireless mic", 1], ["laptop", "Laptop"], ["lighting", "Lighting system"],
    ["podium", "Podium"], ["torch", "Torch"], ["liveView", "Live view"], ["smoke", "Smoke machine"], ["tables", "Tables", 1], ["chairs", "Chairs", 1],
    ["dataShow", "Data show"], ["backstage", "Backstage"], ["dressing", "Dressing rooms"], ["laser", "Laser pointer"], ["mouse", "Wireless mouse"]];
  const label = { pending: "Awaiting approval", approved: "Approved", rejected: "Declined", cancelled: "Cancelled" };

  const q = new URLSearchParams(location.search);
  const id = q.get("id");
  let pin = null; try { pin = localStorage.getItem("chs-admin-pin"); } catch {}
  let res = null;
  try {
    if (id && q.get("et")) res = await API.call("getMine", { id, et: q.get("et") });
    else if (id && q.get("t")) res = await API.call("get", { id, token: q.get("t") });
    else if (id && pin) res = await API.call("get", { id, pin });
  } catch { res = null; }
  if (!res || !res.ok) {
    wrap.innerHTML = `<div class="msg">This link isn’t valid, or the request can’t be opened from this device.</div>`;
    document.getElementById("bar").style.display = "none";
    return;
  }
  const r = res.item;
  document.title = `Theatre Reservation ${r.id} — ${r.title}`;
  const has = (a) => (r.audTypes || []).includes(a);
  const ck = (on, txt) => `<span class="chk"><span class="box">${on ? "✓" : ""}</span>${txt}</span>`;
  const eqRow = ([k, n, counted]) => {
    const v = (r.equipment || {})[k];
    return `<tr><td>${n}</td><td class="c ${v ? "yes" : "no"}">${v ? (counted ? "× " + v : "✓") : "—"}</td></tr>`;
  };
  const half = Math.ceil(EQUIP.length / 2);
  const M = CFG.MANAGER;

  wrap.innerHTML = `<div class="page" id="page">
    <div class="frame"></div>
    <img class="wm" src="logo.png" alt="">
    <header>
      <div class="meta">Request<b>${esc(r.id)}</b>Submitted ${stamp(r.created)}${r.updated ? `<br>Updated ${stamp(r.updated)}` : ""}<br><span class="status st-${r.status}">${label[r.status] || r.status}</span></div>
      <img src="logo.png" alt="">
      <div class="ar">مدرسة كامبردج</div>
      <div class="bl">Cambridge High School</div>
      <h1>Theater reservation form<small>Theatre Reservation · CHS Theatre</small></h1>
    </header>

    <div class="sec">
      <h2>Event</h2>
      <div class="grid">
        <div class="f"><i>Department:</i><b>${esc(r.dept)}</b></div>
        <div class="f"><i>Teacher’s Name:</i><b>${esc(r.name)}</b></div>
        <div class="f full"><i>Email:</i><b>${esc(r.email)}</b></div>
        <div class="f full"><i>Date/Day (of the event):</i><b>${dLong(r.date)}</b></div>
        <div class="f"><i>Time — Start:</i><b>${fmt12(r.start)}</b></div>
        <div class="f"><i>End:</i><b>${fmt12(r.end)}</b></div>
        <div class="f full"><i>Event:</i><b>${esc(r.title)}</b></div>
        ${r.desc ? `<div class="f full"><i>Event Description:</i><b>${esc(r.desc)}</b></div>` : ""}
        <div class="f"><i>No. of audience:</i><b>${esc(r.audience)}</b></div>
        <div class="f"><b>${ck(has("Students"), "Students")}${ck(has("Staff"), "Staff")}${ck(has("Parents"), "Parents")}${ck(has("Guests"), "Guests")}</b></div>
        ${r.audNote ? `<div class="f full"><i>Audience notes:</i><b>${esc(r.audNote)}</b></div>` : ""}
      </div>
    </div>

    <div class="sec">
      <h2>Rehearsal (if necessary)</h2>
      <div class="grid">
        <div class="f"><i>Date:</i><b>${r.rehDate ? dLong(r.rehDate) : "—"}</b></div>
        <div class="f"><i>Time:</i><b>${r.rehDate ? fmt12(r.rehStart) + " – " + fmt12(r.rehEnd) : "—"}</b></div>
      </div>
    </div>

    <div class="sec">
      <h2>Facilities form</h2>
      <div class="eqcols">
        <table><tr><th>Equipment</th><th style="text-align:center">(*)</th></tr>${EQUIP.slice(0, half).map(eqRow).join("")}</table>
        <table><tr><th>Equipment</th><th style="text-align:center">(*)</th></tr>${EQUIP.slice(half).map(eqRow).join("")}</table>
      </div>
      <div style="margin-top:3mm;font-size:9pt"><i style="font-family:'Playfair Display',serif;color:var(--mute)">Other needs (if not listed above):</i></div>
      <div class="other">${esc(r.other) || "—"}</div>
    </div>

    <div class="sec">
      <h2>Notes</h2>
      <ul class="notes">
        <li>Theatre reservation should be taken in the beginning of each school term.</li>
        <li>Handle facility form and materials needed <b>3 days before event</b>.</li>
        <li>Torch use should be done in coordination with the theatre manager.</li>
        <li>Please provide minutes of event (walk-through) a week before dates.</li>
        <li>All screened material (presentations, slide shows, films…) is handed in on a flash drive or by email.</li>
      </ul>
    </div>

    <div class="sign">
      <div>
        <p><i>HOD’s Name:</i><b>${esc(r.hod)}</b></p>
        <p><i>Signature:</i><b></b></p>
        <p><i>Date:</i><b></b></p>
      </div>
      <div>
        <p><i>Theatre Manager:</i><b>${esc(M.en)}</b></p>
        <p><i>Signature:</i><b></b></p>
        <p><i>Date:</i><b>${r.status === "approved" ? stamp(r.decidedAt) : ""}</b></p>
      </div>
    </div>

    <footer>“The theatre is living art and demands a higher respect from those watching it.”<br>Welcome to Cambridge High School theatre — Enjoy the art
      <small>Theatre Manager: ${esc(M.en)} · ${esc(M.phone)} · ${esc(M.email)}</small></footer>
  </div>`;

  // fit the A4 sheet to small screens (print is unaffected)
  function fit() {
    const page = document.getElementById("page");
    const avail = wrap.clientWidth - 20, w = page.offsetWidth;
    const s = Math.min(1, avail / w);
    page.style.transform = s < 1 ? `scale(${s})` : "";
    page.style.transformOrigin = "top left";
    wrap.style.height = s < 1 ? page.offsetHeight * s + 60 + "px" : "";
  }
  addEventListener("resize", fit); fit();
  // always one A4 sheet: shrink the content a little if a long request would spill onto page 2
  addEventListener("beforeprint", () => {
    const page = document.getElementById("page");
    page.style.transform = ""; page.style.zoom = ""; wrap.style.height = "";
    const a4 = (297 * 96) / 25.4 - 2;
    if (page.scrollHeight > a4) page.style.zoom = (a4 / page.scrollHeight).toFixed(3);
  });
  addEventListener("afterprint", () => { document.getElementById("page").style.zoom = ""; fit(); });
  document.getElementById("printBtn").addEventListener("click", () => window.print());
})();
