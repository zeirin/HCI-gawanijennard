/* =========================================================
   ASK GLITCHWAYVE — FAQ chatbot (no AI, no server, no keys)
   script.js calls window.GlitchWayveChatbot.open({ building, services, offices })
   when the "Ask GlitchWayve" button is pressed, after un-hiding #chatbotRoot.

   How it answers: it matches the words of the question against
     1. the hand-written FAQ list below (edit FAQ to add answers)
     2. the services and offices loaded from Supabase
     3. the User Manual topics in script.js (MANUAL)
   and shows the best match, plus a few related ones.
   Uses helpers from script.js: escapeHTML, icon, refreshIcons, state, MANUAL.
   ========================================================= */
(() => {
  // ---------- Hand-written answers. Add more here. ----------
  // keywords: words that point to this answer. answer: plain text (no HTML).
  // section (optional): page that the "Open page" button goes to.
  // Services, offices, floors and rooms are answered from the live database, so they are NOT repeated here.
  const FAQ = [
    // --- About GlitchWayve ---
    { q: "What is GlitchWayve?", keywords: ["glitchwayve", "what", "about", "dashboard", "app", "website", "purpose"],
      answer: "GlitchWayve is the CIIT student dashboard for the Interweave and Glitch Tower buildings. Use it to find services, see where rooms and offices are, send requests, book rooms, set appointments, borrow equipment and report lost items.", section: "home" },
    { q: "What can the Ask GlitchWayve chatbot answer?", keywords: ["chatbot", "bot", "ask", "assistant", "faq", "answer", "questions"],
      answer: "Ask me where a service, office, floor or room is in either building, what a service needs, or how to use a page on GlitchWayve. I answer from the same information the site shows. I can't submit anything for you." },
    { q: "How do I sign in to GlitchWayve?", keywords: ["sign", "login", "log", "account", "email", "password", "signin"],
      answer: "Sign in with your CIIT email (name@ciit.edu.ph) and your GlitchWayve password. FoundIt has its own separate login." },
    { q: "How do I sign out?", keywords: ["sign", "out", "logout", "log", "signout"],
      answer: "Open the profile menu at the top right and press Sign out. Always sign out on a shared computer." },
    { q: "How do I switch buildings?", keywords: ["switch", "change", "building", "interweave", "glitch", "tower", "campus"],
      answer: "Use the building switch at the top of the page to change between Interweave and Glitch Tower. Services, rooms and announcements change to match the building you pick. I always show both buildings when a service is in both." },
    { q: "How do I search for something?", keywords: ["search", "find", "look", "keyword", "service", "room", "office"],
      answer: "Use the search box at the top to find any service, room or office in both buildings. You can also open Find a Service and type a keyword such as transcript, clinic or Mac lab, then narrow it with the category chips.", section: "finder" },
    { q: "How do I replay the tutorial?", keywords: ["tutorial", "tour", "guide", "help", "learn", "how", "use", "manual", "instructions"],
      answer: "Press Tutorial at the top of the page any time to replay the guided tour. The User Manual has step-by-step help for every page, and each topic has a Show me on screen button.", section: "manual" },
    { q: "What does Sample details mean?", keywords: ["sample", "details", "verified", "accurate", "correct", "wrong", "badge"],
      answer: "A Sample details badge means that information has not been verified with CIIT yet. Check with the office before relying on it." },
    { q: "Is my building's colour scheme different?", keywords: ["colour", "color", "theme", "dark", "neon", "navy", "look"],
      answer: "Yes. Interweave uses CIIT navy and white. Glitch Tower uses charcoal with neon accents. The building name is always shown too.", section: "settings" },

    // --- Home and personalisation ---
    { q: "How do I pin or hide services in Quick access?", keywords: ["quick", "access", "pin", "unpin", "shortcut", "customize", "favorite", "hide"],
      answer: "On Home, press Customize in Quick access to pin the services you use most or hide ones you don't need. You can also open a service card and press Pin.", section: "home" },
    { q: "How do I hide an announcement?", keywords: ["announcement", "announcements", "news", "hide", "dismiss", "show", "hidden"],
      answer: "On Home, press Hide on an announcement to dismiss it. Press Show hidden to bring hidden ones back. Announcements are shown for the building you picked.", section: "home" },
    { q: "What does the bell icon mean?", keywords: ["bell", "notification", "notifications", "alert", "update", "dot", "new"],
      answer: "The bell shows updates when an office changes one of your requests. A dot means something is new." },
    { q: "How do I update my program and year level?", keywords: ["program", "course", "year", "level", "profile", "name", "settings", "update"],
      answer: "Open Settings and set your name, program and year level. Quick access uses them to suggest services for you.", section: "settings" },
    { q: "How do I change the text size or contrast?", keywords: ["text", "size", "font", "bigger", "smaller", "contrast", "accessibility", "read", "see"],
      answer: "Open Settings. You can make the text bigger or turn on high contrast.", section: "settings" },
    { q: "What happens if I'm offline?", keywords: ["offline", "internet", "connection", "wifi", "disconnected", "loading"],
      answer: "GlitchWayve shows a banner when you are offline. You can still read what's on screen, and it reloads when you're back online." },

    // --- Requests, appointments, bookings, borrowing ---
    { q: "How do I submit a request?", keywords: ["submit", "request", "apply", "form", "file", "document", "certificate"],
      answer: "Find the service (for example Request a Copy of School Records), open its card and press the request button. Write the details for the office, then submit. It starts as Submitted and you can follow it in My Requests.", section: "finder" },
    { q: "How do I track my request?", keywords: ["track", "request", "status", "progress", "pending", "approved", "update", "follow"],
      answer: "Open My Requests. It tracks your requests, appointments, room bookings, equipment and projects. Each card shows its status, a progress bar and what happens next.", section: "myrequests" },
    { q: "How do I cancel a request?", keywords: ["cancel", "withdraw", "undo", "remove", "mistake", "request", "booking", "appointment"],
      answer: "Open My Requests and press Cancel on the card. You can only cancel while its status is still Submitted.", section: "myrequests" },
    { q: "What do the request statuses mean?", keywords: ["status", "statuses", "submitted", "review", "approved", "ready", "pickup", "completed", "declined"],
      answer: "A request goes Submitted, then In review, Approved, Ready for pickup and Completed. It can also be Declined by the office or Cancelled by you.", section: "myrequests" },
    { q: "How do I set an appointment?", keywords: ["appointment", "schedule", "consult", "consultation", "meet", "slot", "doctor", "dentist", "guidance", "counseling"],
      answer: "Open a service that takes appointments, such as Consult with a Doctor or Guidance Appointment Scheduler. Pick a preferred date and time slot between 8:00 AM and 5:00 PM, add a reason if you like, and send it. The office confirms your slot.", section: "health" },
    { q: "How do I book a room?", keywords: ["book", "booking", "reserve", "reservation", "room", "space", "classroom", "meeting", "studio", "cubicle"],
      answer: "Open Book a Space, then choose the room, date, start and end time, and purpose. Rooms can be booked from 7:00 AM to 9:00 PM for up to 3 hours. GlitchWayve checks for conflicts, then Facilities approves or declines it.", section: "academics" },
    { q: "Which rooms can I book?", keywords: ["which", "rooms", "bookable", "available", "book", "reserve", "list"],
      answer: "Interweave: Studio Room 301, Mac Lab 302, Lecture Rooms 401 and 402, LRC Cubicles and Meeting Rooms 1 to 3. Glitch Tower: Lecture Rooms 601, 603, 604, 704, 804, 901 and 902. Bring your student ID and book at least 1 day ahead.", section: "moving" },
    { q: "How do I borrow equipment?", keywords: ["borrow", "equipment", "forge", "camera", "device", "tools", "rent", "loan"],
      answer: "Open the Innovation Hub to browse equipment from The Forge. Each card shows how many are available. Press Borrow, choose the quantity, pickup and return dates and the purpose, then submit. Wait for approval before pickup.", section: "innovation" },
    { q: "How do I submit a project to the Innovation Hub?", keywords: ["project", "idea", "submit", "innovation", "hub", "startup", "capstone", "work"],
      answer: "Open the Innovation Hub and press Submit a project. Add the title, type, description and team members. Your borrowing and project history is at the bottom of the page.", section: "innovation" },

    // --- PULSE, handbook, health ---
    { q: "What is PULSE in GlitchWayve?", keywords: ["pulse", "simulation", "practice", "concern", "report", "demo"],
      answer: "PULSE in GlitchWayve is a practice tool for reporting campus concerns. Nothing is sent to CIIT. To send a real concern, commendation or idea, use the official PULSE (formerly iTracker) from Find a Service.", section: "pulse" },
    { q: "How do I report a real campus concern?", keywords: ["concern", "complaint", "issue", "report", "problem", "itracker", "commend", "broken"],
      answer: "Use the official PULSE service (formerly iTracker), listed under Support in Find a Service. It handles concerns, commendations and ideas. Discipline-related complaints have their own form.", section: "support" },
    { q: "Where is the College Handbook?", keywords: ["handbook", "rules", "policy", "policies", "memo", "memoranda", "uniform", "dress"],
      answer: "Open College Handbook for the student handbook and official memoranda. A File not yet uploaded badge means that document hasn't been added yet.", section: "handbook" },
    { q: "What is Carehub?", keywords: ["carehub", "check", "checkin", "wellbeing", "health", "entry", "form", "clearance"],
      answer: "Carehub is CIIT's health and wellness platform, including the required wellbeing check-in for entry. Use the Carehub check-in button on Home to open it.", section: "health" },

    // --- Buildings and floors ---
    { q: "What is on each floor of Glitch Tower?", keywords: ["glitch", "tower", "floor", "floors", "directory", "map", "each", "every"],
      answer: "LG: Reception. UG: Plaza. 2F and 3F: off limits. 4F: Faculty, Clinic, Guidance Rooms and IT Department. 5F and 5M: Hallway. 6F: Lecture Rooms 601, 603, 604 and The Forge (602). 7F: Mac Labs 701 and 702, 3D Lab 703, Lecture Room 704. 8F: PC Labs 801 and 802, 3D Lab 803, Lecture Room 804. 9F: Lecture Rooms 901 and 902, Cafeteria. 10F and 11F: off limits.", section: "moving" },
    { q: "Where does the Glitch Tower elevator stop?", keywords: ["elevator", "lift", "stairs", "stop", "stops", "glitch", "tower"],
      answer: "The Glitch Tower elevator stops at LG, 5F, and 7F to 9F. Use the stairs for the other floors.", section: "moving" },
    { q: "Which floors are off limits?", keywords: ["off", "limits", "restricted", "allowed", "closed", "forbidden", "floor"],
      answer: "In Glitch Tower, 2F, 3F, 10F and 11F are off limits to students. Moving Around marks off-limits floors clearly. Follow campus safety instructions.", section: "moving" },
    { q: "What is on each floor of Interweave?", keywords: ["interweave", "building", "floor", "floors", "itw", "directory", "map", "each", "every"],
      answer: "1F: Waiting Area and Lobby. 2F: Library, Cafe, Admissions and Clinic. 3F: Studio, Mac Lab, Audio Room, Meeting Rooms, IT Department, Branding and Communications, and the Registrar Office. 4F: Faculty, the Light/Drawing Room and Lecture Rooms 401 and 402. 5F and 6F: Rooms. 7F: Cinema Lab, Bleachers, Facilities, Canteen, Shower Room and Lockers.", section: "moving" },
    { q: "Where can I eat?", keywords: ["eat", "food", "cafeteria", "canteen", "cafe", "lunch", "snack", "drink", "kain"],
      answer: "Interweave has a Cafe on 2F and a Canteen on 7F. Glitch Tower has a Cafeteria on 9F.", section: "moving" },
    { q: "Where can I study?", keywords: ["study", "quiet", "library", "lrc", "cubicle", "read", "review"],
      answer: "The Library is on 2F of Interweave and has study cubicles you can book. The Online Library is open 24/7. You can also book a meeting room through Book a Space.", section: "academics" },
    { q: "Where are the lockers and shower room?", keywords: ["locker", "lockers", "shower", "bath", "change", "clothes", "pe", "bleachers", "cinema"],
      answer: "The Lockers and Shower Room are on 7F of Interweave, with the Bleachers, Cinema Lab, Facilities and Canteen.", section: "moving" },

    // --- FoundIt ---
    { q: "I lost something. What do I do?", keywords: ["lost", "missing", "item", "wallet", "id", "bag", "phone", "left", "nawala"],
      answer: "Open FoundIt under Services. Browse the found items, or press Report an item to post what you lost. FoundIt uses its own account, the same one as the FoundIt mobile app.", section: "foundit" },
    { q: "I found something. How do I report it?", keywords: ["found", "report", "post", "item", "return", "owner", "pick"],
      answer: "Open FoundIt, press Report an item and choose Found. Add the item name, where you found it, a category, a photo if you can, and your CIIT email so the owner can reach you.", section: "foundit" },
    { q: "How do I claim an item on FoundIt?", keywords: ["claim", "mine", "owner", "proof", "foundit", "get", "back"],
      answer: "Open the item in FoundIt and press This is mine — claim it. Describe something only the owner would know. The poster sees your claim in the comments and presses Mark as claimed once it's returned.", section: "foundit" },
    { q: "Why does FoundIt ask for Google Authenticator?", keywords: ["authenticator", "2fa", "code", "verification", "two", "step", "foundit", "otp"],
      answer: "FoundIt uses two-step verification to protect accounts. Install Google Authenticator, scan the QR code when you sign up, and enter the 6-digit code each time you log in.", section: "foundit" },
    { q: "I forgot my FoundIt password.", keywords: ["forgot", "password", "reset", "foundit", "change"],
      answer: "On the FoundIt login screen, press Forgot password?. Enter your school email, then enter the emailed code, your new password and your Google Authenticator code.", section: "foundit" },

    // --- Contact ---
    { q: "Who do I contact for help?", keywords: ["contact", "help", "email", "office", "phone", "call", "reach", "directory"],
      answer: "Open Help & Contact to see every office with its location, hours and email. You can copy an email address with one click.", section: "directory" }
  ];

  // Words that mean the same thing, so "TOR" finds "transcript" and so on. Use a list for several words.
  const SYNONYMS = {
    tor: ["transcript", "records"], grades: "grade", cor: "registration", enroll: "enrollment", enrolment: "enrollment",
    clinic: "health", nurse: "health", doctor: "health", sick: "health", counselor: "guidance", counseling: "guidance",
    wifi: "it", internet: "it", laptop: "it", computer: "it", where: "location", room: "location",
    borrow: "equipment", forge: "equipment", ojt: "practicum", internship: "practicum", job: "careers", pass: "password"
  };
  const STOP = new Set("a an and are at be can do does for from how i in is me my of on or the to what when where which who why with you your please pls po ba ko ang ng sa".split(" "));

  const bot = { root: null, ctx: null, history: [] };

  // ---------- Matching ----------
  function words(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w && !STOP.has(w))
      .flatMap((w) => [w, ...[].concat(SYNONYMS[w] || [])]);
  }
  /** Score one candidate: words in its title count more than words in its body. */
  function score(qWords, title, body) {
    const t = words(title), b = words(body);
    let s = 0;
    for (const w of qWords) {
      if (t.includes(w)) s += 3;
      else if (w.length > 3 && t.some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))) s += 2;
      else if (b.some((x) => x === w || (w.length > 3 && x.startsWith(w)))) s += 1; // "transcript" also matches "transcripts"
    }
    return s;
  }

  function candidates() {
    const { services = [], offices = [], building } = bot.ctx || {};
    const manual = typeof MANUAL !== "undefined" ? MANUAL.filter((m) => !m.staffOnly) : [];
    return [
      ...FAQ.map((f) => ({ kind: "faq", title: f.q, body: f.keywords.join(" ") + " " + f.answer, item: f })),
      // Prefer the current building's copy of a service, but keep the other one findable.
      ...services.map((s) => ({ kind: "service", title: s.name, body: [s.category, s.description, s.office_key, s.area_name].join(" "), item: s,
        bonus: s.building_key === building ? 0.5 : 0 })),
      ...offices.map((o) => ({ kind: "office", title: o.name, body: [o.office_key, "office contact email hours location"].join(" "), item: o,
        bonus: o.building_key === building ? 0.5 : 0 })),
      ...manual.map((m) => ({ kind: "manual", title: m.title, body: m.steps.join(" "), item: m })),
      ...(bot.places?.floors || []).map((f) => ({ kind: "floor", title: `${bName(f.building_key)} ${f.floor_label}`, item: f,
        body: ["floor", f.area_name, f.is_off_limits ? "off limits" : "", ...roomsOn(f).map((r) => r.name)].join(" ") })),
      ...(bot.places?.rooms || []).map((r) => ({ kind: "room", title: r.name, item: r,
        body: ["room location", r.room_number, r.room_type, r.purpose, floorOf(r)?.floor_label, bName(r.building_key), r.is_bookable ? "book" : ""].join(" ") }))
    ];
  }

  // ---------- Floors and rooms (both buildings, loaded once from the database) ----------
  const bName = (k) => typeof buildingName === "function" ? buildingName(k) : k;
  const floorOf = (r) => (bot.places?.floors || []).find((f) => f.id === r.floor_id);
  const roomsOn = (f) => (bot.places?.rooms || []).filter((r) => r.floor_id === f.id);
  async function loadPlaces() {
    if (bot.places || bot.loadingPlaces || typeof getFloorsAndRooms !== "function") return;
    bot.loadingPlaces = true;
    try {
      const both = await Promise.all(["interweave", "glitch"].map((b) => getFloorsAndRooms(b)));
      bot.places = { floors: both.flatMap((x) => x.floors), rooms: both.flatMap((x) => x.rooms) };
    } catch (e) {
      console.warn("[Chatbot] floors and rooms not loaded; will retry next time", e);
    } finally {
      bot.loadingPlaces = false;
    }
  }

  function search(question) {
    const q = words(question);
    if (!q.length) return [];
    const seen = new Set();
    return candidates()
      // A typed room number ("703") points straight at that room.
      .map((c) => ({ ...c, score: score(q, c.title, c.body) + (c.bonus || 0)
        + (c.kind === "room" && q.includes(String(c.item.room_number).toLowerCase()) ? 4 : 0) }))
      .filter((c) => c.score >= 2)
      .sort((a, b) => b.score - a.score)
      .filter((c) => { const k = c.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 4);
  }

  // ---------- Answers as HTML ----------
  const where = (x) => typeof locationLine === "function" ? locationLine(x)
    : [x.room_number, x.floor_label].filter(Boolean).join(", ");

  function answerHTML(c) {
    const e = escapeHTML;
    if (c.kind === "faq") {
      return `<p>${e(c.item.answer)}</p>${c.item.section ? pageBtn(c.item.section) : ""}`;
    }
    if (c.kind === "service") {
      const s = c.item;
      // Every building's copy of this service, current building first.
      const copies = (bot.ctx.services || []).filter((x) => s.service_code ? x.service_code === s.service_code : x.name === s.name)
        .sort((a, b) => (b.building_key === bot.ctx.building) - (a.building_key === bot.ctx.building));
      const bName = (k) => typeof buildingName === "function" ? buildingName(k) : k;
      return `
        <p><strong>${e(s.name)}</strong>${s.category ? ` · ${e(s.category)}` : ""}</p>
        ${s.description ? `<p>${e(s.description)}</p>` : ""}
        ${(copies.length ? copies : [s]).map((x) => `
          <p class="cb-building">${icon("building-2")} ${e(bName(x.building_key))}</p>
          <ul class="cb-facts">
            ${[x.floor_label, x.room_number, x.area_name].some(Boolean) ? `<li>${icon("map-pin")} ${e([x.floor_label, x.room_number, x.area_name].filter(Boolean).join(" · "))}</li>` : ""}
            ${x.hours ? `<li>${icon("clock")} ${e(x.hours)}</li>` : ""}
          </ul>`).join("")}
        ${s.processing_time ? `<ul class="cb-facts"><li>${icon("timer")} ${e(s.processing_time)}</li></ul>` : ""}
        <button class="btn btn-sm btn-primary" type="button" data-action="open-service" data-id="${e((copies[0] || s).id)}">${icon("arrow-right")} See full details</button>`;
    }
    if (c.kind === "office") {
      const o = c.item;
      return `
        <p><strong>${e(o.name)}</strong></p>
        <ul class="cb-facts">
          ${where(o) ? `<li>${icon("map-pin")} ${e(where(o))}</li>` : ""}
          ${o.hours ? `<li>${icon("clock")} ${e(o.hours)}</li>` : ""}
          ${o.email ? `<li>${icon("mail")} <a href="mailto:${e(o.email)}">${e(o.email)}</a></li>` : ""}
        </ul>
        ${otherBuildings(o)}
        ${pageBtn("directory", "Open Help & Contact")}`;
    }
    if (c.kind === "floor") {
      const f = c.item, rooms = roomsOn(f);
      return `
        <p><strong>${e(c.title)}</strong>${f.area_name ? ` · ${e(f.area_name)}` : ""}</p>
        ${f.is_off_limits ? `<p class="cb-note">${icon("ban")} This floor is off limits to students.</p>` : ""}
        ${rooms.length ? `<ul class="cb-facts">${rooms.map((r) => `<li>${icon("door-open")} ${e(r.name)}</li>`).join("")}</ul>` : ""}
        ${pageBtn("moving", "Open Moving Around")}`;
    }
    if (c.kind === "room") {
      const r = c.item, f = floorOf(r);
      return `
        <p><strong>${e(r.name)}</strong>${r.room_type ? ` · ${e(r.room_type)}` : ""}</p>
        <ul class="cb-facts">
          <li>${icon("map-pin")} ${e([bName(r.building_key), f?.floor_label, r.room_number].filter(Boolean).join(" · "))}</li>
          ${r.hours ? `<li>${icon("clock")} ${e(r.hours)}</li>` : ""}
          ${r.capacity ? `<li>${icon("users")} Up to ${e(r.capacity)} people</li>` : ""}
          ${r.is_bookable ? `<li>${icon("calendar-check")} Bookable through Book a Space${r.requirements ? `. ${e(r.requirements)}` : ""}</li>` : ""}
        </ul>
        ${pageBtn("moving", "Open Moving Around")}`;
    }
    const m = c.item;
    return `<p><strong>${e(m.title)}</strong></p><ol class="cb-steps">${m.steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>${pageBtn(m.section)}`;
  }
  /** Offices exist in one building, but their services may run in the other one too: list those places. */
  function otherBuildings(o) {
    const places = new Map();
    for (const s of bot.ctx.services || []) {
      if (s.office_key !== o.office_key || s.building_key === o.building_key) continue;
      const spot = [s.floor_label, s.room_number].filter(Boolean).join(" · ");
      if (spot) places.set(`${s.building_key}|${spot}`, [s.building_key, spot]);
    }
    const bName = (k) => typeof buildingName === "function" ? buildingName(k) : k;
    return [...places.values()].map(([b, spot]) =>
      `<p class="cb-building">${icon("building-2")} Also in ${escapeHTML(bName(b))}</p><ul class="cb-facts"><li>${icon("map-pin")} ${escapeHTML(spot)}</li></ul>`).join("");
  }
  function pageBtn(section, label = "Open page") {
    return `<button class="btn btn-sm" type="button" data-section="${escapeHTML(section)}">${icon("arrow-right")} ${escapeHTML(label)}</button>`;
  }

  function reply(question) {
    const found = search(question);
    if (!found.length) {
      return `<p>Sorry, I don't have an answer for that yet.</p>
        <p class="muted">Try other words, search for a service, or ask an office directly.</p>
        <div class="cb-chips">${suggestionChips()}</div>
        ${pageBtn("directory", "Open Help & Contact")}`;
    }
    const [best, ...more] = found;
    return answerHTML(best) + (more.length
      ? `<p class="cb-related">Related:</p><div class="cb-chips">${more.map((c) => chip(c.title)).join("")}</div>` : "");
  }
  const chip = (text) => `<button class="chip" type="button" data-cb-ask="${escapeHTML(text)}">${escapeHTML(text)}</button>`;
  const suggestionChips = () => ["I lost something", "Where is the clinic?", "How do I track my request?", "Who do I contact for help?"].map(chip).join("");

  // ---------- Panel ----------
  function addMessage(who, html) {
    bot.history.push({ who, html });
    const log = bot.root.querySelector(".cb-log");
    const div = document.createElement("div");
    div.className = `cb-msg cb-${who}`;
    div.innerHTML = html;
    log.appendChild(div);
    refreshIcons();
    log.scrollTop = log.scrollHeight;
  }

  function ask(text) {
    text = String(text || "").trim().slice(0, 200);
    if (!text) return;
    addMessage("user", `<p>${escapeHTML(text)}</p>`);
    addMessage("bot", reply(text));
  }

  function build() {
    bot.root.innerHTML = `
      <section class="cb-panel" role="dialog" aria-label="Ask GlitchWayve">
        <header class="cb-head">
          ${icon("message-circle-question")}
          <div><h2>Ask GlitchWayve</h2><p>Quick answers about services and this site</p></div>
          <button class="icon-button" type="button" data-cb="close" aria-label="Close chat">${icon("x")}</button>
        </header>
        <div class="cb-log" aria-live="polite"></div>
        <form class="cb-form" novalidate>
          <label class="sr-only" for="cbInput">Type your question</label>
          <input id="cbInput" type="text" maxlength="200" autocomplete="off" placeholder="Type your question">
          <button class="btn btn-primary" type="submit" aria-label="Send">${icon("send")}</button>
        </form>
      </section>`;
    bot.root.addEventListener("click", onClick);
    bot.root.querySelector(".cb-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      ask(input.value);
      input.value = "";
    });
    bot.root.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    addMessage("bot", `<p>Hi! Ask me where a service is, how to do something on GlitchWayve, or who to contact.</p><div class="cb-chips">${suggestionChips()}</div>`);
  }

  function onClick(e) {
    const askBtn = e.target.closest("[data-cb-ask]");
    if (askBtn) return ask(askBtn.dataset.cbAsk);
    if (e.target.closest('[data-cb="close"]')) return close();
    // On phones the panel covers the page, so close it when a link to a page is followed.
    if (e.target.closest("[data-section], [data-action]") && window.matchMedia("(max-width: 640px)").matches) close();
  }

  function close() {
    bot.root.hidden = true;
    document.getElementById("chatbotLauncher")?.focus();
  }

  window.GlitchWayveChatbot = {
    open(ctx) {
      bot.ctx = ctx || {};
      bot.root = document.getElementById("chatbotRoot");
      if (!bot.root.querySelector(".cb-panel")) build();
      bot.root.hidden = false;
      loadPlaces();
      bot.root.querySelector("#cbInput").focus();
    },
    close
  };
})();
