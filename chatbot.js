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
  const FAQ = [
    { q: "What is GlitchWayve?", keywords: ["glitchwayve", "what", "about", "dashboard", "app", "website"],
      answer: "GlitchWayve is the CIIT student dashboard for the Interweave and Glitch Tower buildings. Use it to find services, see where offices are, track your requests and report lost items.", section: "home" },
    { q: "How do I switch buildings?", keywords: ["switch", "building", "interweave", "glitch", "tower", "campus"],
      answer: "Use the building switch at the top of the page to change between Interweave and Glitch Tower. Services, rooms and announcements change to match the building you pick." },
    { q: "I lost something. What do I do?", keywords: ["lost", "found", "foundit", "missing", "item", "wallet", "id", "bag", "phone", "left"],
      answer: "Open FoundIt under Services. Browse the found items, or press Report an item to post what you lost. FoundIt uses its own account, the same one as the FoundIt mobile app.", section: "foundit" },
    { q: "I forgot my FoundIt password.", keywords: ["forgot", "password", "reset", "foundit", "change"],
      answer: "On the FoundIt login screen, press Forgot password?. Enter your school email, then enter the emailed code, your new password and your Google Authenticator code.", section: "foundit" },
    { q: "How do I track my request?", keywords: ["track", "request", "status", "progress", "pending", "approved", "pickup", "cancel"],
      answer: "Open My Requests. Each request shows its status, a progress bar and what happens next. You can cancel one while it is still Submitted.", section: "myrequests" },
    { q: "Who do I contact for help?", keywords: ["contact", "help", "email", "office", "phone", "call", "reach", "support"],
      answer: "Open Help & Contact to see every office with its room, hours and email.", section: "directory" },
    { q: "How do I change the text size or contrast?", keywords: ["text", "size", "font", "bigger", "contrast", "accessibility", "read"],
      answer: "Open Settings. You can make the text bigger or turn on high contrast.", section: "settings" },
    { q: "How do I sign out?", keywords: ["sign", "out", "logout", "log"],
      answer: "Open the profile menu at the top right and press Sign out. Always sign out on a shared computer." }
  ];

  // Words that mean the same thing, so "TOR" finds "transcript" and so on.
  const SYNONYMS = {
    tor: "transcript", grades: "grade", cor: "registration", enroll: "enrollment", enrolment: "enrollment",
    clinic: "health", nurse: "health", doctor: "health", sick: "health", counselor: "guidance", counseling: "guidance",
    wifi: "it", internet: "it", laptop: "it", computer: "it", lost: "found", where: "location", room: "location",
    borrow: "equipment", forge: "equipment", ojt: "practicum", internship: "practicum", job: "careers", pass: "password"
  };
  const STOP = new Set("a an and are at be can do does for from how i in is me my of on or the to what when where which who why with you your please pls po ba ko ang ng sa".split(" "));

  const bot = { root: null, ctx: null, history: [] };

  // ---------- Matching ----------
  function words(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w && !STOP.has(w))
      .flatMap((w) => SYNONYMS[w] ? [w, SYNONYMS[w]] : [w]);
  }
  /** Score one candidate: words in its title count more than words in its body. */
  function score(qWords, title, body) {
    const t = words(title), b = words(body);
    let s = 0;
    for (const w of qWords) {
      if (t.includes(w)) s += 3;
      else if (w.length > 3 && t.some((x) => x.startsWith(w) || w.startsWith(x))) s += 2;
      else if (b.includes(w)) s += 1;
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
      ...manual.map((m) => ({ kind: "manual", title: m.title, body: m.steps.join(" "), item: m }))
    ];
  }

  function search(question) {
    const q = words(question);
    if (!q.length) return [];
    const seen = new Set();
    return candidates()
      .map((c) => ({ ...c, score: score(q, c.title, c.body) + (c.bonus || 0) }))
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
      const other = s.building_key && bot.ctx.building && s.building_key !== bot.ctx.building
        ? `<p class="cb-note">${icon("building")} This one is at ${e(typeof buildingName === "function" ? buildingName(s.building_key) : s.building_key)}.</p>` : "";
      return `
        <p><strong>${e(s.name)}</strong>${s.category ? ` · ${e(s.category)}` : ""}</p>
        ${s.description ? `<p>${e(s.description)}</p>` : ""}
        ${other}
        <ul class="cb-facts">
          ${where(s) ? `<li>${icon("map-pin")} ${e(where(s))}</li>` : ""}
          ${s.hours ? `<li>${icon("clock")} ${e(s.hours)}</li>` : ""}
          ${s.processing_time ? `<li>${icon("timer")} ${e(s.processing_time)}</li>` : ""}
        </ul>
        <button class="btn btn-sm btn-primary" type="button" data-action="open-service" data-id="${e(s.id)}">${icon("arrow-right")} See full details</button>`;
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
        ${pageBtn("directory", "Open Help & Contact")}`;
    }
    const m = c.item;
    return `<p><strong>${e(m.title)}</strong></p><ol class="cb-steps">${m.steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>${pageBtn(m.section)}`;
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
      bot.root.querySelector("#cbInput").focus();
    },
    close
  };
})();
