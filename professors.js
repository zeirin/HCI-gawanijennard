/* =========================================================
   GLITCHWAYVE — PROFESSORS (Help & Contact → Professors tab)
   Loaded after script.js and uses its helpers (state, icon, escapeHTML…).
   The list lives in the Supabase "professors" table (run sql/professors.sql once).
   Admins add, edit and remove professors in Admin Panel -> Professors.
   Until the table exists, the built-in SAMPLE list below is shown (fictional names,
   schedules and rooms; admins can load it into the table with one click).
   ========================================================= */
(() => {
  const DEPTS = [
    { key: "techno", label: "Technopreneurship", icon: "rocket" },
    { key: "pe", label: "Physical Education", icon: "dumbbell" },
    { key: "nstp", label: "NSTP", icon: "flag" },
    { key: "is", label: "Information Systems", icon: "database" },
    { key: "cs", label: "Computer Science", icon: "code" },
    { key: "arts", label: "Arts", icon: "palette" },
    { key: "emc", label: "EMC", icon: "clapperboard" },
    { key: "gened", label: "General Education", icon: "book-open" }
  ];
  const DEPT = Object.fromEntries(DEPTS.map((d) => [d.key, d]));

  // Who teaches where. 18 IS profs also teach CS and EMC; 2 more teach only CS and EMC
  // → CS = 20, EMC = 20, IS = 18.
  const GROUPS = [
    { count: 18, depts: ["is", "cs", "emc"] },
    { count: 2, depts: ["cs", "emc"] },
    { count: 3, depts: ["techno"] },
    { count: 6, depts: ["pe"] },
    { count: 1, depts: ["nstp"] },
    { count: 49, depts: ["arts"] },
    { count: 28, depts: ["gened"] }
  ];

  const FIRST = ["Andrea", "Benjie", "Carmela", "Dante", "Elaine", "Francis", "Gail", "Hector", "Isabel", "Jomar", "Katrina", "Leo",
    "Mika", "Nestor", "Olivia", "Paolo", "Queenie", "Rafael", "Sheila", "Tristan", "Ursula", "Vince", "Wena", "Xander", "Yna", "Zaldy",
    "Bea", "Carlo", "Diane", "Enzo", "Faye", "Gino", "Hazel", "Ivan", "Joy", "Kevin", "Lara", "Marco", "Nina", "Oscar"];
  const LAST = ["Abrenica", "Bautista", "Cabrera", "Dimaculangan", "Estrella", "Fajardo", "Galvez", "Hernandez", "Ilagan", "Jacinto",
    "Lacson", "Magbanua", "Navarro", "Ocampo", "Pangilinan", "Quizon", "Ramos", "Salonga", "Tolentino", "Umali", "Valdez", "Villareal",
    "Yap", "Zamora", "Agustin", "Buenaventura", "Castillo", "Dela Rosa", "Evangelista", "Flores", "Gonzaga", "Lim", "Macaraeg", "Soriano"];

  const DAY_PAIRS = ["Mon & Wed", "Tue & Thu", "Mon & Thu", "Tue & Fri", "Wed & Fri", "Sat"];
  const SLOTS = ["7:30 – 9:00 AM", "9:00 – 10:30 AM", "10:30 AM – 12:00 NN", "1:00 – 2:30 PM", "2:30 – 4:00 PM", "4:00 – 5:30 PM", "5:30 – 7:00 PM"];
  const CONSULT = ["Mon 12:00 – 1:00 PM", "Tue 4:00 – 5:00 PM", "Wed 12:00 – 1:00 PM", "Thu 11:00 AM – 12:00 NN", "Fri 3:00 – 4:00 PM"];
  const ROOMS = {
    techno: ["IW 305", "IW 306", "GT 701"],
    pe: ["IW Gym", "IW Dance Studio", "GT Multipurpose Hall"],
    nstp: ["IW 201", "GT 502"],
    is: ["GT 801", "GT 802", "GT Lab 3", "GT Lab 4"],
    cs: ["GT 803", "GT Lab 1", "GT Lab 2", "GT 805"],
    arts: ["IW Studio A", "IW Studio B", "IW 402", "IW 403", "IW Drawing Room", "GT 601"],
    emc: ["GT Mac Lab", "GT Sound Room", "GT Green Room", "GT 604"],
    gened: ["IW 202", "IW 203", "IW 204", "IW 301", "GT 501", "GT 503"]
  };

  // Seeded random so every visit shows the same fictional faculty.
  let seed = 20261125;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const usedNames = new Set();
  function uniqueName() {
    let name;
    do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (usedNames.has(name));
    usedNames.add(name);
    return name;
  }

  const SAMPLE = [];
  GROUPS.forEach((g) => {
    for (let i = 0; i < g.count; i++) {
      const classes = [];
      const usedTimes = new Set();
      // One class per department they teach (two if they only teach one)
      const teaching = g.depts.length === 1 ? [g.depts[0], g.depts[0]] : g.depts;
      teaching.forEach((dk) => {
        let days, time;
        do { days = pick(DAY_PAIRS); time = pick(SLOTS); } while (usedTimes.has(days + time));
        usedTimes.add(days + time);
        classes.push({ dept: dk, days, time, room: pick(ROOMS[dk]) });
      });
      const name = uniqueName();
      const email = `${name.toLowerCase().replace(" ", ".").replace(/\s+/g, "")}@ciit.edu.ph`; // first.lastname
      SAMPLE.push({ name: `Prof. ${name}`, email, departments: g.depts, classes,
        consultation: `${pick(CONSULT)} · ${pick(ROOMS[g.depts[0]])}` });
    }
  });
  SAMPLE.sort((a, b) => a.name.localeCompare(b.name));

  // ---------- Data ----------
  const cache = { list: null, fromDb: false, error: null };
  /** Professors from Supabase. Falls back to SAMPLE if the table hasn't been created yet. */
  async function getProfessors(force = false) {
    if (cache.list && !force) return cache;
    const { data, error } = await supabaseClient.from("professors").select("*").order("name");
    if (error) { console.warn("professors table not available, showing sample list:", error.message); cache.list = SAMPLE; cache.fromDb = false; cache.error = error; }
    else { cache.list = data; cache.fromDb = true; cache.error = null; }
    return cache;
  }

  const initials = (name) => name.replace(/^Prof\.\s*/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const deptBadges = (p) => (p.departments || []).filter((d) => DEPT[d]).map((d) => `<span class="badge badge-building">${icon(DEPT[d].icon)} ${escapeHTML(DEPT[d].label)}</span>`).join("");

  // ---------- Help & Contact → Professors ----------
  function renderProfCard(p) {
    const classes = (p.classes || []).filter((c) => DEPT[c.dept]);
    return `
      <article class="card prof-card">
        <div class="row"><span class="prof-avatar" aria-hidden="true">${escapeHTML(initials(p.name))}</span>
          <div><h3 style="margin:0">${escapeHTML(p.name)}</h3><div class="badges">${deptBadges(p)}</div></div></div>
        ${classes.length ? `<ul class="prof-sched" aria-label="Class schedule">
          ${classes.map((c) => `<li><strong>${escapeHTML(DEPT[c.dept].label)}</strong>
            <span>${icon("calendar-days")} ${escapeHTML([c.days, c.time].filter(Boolean).join(" · ") || "Schedule to follow")}</span>
            ${c.room ? `<span>${icon("map-pin")} ${escapeHTML(c.room)}</span>` : ""}</li>`).join("")}
        </ul>` : `<p class="muted" style="margin:12px 0">Class schedule not yet added.</p>`}
        <div class="service-meta">
          ${p.email ? `<span>${icon("mail")} <a href="${gmailHref(p.email)}" target="_blank" rel="noopener">${escapeHTML(p.email)}</a>
            <button class="btn btn-sm btn-ghost" type="button" data-action="copy-email" data-email="${escapeHTML(p.email)}" aria-label="Copy ${escapeHTML(p.email)}">${icon("copy")}</button></span>` : ""}
          ${p.consultation ? `<span>${icon("message-circle")} Consultation: ${escapeHTML(p.consultation)}</span>` : ""}</div>
        <div class="badges" style="margin-top:10px"><span class="badge badge-sample">Sample schedule</span></div>
      </article>`;
  }

  async function renderProfessorsTab() {
    const { list: all } = await getProfessors();
    const filter = state.profFilter || "all";
    const list = filter === "all" ? all : all.filter((p) => (p.departments || []).includes(filter));
    const countFor = (key) => all.filter((p) => (p.departments || []).includes(key)).length;
    const chip = (key, label, n) => `<button class="chip" type="button" data-action="prof-filter" data-filter="${key}" aria-pressed="${filter === key}">${label} <span class="muted">(${n})</span></button>`;
    return `
      <div class="chips prof-filters" role="group" aria-label="Filter professors by department">
        ${chip("all", "All", all.length)}
        ${DEPTS.map((d) => chip(d.key, `${icon(d.icon)} ${escapeHTML(d.label)}`, countFor(d.key))).join("")}
      </div>
      <p class="muted" style="margin:12px 0">Showing ${list.length} professor${list.length === 1 ? "" : "s"}. Names, emails, schedules and rooms are sample data for the prototype.</p>
      ${list.length ? `<div class="grid grid-2">${list.map(renderProfCard).join("")}</div>`
        : renderEmptyState("No professors here yet", "No professor is listed under this department.", "graduation-cap")}`;
  }

  // ---------- Admin Panel → Professors ----------
  async function renderAdminTab() {
    const { list, fromDb, error } = await getProfessors(true);
    if (!fromDb && error?.code === "42501") return `<section class="card"><h3 style="margin-top:0">${icon("lock")} The professors table needs permissions</h3>
      <p>The table exists, but signed-in users aren't allowed to read it yet. Run the latest <code>sql/professors.sql</code> again in Supabase → SQL Editor
      (it adds <code>grant select, insert, update, delete on professors to authenticated</code>), then reload this page.</p></section>`;
    if (!fromDb) return `<section class="card"><h3 style="margin-top:0">${icon("database")} One-time setup needed</h3>
      <p>To add and remove professors, run <code>sql/professors.sql</code> in Supabase → SQL Editor. It creates the professors table.
      Then come back here to load the ${SAMPLE.length} sample professors students see now.</p></section>`;
    return `
      <div class="row" style="margin-bottom:12px"><p class="muted" style="margin:0">${list.length} professor${list.length === 1 ? "" : "s"}. Changes show in Help &amp; Contact right away.</p>
        <span class="spacer"></span><button class="btn btn-primary" type="button" data-action="prof-add">${icon("plus")} Add professor</button></div>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Professor</th><th>Departments</th><th>Email</th><th>Classes</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr><td><strong>${escapeHTML(p.name)}</strong>${p.consultation ? `<br><small class="muted">Consultation: ${escapeHTML(p.consultation)}</small>` : ""}</td>
          <td><div class="badges">${deptBadges(p)}</div></td>
          <td>${escapeHTML(p.email || "—")}</td>
          <td><small>${(p.classes || []).map((c) => escapeHTML([DEPT[c.dept]?.label, c.days, c.time, c.room].filter(Boolean).join(" · "))).join("<br>") || "—"}</small></td>
          <td><div class="prof-row-actions">
            <button class="btn btn-sm btn-primary" type="button" data-action="prof-edit" data-id="${escapeHTML(p.id)}" aria-label="Edit ${escapeHTML(p.name)}">${icon("pencil")} Edit</button>
            <button class="btn btn-sm btn-ghost prof-remove" type="button" data-action="prof-delete" data-id="${escapeHTML(p.id)}" aria-label="Remove ${escapeHTML(p.name)}">${icon("trash-2")} Remove</button></div></td></tr>`).join("")}
      </tbody></table></div>` : renderEmptyState("No professors yet", `Press Add professor, or load the ${SAMPLE.length} sample professors to start from.`, "graduation-cap",
        `<button class="btn" type="button" data-action="prof-seed">${icon("download")} Load sample professors</button>`)}`;
  }

  const deptOptions = (sel = "") => DEPTS.map((d) => `<option value="${d.key}" ${d.key === sel ? "selected" : ""}>${escapeHTML(d.label)}</option>`).join("");
  const attr = (v) => escapeHTML(v || "");
  function classRow(n, c = {}) {
    return `<fieldset class="prof-class-row"><legend>Class ${n} <small class="muted">(optional)</small></legend>
      <div class="form-row">
        <div class="field"><label for="pcDept${n}">Department</label><select id="pcDept${n}" name="c_dept"><option value="">—</option>${deptOptions(c.dept)}</select></div>
        <div class="field"><label for="pcDays${n}">Days</label><input id="pcDays${n}" name="c_days" type="text" placeholder="Mon &amp; Wed" value="${attr(c.days)}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="pcTime${n}">Time</label><input id="pcTime${n}" name="c_time" type="text" placeholder="9:00 – 10:30 AM" value="${attr(c.time)}"></div>
        <div class="field"><label for="pcRoom${n}">Room</label><input id="pcRoom${n}" name="c_room" type="text" placeholder="GT 801" value="${attr(c.room)}"></div>
      </div></fieldset>`;
  }
  /** Add (no professor given) or edit (professor given) — same form. */
  function openProfDialog(p = null) {
    const classes = p?.classes || [];
    const slots = Math.max(3, classes.length);
    showDialog(p ? `Edit: ${p.name}` : "Add professor", `
      <form data-form="prof-save" ${p ? `data-id="${attr(p.id)}"` : ""} novalidate>
        <div class="field"><label for="pName">Full name</label><input id="pName" name="name" type="text" placeholder="Prof. Juan Dela Cruz" value="${attr(p?.name)}" required></div>
        <div class="field"><label for="pEmail">Email</label><input id="pEmail" name="email" type="email" placeholder="name@ciit.edu.ph" value="${attr(p?.email)}"></div>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend style="font-weight:600;margin-bottom:6px">Departments</legend>
          <div class="prof-dept-checks">${DEPTS.map((d) => `<label class="checkbox-row"><input type="checkbox" name="departments" value="${d.key}" ${(p?.departments || []).includes(d.key) ? "checked" : ""}> ${escapeHTML(d.label)}</label>`).join("")}</div></fieldset>
        ${Array.from({ length: slots }, (_, i) => classRow(i + 1, classes[i])).join("")}
        <div class="field"><label for="pConsult">Consultation hours</label><input id="pConsult" name="consultation" type="text" placeholder="Wed 12:00 – 1:00 PM · IW 402" value="${attr(p?.consultation)}"></div>
        <p class="form-error" id="profFormError" role="alert"></p>
        <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${p ? "Save changes" : "Add professor"}</button></div>
      </form>`, { wide: true });
  }
  async function saveProfessor(form) {
    const f = form.elements;
    const id = form.dataset.id;
    const err = (msg) => { document.getElementById("profFormError").textContent = msg; };
    let name = f.name.value.trim();
    const email = f.email.value.trim();
    const departments = [...form.querySelectorAll('[name="departments"]:checked')].map((x) => x.value);
    if (!name) return err("Enter the professor's name.");
    if (!departments.length) return err("Tick at least one department.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Check the email address.");
    if (!/^prof\.?\s/i.test(name)) name = `Prof. ${name}`;
    const classes = [...form.querySelectorAll(".prof-class-row")].map((r) => ({
      dept: r.querySelector('[name="c_dept"]').value, days: r.querySelector('[name="c_days"]').value.trim(),
      time: r.querySelector('[name="c_time"]').value.trim(), room: r.querySelector('[name="c_room"]').value.trim()
    })).filter((c) => c.dept);
    const row = { name, email: email || null, departments, classes, consultation: f.consultation.value.trim() || null };
    if (id) {
      // .select() so a change blocked by permissions (0 rows updated) is reported instead of silently ignored
      const { data, error } = await supabaseClient.from("professors").update(row).eq("id", id).select();
      if (error || !data?.length) return err("Couldn't save the changes. Only admin accounts can do this.");
    } else {
      const { error } = await supabaseClient.from("professors").insert(row);
      if (error) return err("Couldn't add the professor. Only admin accounts can do this.");
    }
    cache.list = null;
    closeDialog(); showToast(id ? `${name} updated.` : `${name} added.`); renderCurrentPage();
  }

  // ---------- Clicks and forms (capture phase, like campus.js) ----------
  document.addEventListener("click", async (event) => {
    const t = event.target.closest("[data-action]");
    if (!t || !["prof-add", "prof-edit", "prof-delete", "prof-seed"].includes(t.dataset.action)) return;
    event.stopPropagation();
    if (!isStaff()) return showToast("Only admin accounts can do that.", true);
    if (t.dataset.action === "prof-add") return openProfDialog();
    if (t.dataset.action === "prof-edit") return openProfDialog(cache.list?.find((x) => String(x.id) === t.dataset.id));
    if (t.dataset.action === "prof-seed") {
      t.disabled = true;
      const { error } = await supabaseClient.from("professors").insert(SAMPLE);
      if (error) { t.disabled = false; return showToast("Couldn't load the sample list. Only admin accounts can do this.", true); }
      cache.list = null;
      showToast(`${SAMPLE.length} sample professors loaded.`); return renderCurrentPage();
    }
    if (!confirmInline(t, "Tap again to remove")) return;
    const { data, error } = await supabaseClient.from("professors").delete().eq("id", t.dataset.id).select();
    if (error || !data?.length) return showToast("Couldn't remove the professor. Only admin accounts can do this.", true);
    cache.list = null;
    showToast(`${data[0].name} removed.`); renderCurrentPage();
  }, true);
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.dataset?.form !== "prof-save") return;
    event.preventDefault(); event.stopPropagation();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try { await saveProfessor(form); } finally { submit.disabled = false; }
  }, true);

  window.Professors = { renderProfessorsTab, renderAdminTab, SAMPLE };
})();
