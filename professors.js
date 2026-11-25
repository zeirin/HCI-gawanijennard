/* =========================================================
   GLITCHWAYVE — PROFESSORS (Help & Contact → Professors tab)
   Loaded after script.js and uses its helpers (state, icon, escapeHTML…).
   All names, schedules and rooms are FICTIONAL placeholders for the prototype.
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

  const PROFESSORS = [];
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
      PROFESSORS.push({ name: `Prof. ${name}`, email, depts: g.depts, classes, consult: pick(CONSULT), consultRoom: pick(ROOMS[g.depts[0]]) });
    }
  });
  PROFESSORS.sort((a, b) => a.name.localeCompare(b.name));

  const countFor = (key) => PROFESSORS.filter((p) => p.depts.includes(key)).length;
  const initials = (name) => name.replace("Prof. ", "").split(" ").map((w) => w[0]).slice(0, 2).join("");

  function renderProfCard(p) {
    return `
      <article class="card prof-card">
        <div class="row"><span class="prof-avatar" aria-hidden="true">${escapeHTML(initials(p.name))}</span>
          <div><h3 style="margin:0">${escapeHTML(p.name)}</h3>
            <div class="badges">${p.depts.map((d) => `<span class="badge badge-building">${icon(DEPT[d].icon)} ${escapeHTML(DEPT[d].label)}</span>`).join("")}</div></div></div>
        <ul class="prof-sched" aria-label="Class schedule">
          ${p.classes.map((c) => `<li><strong>${escapeHTML(DEPT[c.dept].label)}</strong>
            <span>${icon("calendar-days")} ${escapeHTML(c.days)} · ${escapeHTML(c.time)}</span>
            <span>${icon("map-pin")} ${escapeHTML(c.room)}</span></li>`).join("")}
        </ul>
        <div class="service-meta"><span>${icon("mail")} <a href="${gmailHref(p.email)}" target="_blank" rel="noopener">${escapeHTML(p.email)}</a>
            <button class="btn btn-sm btn-ghost" type="button" data-action="copy-email" data-email="${escapeHTML(p.email)}" aria-label="Copy ${escapeHTML(p.email)}">${icon("copy")}</button></span>
          <span>${icon("message-circle")} Consultation: ${escapeHTML(p.consult)} · ${escapeHTML(p.consultRoom)}</span></div>
        <div class="badges" style="margin-top:10px"><span class="badge badge-sample">Sample schedule</span></div>
      </article>`;
  }

  window.renderProfessorsTab = function () {
    const filter = state.profFilter || "all";
    const list = filter === "all" ? PROFESSORS : PROFESSORS.filter((p) => p.depts.includes(filter));
    const chip = (key, label, n) => `<button class="chip" type="button" data-action="prof-filter" data-filter="${key}" aria-pressed="${filter === key}">${label} <span class="muted">(${n})</span></button>`;
    return `
      <div class="chips prof-filters" role="group" aria-label="Filter professors by department">
        ${chip("all", "All", PROFESSORS.length)}
        ${DEPTS.map((d) => chip(d.key, `${icon(d.icon)} ${escapeHTML(d.label)}`, countFor(d.key))).join("")}
      </div>
      <p class="muted" style="margin:12px 0">Showing ${list.length} professor${list.length === 1 ? "" : "s"}. Names, emails, schedules and rooms are sample data for the prototype.</p>
      <div class="grid grid-2">${list.map(renderProfCard).join("")}</div>`;
  };
})();
