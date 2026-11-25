/* =========================================================
   GLITCHWAYVE — ONE-FILE JAVASCRIPT
   Beginner map of this file:
     1. Supabase connection         7. Page: Home
     2. Constants (menus, statuses) 8. Pages: Finder, categories, Moving Around,
     3. App state                      Help & Contact, PULSE, Innovation Hub,
     4. Small helpers                  Handbook, Settings, Staff
     5. Database functions          9. Service cards + detail dialog
     6. Login + app shell + routing 10. Forms (request, appointment, booking, borrow, project)
                                    11. Event handling + start-up
   Every database call goes through Supabase with Row Level Security (RLS).
   The browser only ever holds the PUBLISHABLE key.
   ========================================================= */

// =========================================================
// 1. SUPABASE CONNECTION
// =========================================================
// Replace these with your project's URL and publishable key
// (Supabase → Project Settings → API Keys). Never put a secret/service_role key here.
const SUPABASE_URL = "https://kdgtgxkyubwuyolrvktl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e-u14FUMB0xaf-S-pnceRw_fMkBGivx";

const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// =========================================================
// 2. CONSTANTS
// =========================================================
const BUILDINGS = {
  interweave: { name: "Interweave", full: "CIIT Interweave", icon: "building-2", themeColor: "#0b2e4a" },
  glitch: { name: "Glitch Tower", full: "CIIT Glitch Tower", icon: "building", themeColor: "#0e0f12" }
};

// Service categories = the six service pages. (Document Support was merged into Requests.)
const CATEGORIES = [
  { section: "academics", category: "Academics & Formation", icon: "graduation-cap", blurb: "Learning tools, labs, the library and room booking." },
  { section: "requests", category: "Requests", icon: "file-text", blurb: "Registrar requests, school records and equipment borrowing." },
  { section: "careers", category: "Careers", icon: "briefcase-business", blurb: "Practicum, placement and job resources." },
  { section: "student-life", category: "Student Life", icon: "users", blurb: "Communities, events, organizations and PlayLab." },
  { section: "health", category: "Health & Wellness", icon: "heart-pulse", blurb: "Carehub, the clinic and guidance counseling." },
  { section: "support", category: "Support", icon: "life-buoy", blurb: "IT, Edusuite and enrollment help, plus PULSE concerns." }
];

// One distinct icon per service, so no two services look alike at a glance.
// (Services an admin adds later keep the icon chosen in the Admin Panel.)
const SERVICE_ICONS = {
  "3d-lab": "box", "adobe-creative-cloud": "palette", "book-a-space": "calendar-plus", "borrow-a-book": "book-marked",
  "canvas": "notebook-tabs", "chatgpt-edu": "bot", "course-or-subject-descriptions": "book-text", "edusuite": "school",
  "industry-readiness-goals": "target", "mac-lab": "laptop", "online-library": "library", "pc-lab": "monitor",
  "school-calendar": "calendar-days", "studio-and-recording-rooms": "mic", "the-forge-maker-lab": "hammer", "toon-boom": "clapperboard",
  "acceptance-request": "mail-check", "company-evaluation": "clipboard-check", "endorsement-request": "mail-plus",
  "industry-partner-list": "handshake", "job-search-websites": "search-check", "kalibrr": "briefcase-business",
  "placement-consultation-request": "calendar-clock", "practicum-group": "network", "practicum-guidelines": "scroll-text",
  "practicum-logs": "notebook-pen", "practicum-profile-registration": "user-round-pen", "working-student-crediting-application": "badge-check",
  "carehub": "heart-pulse", "consult-with-a-dentist": "smile", "consult-with-a-doctor": "stethoscope",
  "guidance-appointment-scheduler": "hand-heart", "medical-result-submission": "file-heart", "talk-with-a-school-nurse": "heart-handshake",
  "vaccine-submission": "syringe",
  "application-for-excuse": "file-check", "application-for-graduation": "graduation-cap", "apply-for-pe-exemption": "dumbbell",
  "authorized-withdrawal-form": "file-x", "change-of-grade": "pencil-line", "completion-of-grade": "check-check",
  "file-a-leave-of-absence": "calendar-off", "forge-equipment-borrowing": "package-open", "id-submission": "id-card",
  "request-a-copy-of-school-records": "file-text", "shifting-of-program": "arrow-left-right", "subject-dropping-form": "file-minus",
  "ciit-discord-community": "message-circle", "ciit-market-place": "shopping-bag", "ciit-official-facebook-page": "megaphone",
  "ciit-students-facebook-group": "messages-square", "ciit-website": "globe", "events-and-competitions": "trophy",
  "playlab": "joystick", "refer-a-friend": "user-plus", "refer-a-sibling": "users-round", "rso-dashboard": "layout-dashboard",
  "student-organizations": "flag", "students-games-and-apps": "gamepad-2", "students-works-and-projects": "image",
  "edusuite-help-desk": "monitor-cog", "enrollment-helpdesk": "life-buoy", "it-helpdesk-service": "headset",
  "it-knowledge-base": "book-open", "pulse-concerns-formerly-itracker": "message-square-warning", "student-services-evaluator": "star"
};
function serviceIcon(s) { return SERVICE_ICONS[s.service_code] || s.icon_name || "circle-dot"; }
// Each category has its own colour (style.css → .cat-*). The text label always stays, so colour is never the only cue.
const CATEGORY_CLASS = {
  "Academics & Formation": "cat-academics", "Requests": "cat-requests", "Careers": "cat-careers",
  "Student Life": "cat-life", "Health & Wellness": "cat-health", "Support": "cat-support"
};
function catClass(category) { return CATEGORY_CLASS[category] || "cat-academics"; }

// Sidebar groups. "staffOnly" items appear only for profiles with role = 'staff'.
const NAV_GROUPS = [
  { label: "Find", items: [
    { section: "home", label: "Home", icon: "house" },
    { section: "myrequests", label: "My Requests", icon: "list-checks", countBadge: true },
    { section: "finder", label: "Find a Service", icon: "search" },
    { section: "moving", label: "Moving Around", icon: "map" },
    { section: "campus", label: "Canteen & Shuttle", icon: "clock" },
    { section: "directory", label: "Help & Contact", icon: "contact" },
    { section: "manual", label: "User Manual", icon: "book-marked" }
  ] },
  // "collapsible": shown as one "Services" button that opens and closes, so the menu fits without scrolling.
  { label: "Services", collapsible: true, icon: "layers", items: [
    { section: "foundit", label: "FoundIt", icon: "package-search" },
    { section: "rezbin", label: "Rezbin", icon: "recycle" },
    ...CATEGORIES.map((c) => ({ section: c.section, label: c.category, icon: c.icon }))
  ] },
  { label: "My activity", items: [
    { section: "pulse", label: "PULSE", icon: "activity", badge: "Simulation" },
    { section: "innovation", label: "Innovation Hub", icon: "lightbulb" }
  ] },
  { label: "More", items: [
    { section: "handbook", label: "College Handbook", icon: "book-open" },
    { section: "settings", label: "Settings", icon: "settings" },
    { section: "staff", label: "Admin Panel", icon: "shield-check", staffOnly: true }
  ] }
];

// Personal record types shown in PULSE. "flow" = the normal path; other statuses stop the flow.
const RECORD_TYPES = {
  requests: { label: "Request", icon: "file-text", flow: ["Submitted", "In review", "Approved", "Ready for pickup", "Completed"] },
  appointments: { label: "Appointment", icon: "calendar-check", flow: ["Submitted", "Confirmed", "Completed"] },
  bookings: { label: "Room booking", icon: "calendar-days", flow: ["Submitted", "Approved", "Completed"] },
  borrow_records: { label: "Equipment", icon: "package", flow: ["Submitted", "Approved", "Borrowed", "Returned"] },
  projects: { label: "Project", icon: "lightbulb", flow: ["Submitted", "In review", "Accepted"] }
};
const ALL_STATUSES = {
  requests: ["Submitted", "In review", "Approved", "Ready for pickup", "Completed", "Declined", "Cancelled"],
  appointments: ["Submitted", "Confirmed", "Rescheduled", "Completed", "Declined", "Cancelled"],
  bookings: ["Submitted", "Approved", "Declined", "Completed", "Cancelled"],
  borrow_records: ["Submitted", "Approved", "Borrowed", "Returned", "Declined", "Cancelled"],
  projects: ["Submitted", "In review", "Accepted", "Needs revision", "Declined", "Cancelled"]
};
const TIME_SLOTS = ["8:00 – 9:00 AM", "9:00 – 10:00 AM", "10:00 – 11:00 AM", "11:00 AM – 12:00 NN", "1:00 – 2:00 PM", "2:00 – 3:00 PM", "3:00 – 4:00 PM", "4:00 – 5:00 PM"];

// =========================================================
// 3. APP STATE
// =========================================================
const state = {
  campusTab: "canteen",
  directoryTab: "offices",
  profFilter: "all",
  menuDate: null,
  openCount: 0,
  servicesOpen: localStorage.getItem("gw-services-open") === "true",
  quickPanelOpen: false,
  user: null,
  profile: null,
  building: localStorage.getItem("gw-building") || "interweave",
  section: "home",
  finderTerm: "",
  finderCategory: "all",
  floorId: null,
  pulseTab: "all",
  staffTab: "records",
  data: { services: [], offices: [], loaded: false },
  shortcutPrefs: {},
  unread: 0,
  textSize: localStorage.getItem("gw-text-size") || "16px",
  highContrast: localStorage.getItem("gw-high-contrast") === "true"
};

// =========================================================
// 4. SMALL HELPERS
// =========================================================
/** Escapes text before it goes into HTML, so database text can never become code. */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
/** Allows only http(s) links from the database. */
function safeUrl(url) {
  try { const u = new URL(url); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
}
function formatDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-PH", withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}
function todayString() { return new Date().toISOString().slice(0, 10); }
/** Opens a new Gmail compose window addressed to this email. */
function gmailHref(email) { return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`; }
function buildingName(key = state.building) { return BUILDINGS[key]?.name || "Campus"; }
function otherBuilding(key = state.building) { return key === "interweave" ? "glitch" : "interweave"; }
function isStaff() { return state.profile?.role === "staff"; }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function icon(name, extra = "") { return `<i data-lucide="${escapeHTML(name || "circle-dot")}" ${extra}></i>`; }
function neonClass(text) { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 997; return `neon-${h % 5}`; }

function showToast(message, isError = false) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = `toast ${isError ? "error" : ""}`;
  el.innerHTML = `${icon(isError ? "alert-triangle" : "check-circle-2")}<span>${escapeHTML(message)}</span>`;
  root.appendChild(el);
  refreshIcons();
  setTimeout(() => el.remove(), isError ? 6000 : 3500);
}

/** Opens a dialog. Focus moves into it; Escape or the X closes it. */
function showDialog(title, bodyHTML, { wide = false, description = "" } = {}) {
  const root = document.getElementById("dialogRoot");
  state.lastFocus = document.activeElement;
  root.innerHTML = `
    <div class="dialog-backdrop" data-action="close-dialog-backdrop">
      <div class="dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
        <div class="dialog-head">
          <div><h2 id="dialogTitle">${escapeHTML(title)}</h2>${description ? `<p class="muted" style="margin:4px 0 0">${escapeHTML(description)}</p>` : ""}</div>
          <button class="icon-button" type="button" data-action="close-dialog" aria-label="Close">${icon("x")}</button>
        </div>
        <div class="dialog-body">${bodyHTML}</div>
      </div>
    </div>`;
  refreshIcons();
  const first = root.querySelector("input, select, textarea, .dialog-body button, .dialog-body a");
  (first || root.querySelector(".dialog")).focus();
}
function closeDialog() {
  document.getElementById("dialogRoot").innerHTML = "";
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function renderPageHeader(title, description, eyebrow = "", actionsHTML = "") {
  return `
    <div class="page-header">
      <div>
        ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
        <h1>${escapeHTML(title)}</h1>
        ${description ? `<p>${description}</p>` : ""}
      </div>
      ${actionsHTML ? `<div class="row">${actionsHTML}</div>` : ""}
    </div>`;
}
function renderEmptyState(title, message, iconName = "inbox", actionHTML = "") {
  return `<div class="empty-state">${icon(iconName)}<h3 style="margin-top:10px">${escapeHTML(title)}</h3><p class="muted">${message}</p>${actionHTML}</div>`;
}
function renderLoading(count = 3) {
  return `<div class="grid grid-auto">${Array.from({ length: count }, () => '<div class="skeleton"></div>').join("")}</div>`;
}
/** Friendly error with a way to continue (retry or contact). */
function showPageError(error) {
  console.error(error);
  const offline = !navigator.onLine;
  document.getElementById("mainContent").innerHTML = `
    <div class="error-state" role="alert">
      <span class="error-label">${icon("alert-octagon")} Error</span>
      <h2 style="margin-top:8px">We couldn't load this page.</h2>
      <p>${offline ? "You seem to be offline. Check your connection, then try again." : "Something went wrong while loading information. Your search and building choice are kept."}</p>
      <div class="row">
        <button class="btn btn-primary" type="button" data-action="retry">${icon("rotate-cw")} Try again</button>
        <button class="btn" type="button" data-section="directory">${icon("contact")} Help & Contact</button>
      </div>
    </div>`;
  refreshIcons();
}
/** Logo area. Put the CIIT logo at assets/ciit-logo.png (or change BRAND_LOGO).
    If the file is missing, the text placeholder below is shown instead. */
const BRAND_LOGO = "assets/ciit-logo.png";
function renderBrand() {
  return `
    <div class="brand">
      <img class="brand-logo" src="${BRAND_LOGO}" alt="CIIT College of Innovation and Integrated Technology"
        onerror="this.hidden = true; this.nextElementSibling.hidden = false;">
      <div class="brand-mark" hidden>G</div>
      
    </div>`;
}
function applyAccessibilitySettings() {
  document.documentElement.style.setProperty("--font-size", state.textSize);
  document.documentElement.classList.toggle("high-contrast", state.highContrast);
}
function applyBuildingTheme() {
  document.documentElement.dataset.building = state.building;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", BUILDINGS[state.building].themeColor);
}

// =========================================================
// 5. DATABASE FUNCTIONS
// =========================================================
async function getProfile() {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  if (error) throw error;
  return data;
}
/** Loads shared info once per session: all services (both buildings) and offices. */
async function loadSharedData(force = false) {
  if (state.data.loaded && !force) return;
  const [services, offices, prefs] = await Promise.all([
    supabaseClient.from("services").select("*").eq("is_active", true).order("name"),
    supabaseClient.from("offices").select("*").order("name"),
    supabaseClient.from("shortcut_preferences").select("*")
  ]);
  if (services.error) throw services.error;
  if (offices.error) throw offices.error;
  state.data.services = services.data;
  state.data.offices = offices.data;
  state.shortcutPrefs = Object.fromEntries((prefs.data || []).map((p) => [p.service_code, p]));
  state.data.loaded = true;
}
async function getAnnouncements() {
  const [{ data, error }, dismissed] = await Promise.all([
    supabaseClient.from("announcements").select("*").or(`building_key.is.null,building_key.eq.${state.building}`).order("published_at", { ascending: false }),
    supabaseClient.from("dismissed_announcements").select("announcement_id")
  ]);
  if (error) throw error;
  const hidden = new Set((dismissed.data || []).map((d) => d.announcement_id));
  return { visible: data.filter((a) => !hidden.has(a.id)), hiddenCount: data.filter((a) => hidden.has(a.id)).length };
}
async function getFloorsAndRooms(buildingKey = state.building) {
  const [floors, rooms] = await Promise.all([
    supabaseClient.from("floors").select("*").eq("building_key", buildingKey).order("floor_number", { ascending: false }),
    supabaseClient.from("rooms").select("*").eq("building_key", buildingKey).order("room_number")
  ]);
  if (floors.error) throw floors.error;
  if (rooms.error) throw rooms.error;
  return { floors: floors.data, rooms: rooms.data };
}
async function getBookableRooms() {
  const { data, error } = await supabaseClient.from("rooms").select("*").eq("is_bookable", true).order("name");
  if (error) throw error;
  return data;
}
async function getEquipmentWithAvailability() {
  const { data, error } = await supabaseClient.from("equipment").select("*").order("name");
  if (error) throw error;
  const counts = await Promise.all(data.map((e) => supabaseClient.rpc("equipment_available", { p_equipment_id: e.id })));
  return data.map((e, i) => ({ ...e, available: counts[i].error ? null : counts[i].data }));
}
async function getDocuments() {
  const { data, error } = await supabaseClient.from("documents").select("*").order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}
/** All of the signed-in student's records + their status history (RLS keeps this to their own rows). */
async function getMyRecords() {
  const tables = Object.keys(RECORD_TYPES);
  const selects = {
    requests: "*", appointments: "*", bookings: "*, rooms(name, room_number, building_key)",
    borrow_records: "*, equipment(name, location)", projects: "*"
  };
  const results = await Promise.all(tables.map((t) => {
    let query = supabaseClient.from(t).select(selects[t]).order("created_at", { ascending: false });
    if (!isStaff()) query = query.eq("student_id", state.user.id);
    return query;
  }));
  const records = [];
  results.forEach((res, i) => {
    if (res.error) throw res.error;
    res.data.forEach((row) => records.push({ ...row, _type: tables[i] }));
  });
  const ids = records.map((r) => r.id);
  let events = [];
  if (ids.length) {
    const ev = await supabaseClient.from("status_events").select("*").in("record_id", ids).order("created_at");
    if (!ev.error) events = ev.data;
  }
  records.forEach((r) => { r._events = events.filter((e) => e.record_id === r.id); });
  return records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
async function getNotifications() {
  const { data, error } = await supabaseClient.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}
async function refreshUnreadCount() {
  const { count } = await supabaseClient.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  state.unread = count || 0;
  const dot = document.getElementById("notifDot");
  if (dot) dot.hidden = state.unread === 0;
}

// =========================================================
// 6. LOGIN, APP SHELL AND ROUTING
// =========================================================
function renderLoginScreen(message = "") {
  const screen = document.getElementById("loginScreen");
  document.getElementById("dashboard").hidden = true;
  screen.hidden = false;
  applyBuildingTheme();
  screen.innerHTML = `
    <div class="login-art">
      ${renderBrand()}
      <div>
        <span class="login-wordmark">GlitchWayve</span>
        <h1>Find any service in Interweave and Glitch Tower.</h1>
        <p>Where it is, when it's open, what to bring, and what happens after you submit.</p>
      </div>
      <p style="font-size:.85rem;opacity:.75">Prototype for CS214 · Some details are sample data.</p>
    </div>
    <div class="login-panel">
      <form class="login-card" id="loginForm" novalidate>
        <p class="login-card-brand">GlitchWayve</p>
        <h2 id="loginTitle">Sign in to GlitchWayve</h2>
        <p class="muted">Use your CIIT test account.</p>
        ${isSupabaseConfigured ? "" : `<div class="setup-warning"><strong>Setup needed:</strong> add your Supabase URL and publishable key at the top of <code>script.js</code>.</div>`}
        <div class="field">
          <label for="loginEmail">CIIT email</label>
          <input id="loginEmail" name="email" type="email" placeholder="name@ciit.edu.ph" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" name="password" type="password" autocomplete="current-password" required>
        </div>
        <p class="form-error" id="loginError" role="alert">${escapeHTML(message)}</p>
        <button class="btn btn-primary" style="width:100%" type="submit" ${isSupabaseConfigured ? "" : "disabled"}>Sign in ${icon("arrow-right")}</button>
        <p class="form-help" style="margin-top:14px">Class prototype: don't enter your real CIIT password.</p>
      </form>
    </div>`;
  refreshIcons();
}

async function signIn(form) {
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const errorEl = document.getElementById("loginError");
  if (!email.endsWith("@ciit.edu.ph")) { errorEl.textContent = "Use your CIIT email address ending in @ciit.edu.ph."; form.elements.email.focus(); return; }
  if (!password) { errorEl.textContent = "Enter your password."; form.elements.password.focus(); return; }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true; button.textContent = "Signing in…";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = "We couldn't sign you in. Check your email and password, then try again.";
    button.disabled = false; button.innerHTML = `Sign in ${icon("arrow-right")}`; refreshIcons();
    return;
  }
  state.user = data.user;
  await openDashboard();
}
async function signOut() {
  await window.FoundIt?.signOut().catch(() => {});
  await supabaseClient.auth.signOut();
  state.user = null; state.profile = null; state.data.loaded = false;
  if (tour.active) endTour(false);
  closeDialog();
  renderLoginScreen();
}

async function openDashboard() {
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  document.getElementById("mainContent").innerHTML = renderLoading(6);
  try {
    state.profile = await getProfile();
    await loadSharedData();
  } catch (error) {
    renderAppShell();
    showPageError(error);
    return;
  }
  renderChatbotLauncher();
  if (!location.hash) {
    // Canteen staff start on their own campus's menu; everyone else starts on Home.
    if (state.profile?.role === "canteen" && BUILDINGS[state.profile.canteen_building]) {
      state.building = state.profile.canteen_building; state.campusTab = "canteen";
      location.hash = `#/${state.building}/campus`;
    } else location.hash = `#/${state.building}/home`;
  }
  handleRouteChange();
  refreshUnreadCount();
  refreshOpenCount();
  // Students get the daily Carehub check-in first; the tutorial offer waits until it's not showing.
  const carehubShown = await (window.Carehub?.maybePrompt() ?? false);
  if (!carehubShown) maybeOfferTour();
}

function navigateTo(section) {
  const hash = `#/${state.building}/${section}`;
  if (location.hash === hash) handleRouteChange(); else location.hash = hash;
}
function setBuilding(key) {
  if (!BUILDINGS[key] || key === state.building) return;
  state.floorId = null;
  location.hash = `#/${key}/${state.section}`;
  const live = document.getElementById("buildingLive");
  if (live) live.textContent = `Now showing ${buildingName(key)}`;
}

/** Reads #/building/section from the URL so Back/Forward work. */
function handleRouteChange() {
  if (!state.user) return;
  const [, building, section] = location.hash.split("/");
  if (BUILDINGS[building]) { state.building = building; localStorage.setItem("gw-building", building); }
  const known = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.section);
  state.section = known.includes(section) ? section : "home";
  if (state.section === "staff" && !isStaff()) state.section = "home";
  applyBuildingTheme();
  setNavOpen(false);
  setQuickPanelOpen(false);
  renderAppShell();
  renderCurrentPage();
}

// ---------- Phone menu (the sidebar slides in from the left on small screens) ----------
const phoneQuery = window.matchMedia("(max-width: 640px)");
function setNavOpen(open, { focus = false } = {}) {
  open = Boolean(open) && phoneQuery.matches;
  document.body.classList.toggle("nav-open", open);
  const toggle = document.querySelector(".menu-toggle");
  if (toggle) { toggle.setAttribute("aria-expanded", String(open)); toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu"); }
  let backdrop = document.getElementById("navBackdrop");
  if (open && !backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "navBackdrop"; backdrop.className = "nav-backdrop";
    backdrop.dataset.action = "close-nav";
    document.getElementById("dashboard").appendChild(backdrop);
  } else if (!open) backdrop?.remove();
  if (focus && open) document.querySelector("#sidebar .nav-link.active, #sidebar .nav-link")?.focus({ preventScroll: true });
  if (focus && !open) toggle?.focus({ preventScroll: true });
}
phoneQuery.addEventListener?.("change", () => setNavOpen(false));

function renderNavLink(item) {
  const active = state.section === item.section;
  const count = item.countBadge && state.openCount ? `<span class="nav-count" id="navOpenCount" aria-label="${state.openCount} open">${state.openCount}</span>` : "";
  return `
    <button class="nav-link ${active ? "active" : ""}" type="button" data-section="${item.section}"
      ${active ? 'aria-current="page"' : ""} title="${escapeHTML(item.label)}">
      ${icon(item.icon)}<span>${escapeHTML(item.label)}</span>${item.badge ? `<span class="nav-badge">${escapeHTML(item.badge)}</span>` : ""}${count}
    </button>`;
}

function renderAppShell() {
  const name = state.profile?.full_name || state.user?.email?.split("@")[0] || "Student";
  const initials = name.split(/[\s.,]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  document.getElementById("sidebar").innerHTML = `
    ${renderBrand()}
    ${NAV_GROUPS.map((group) => {
      const items = group.items.filter((i) => !i.staffOnly || isStaff());
      const links = items.map(renderNavLink).join("");
      if (!group.collapsible) return `<div class="nav-group-label">${group.label}</div>` + links;
      const open = state.servicesOpen || items.some((i) => i.section === state.section);
      return `
        <button class="nav-link nav-group-toggle ${!open && items.some((i) => i.section === state.section) ? "active" : ""}" type="button"
          data-action="toggle-services" aria-expanded="${open}" aria-controls="navServices" title="${group.label}">
          ${icon(group.icon)}<span>${group.label}</span>${icon("chevron-down", 'class="nav-chevron"')}
        </button>
        <div class="nav-group-items" id="navServices" ${open ? "" : "hidden"}>${links}</div>`;
    }).join("")}
    <div class="sidebar-footer">${icon(BUILDINGS[state.building].icon)} Viewing <strong>${buildingName()}</strong></div>`;

  document.getElementById("topbar").innerHTML = `
    <button class="icon-button menu-toggle" type="button" data-action="toggle-nav" aria-controls="sidebar"
      aria-expanded="${document.body.classList.contains("nav-open")}" aria-label="Open menu">${icon("menu")}</button>
    <span class="topbar-title">GlitchWayve</span>
    <form class="topbar-search" role="search" data-form="global-search">
      ${icon("search")}
      <label class="sr-only" for="globalSearch">Search services, rooms and offices in both buildings</label>
      <input id="globalSearch" type="search" placeholder="Search services, rooms, offices…" value="${escapeHTML(state.finderTerm)}" autocomplete="off">
    </form>
    <div class="topbar-right">
      <div class="building-switch" role="group" aria-label="Choose building">
        ${Object.entries(BUILDINGS).map(([key, b]) => `
          <button type="button" data-building-key="${key}" aria-pressed="${state.building === key}">
            ${icon(b.icon)}<span class="label-full">${b.name}</span><span class="label-short" aria-hidden="true">${key === "interweave" ? "ITW" : "Glitch"}</span>
          </button>`).join("")}
      </div>
      <span class="sr-only" id="buildingLive" aria-live="polite"></span>
      <button class="icon-button qp-toggle" type="button" data-action="toggle-quick-panel" aria-controls="quickPanel"
        aria-expanded="${state.quickPanelOpen}" aria-label="Quick access shortcuts" title="Quick access">${icon("panel-right-open")}</button>
      <button class="btn btn-sm tour-button" type="button" data-action="start-tour" data-tour-section="">${icon("circle-help")}<span class="tour-label">Tutorial</span></button>
      <button class="icon-button" type="button" data-action="open-notifications" aria-label="Notifications">${icon("bell")}<span class="dot" id="notifDot" ${state.unread ? "" : "hidden"}></span></button>
      <button class="profile-button" type="button" data-action="open-profile-menu" aria-haspopup="true">
        <span class="avatar">${escapeHTML(initials || "S")}</span><span class="profile-name">${escapeHTML(name)}</span>${icon("chevron-down")}
      </button>
    </div>`;
  renderQuickPanel();
  refreshIcons();
}

// ---------- Quick access panel (right side, like the original CIIT dashboard) ----------
// PC: always visible on the right of every page. Tablet: slides in from the right via the
// Quick access button in the top bar. Phone: hidden; Home shows the same shortcuts instead.
const panelQuery = window.matchMedia("(min-width: 1200px)");
const tabletQuery = window.matchMedia("(min-width: 641px) and (max-width: 1199px)");
function renderQuickPanel() {
  const panel = document.getElementById("quickPanel");
  if (!panel || !state.data.loaded) return;
  const quick = getQuickAccess(10);
  panel.innerHTML = `<div class="qp-card">
    <div class="qp-head">
      <h2 id="quickPanelTitle">${icon("zap")} Quick access</h2>
      <div class="row">
        <button class="btn btn-sm" type="button" data-action="edit-shortcuts" aria-label="Customize Quick access">${icon("sliders-horizontal")}<span>Customize</span></button>
        <button class="icon-button qp-close" type="button" data-action="toggle-quick-panel" aria-label="Close Quick access">${icon("x")}</button>
      </div>
    </div>
    <div class="qp-list" data-tour="quick">
      ${quick.length ? quick.map((s) => renderQuickItem(s, true)).join("")
        : `<p class="muted" style="font-size:.9rem">Nothing here yet. Press Customize to pin services.</p>`}
    </div>
  </div>`;
  refreshIcons();
}
function renderQuickItem(s, compact) {
  const pinned = state.shortcutPrefs[s.service_code]?.is_pinned;
  return `
    <button class="qp-item ${catClass(s.category)}" type="button" data-action="open-service" data-id="${s.id}">
      <span class="service-icon">${icon(serviceIcon(s))}</span>
      <span class="qp-text"><strong>${escapeHTML(s.name)}</strong>
        <small>${compact ? escapeHTML(s.category) : escapeHTML(locationLine(s)) + (s.hours ? " · " + escapeHTML(s.hours) : "")}</small></span>
      ${pinned ? `<span class="qp-pin" title="Pinned">${icon("pin")}</span>` : ""}
    </button>`;
}
function setQuickPanelOpen(open) {
  state.quickPanelOpen = Boolean(open) && tabletQuery.matches;
  document.body.classList.toggle("qp-open", state.quickPanelOpen);
  document.querySelector(".qp-toggle")?.setAttribute("aria-expanded", String(state.quickPanelOpen));
  let backdrop = document.getElementById("qpBackdrop");
  if (state.quickPanelOpen && !backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "qpBackdrop"; backdrop.className = "qp-backdrop"; backdrop.dataset.action = "close-quick-panel";
    document.getElementById("dashboard").appendChild(backdrop);
    document.querySelector("#quickPanel .qp-item, #quickPanel button")?.focus({ preventScroll: true });
  } else if (!state.quickPanelOpen) backdrop?.remove();
}
tabletQuery.addEventListener?.("change", () => setQuickPanelOpen(false));

/** Open-request count for the My Requests badge (cheap count queries, own records only). */
const OPEN_STATUSES = ["Submitted", "In review", "Approved", "Ready for pickup", "Confirmed", "Rescheduled", "Borrowed", "Needs revision"];
async function refreshOpenCount() {
  if (!supabaseClient || !state.user) return;
  const counts = await Promise.all(Object.keys(RECORD_TYPES).map((t) => supabaseClient.from(t)
    .select("id", { count: "exact", head: true }).eq("student_id", state.user.id).in("status", OPEN_STATUSES)));
  state.openCount = counts.reduce((sum, c) => sum + (c.count || 0), 0);
  const link = document.querySelector('#sidebar [data-section="myrequests"]');
  if (!link) return;
  link.querySelector(".nav-count")?.remove();
  if (state.openCount) link.insertAdjacentHTML("beforeend", `<span class="nav-count" aria-label="${state.openCount} open">${state.openCount}</span>`);
}

function renderChatbotLauncher() {
  if (document.getElementById("chatbotLauncher")) return;
  const btn = document.createElement("button");
  btn.id = "chatbotLauncher"; btn.className = "chatbot-launcher"; btn.type = "button";
  btn.dataset.action = "open-chatbot";
  btn.innerHTML = `${icon("message-circle-question")}<span>Ask GlitchWayve</span>`;
  document.body.appendChild(btn);
  refreshIcons();
}

async function renderCurrentPage() {
  const main = document.getElementById("mainContent");
  main.innerHTML = renderLoading(6);
  const category = CATEGORIES.find((c) => c.section === state.section);
  try {
    if (state.section === "home") await renderHomePage();
    else if (state.section === "finder") renderFinderPage();
    else if (category) renderCategoryPage(category);
    else if (state.section === "moving") await renderMovingPage();
    else if (state.section === "directory") renderDirectoryPage();
    else if (state.section === "pulse") renderPulsePage();
    else if (state.section === "myrequests") await renderMyRequestsPage();
    else if (state.section === "manual") renderManualPage();
    else if (state.section === "innovation") await renderInnovationPage();
    else if (state.section === "handbook") await renderHandbookPage();
    else if (state.section === "settings") renderSettingsPage();
    else if (state.section === "staff") await renderStaffPage();
    else if (state.section === "foundit") await window.FoundIt.render();
    else if (state.section === "rezbin") renderRezbinPage();
    else if (state.section === "campus") await window.CampusToday.renderCampusPage();
  } catch (error) {
    showPageError(error);
    return;
  }
  renderQuickPanel();
  if (["home", "myrequests"].includes(state.section)) refreshOpenCount();
  refreshIcons();
}

// =========================================================
// 7. PAGE: HOME
// =========================================================
function servicesIn(building = state.building) { return state.data.services.filter((s) => s.building_key === building); }
function serviceByCode(code, building = state.building) { return state.data.services.find((s) => s.service_code === code && s.building_key === building); }
function officeByKey(key) { return state.data.offices.find((o) => o.office_key === key); }

/** Quick access (Feature 3): pinned first, then up to 4 matches for the student's
    program/year, then the most-used services. Hidden ones never appear. */
function getQuickAccess(limit = 8) {
  const program = state.profile?.program;
  const year = state.profile?.year_level;
  const prefs = state.shortcutPrefs;
  const pool = servicesIn()
    .filter((s) => !prefs[s.service_code]?.is_hidden)
    .filter((s) => !program || !s.programs || s.programs.includes(program))
    .filter((s) => !year || !s.year_levels || s.year_levels.includes(year));
  const pinned = pool.filter((s) => prefs[s.service_code]?.is_pinned);
  const matched = pool.filter((s) => !pinned.includes(s) && ((program && s.programs?.includes(program)) || (year && s.year_levels?.includes(year))))
    .sort((a, b) => Number(b.is_popular) - Number(a.is_popular) || a.name.localeCompare(b.name)).slice(0, 4);
  const popular = pool.filter((s) => s.is_popular && !pinned.includes(s) && !matched.includes(s));
  // Carehub (the required wellbeing check-in) always comes first unless the student hid it.
  const carehub = pool.find((s) => s.service_code === "carehub");
  const rest = [...pinned, ...matched, ...popular].filter((s) => s !== carehub);
  return (carehub ? [carehub, ...rest] : rest).slice(0, limit);
}

async function renderHomePage() {
  const name = (state.profile?.full_name || "").split(/[\s,]+/)[0] || "there";
  const [{ visible, hiddenCount }, allRecords] = await Promise.all([getAnnouncements(), getMyRecords()]);
  const records = allRecords.filter((r) => r.student_id === state.user.id);
  const carehub = serviceByCode("carehub");
  const quick = getQuickAccess();
  const open = records.filter((r) => !["Completed", "Returned", "Declined", "Cancelled", "Accepted"].includes(r.status));
  const needsProfile = !state.profile?.program || !state.profile?.year_level;

  document.getElementById("mainContent").innerHTML = `
    <section class="hero" aria-labelledby="homeTitle">
      <div style="position:relative;z-index:1">
        <span class="badge">${icon(BUILDINGS[state.building].icon)} ${BUILDINGS[state.building].full}</span>
        <h1 id="homeTitle">Hello, ${escapeHTML(name)}!</h1>
        <p>Find where a service is, when it's open, and what to bring — in ${buildingName()} or across campus.</p>
      </div>
      <div class="hero-actions">
        ${carehub ? `<button class="btn btn-hero" id="carehubHeroBtn" type="button" data-action="open-service" data-id="${carehub.id}">${icon("heart-pulse")} Carehub check-in</button>` : ""}
        <button class="btn btn-hero-ghost" type="button" data-section="myrequests">${icon("list-checks")} My requests${open.length ? ` (${open.length} open)` : ""}</button>
      </div>
    </section>

    <section class="card announcements-top" aria-labelledby="annTitle">
        <div class="section-head"><h2 id="annTitle">${icon("megaphone")} Announcements</h2>
          <div class="row">${isStaff() ? `<button class="btn btn-sm" type="button" data-action="manage-announcements">${icon("pencil")} Manage</button>` : ""}
          ${hiddenCount ? `<button class="btn btn-sm btn-ghost" type="button" data-action="restore-announcements">Show ${hiddenCount} hidden</button>` : ""}</div></div>
        ${visible.length ? visible.map((a) => `
          <article class="announcement">
            <div class="row"><span class="badge badge-info">${escapeHTML(a.tag || "Announcement")}</span><span class="muted" style="font-size:.85rem">${formatDate(a.published_at)}</span><span class="spacer"></span>
              <button class="btn btn-sm btn-ghost" type="button" data-action="dismiss-announcement" data-id="${a.id}" aria-label="Hide announcement: ${escapeHTML(a.title)}">${icon("eye-off")} Hide</button></div>
            <h3 style="margin-top:8px">${escapeHTML(a.title)}</h3>
            <p class="muted" style="margin:0">${escapeHTML(a.body)}</p>
          </article>`).join("") : '<p class="muted">You\'re all caught up.</p>'}
    </section>

    <!-- Today's canteen menu + next shuttle (campus.js fills this in) -->
    <section class="card section ct-today" id="todayCard" data-tour="today" aria-label="Today's menu and shuttle">
      <div class="skeleton" style="height:120px"></div>
    </section>


    ${needsProfile ? `
      <div class="notice section" role="note">${icon("sparkles")}
        <div><strong>Personalize your shortcuts.</strong> Tell us your program and year so Quick Access shows what's relevant to you.
        <button class="btn btn-sm" style="margin-left:6px" type="button" data-action="edit-profile">Set program & year</button></div>
      </div>` : ""}

    <!-- Phones only: the right-side Quick access panel doesn't fit, so its shortcuts appear here. -->
    <section class="section phone-quick" aria-labelledby="quickTitle">
      <div class="section-head">
        <h2 id="quickTitle">Quick access</h2>
        <button class="btn btn-sm" type="button" data-action="edit-shortcuts">${icon("sliders-horizontal")} Customize</button>
      </div>
      ${quick.length ? `<div class="quick-grid">${quick.map((s) => `
        <button class="quick-tile ${state.shortcutPrefs[s.service_code]?.is_pinned ? "pinned" : ""} ${catClass(s.category)}" type="button" data-action="open-service" data-id="${s.id}">
          <span class="service-icon">${icon(serviceIcon(s))}</span>
          <span>${escapeHTML(s.name)}<br><small>${escapeHTML(s.category)}</small></span>
        </button>`).join("")}</div>`
        : renderEmptyState("No shortcuts yet", "Use Customize to pin the services you use most.", "pin")}
    </section>`;
  window.CampusToday?.renderTodayCard();
  window.Carehub?.updateHeroButton();
}

// =========================================================
// 8. PAGES
// =========================================================
/** Builds the location text, e.g. "Glitch Tower · 6F · Room 602" or "Online". */
function locationLine(s) {
  if (s.service_type === "Online") return "Online · available anywhere";
  const parts = [buildingName(s.building_key)];
  if (s.area_name) parts.push(s.area_name);
  if (s.floor_label && s.floor_label !== s.area_name) parts.push(s.floor_label);
  if (s.room_number && s.room_number !== s.area_name) parts.push(/^\d/.test(s.room_number) ? `Room ${s.room_number}` : s.room_number);
  return parts.join(" · ");
}

/** Text search across services, offices and rooms in BOTH buildings (current building first). */
function searchServices(term) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return state.data.services
    .map((s) => {
      const office = officeByKey(s.office_key);
      const hay = [s.name, s.description, s.category, s.room_number, s.floor_label, s.area_name, office?.name, ...(s.requirements || [])].join(" ").toLowerCase();
      const name = s.name.toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      const score = hits === words.length ? hits * 10 + (name.includes(words[0]) ? 5 : 0) + (s.building_key === state.building ? 3 : 0) : 0;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/** Splits services into: here, also-elsewhere badges, and "only at the other building". */
function splitByBuilding(list) {
  const here = list.filter((s) => s.building_key === state.building);
  const hereCodes = new Set(here.map((s) => s.service_code));
  const onlyOther = list.filter((s) => s.building_key !== state.building && !hereCodes.has(s.service_code));
  const seen = new Set();
  return { here, onlyOther: onlyOther.filter((s) => !seen.has(s.service_code) && seen.add(s.service_code)) };
}

function renderOtherBuildingSection(list, openByDefault = false) {
  if (!list.length) return "";
  const other = otherBuilding();
  return `
    <details class="other-building" ${openByDefault ? "open" : ""}>
      <summary>${icon(BUILDINGS[other].icon)} Available at ${buildingName(other)} only <span class="badge">${list.length}</span>
        <span class="muted" style="font-weight:500">— not offered in ${buildingName()}</span></summary>
      <div class="grid grid-auto">${list.map((s) => renderServiceCard(s)).join("")}</div>
    </details>`;
}

function renderFinderPage() {
  const term = state.finderTerm.trim();
  const base = term ? searchServices(term) : state.data.services;
  const filtered = state.finderCategory === "all" ? base : base.filter((s) => s.category === state.finderCategory);
  const { here, onlyOther } = splitByBuilding(filtered);

  let results;
  if (term && !here.length && !onlyOther.length) {
    const suggestions = servicesIn().filter((s) => s.is_popular).slice(0, 4);
    results = `
      <div class="empty-state" role="status">
        ${icon("search-x")}
        <h3 style="margin-top:10px">We couldn't find "${escapeHTML(term)}".</h3>
        <p class="muted">Try a different keyword, browse by category, or ask an office directly.</p>
        <div class="chips" style="justify-content:center">
          ${suggestions.map((s) => `<button class="chip" type="button" data-action="open-service" data-id="${s.id}">${icon(serviceIcon(s))} ${escapeHTML(s.name)}</button>`).join("")}
        </div>
        <div class="row" style="justify-content:center;margin-top:14px">
          <button class="btn" type="button" data-action="clear-search">${icon("x")} Clear search</button>
          <button class="btn btn-primary" type="button" data-section="directory">${icon("contact")} Help & Contact</button>
        </div>
      </div>`;
  } else {
    results = `
      <p class="muted" role="status">${term ? `${here.length} result${here.length === 1 ? "" : "s"} in ${buildingName()} for "${escapeHTML(term)}"` : `${here.length} services in ${buildingName()}`}${onlyOther.length ? ` · ${onlyOther.length} more at ${buildingName(otherBuilding())}` : ""}</p>
      ${here.length ? `<div class="grid grid-auto">${here.map((s) => renderServiceCard(s)).join("")}</div>`
        : renderEmptyState(`Not offered in ${buildingName()}`, `See the services available at ${buildingName(otherBuilding())} below.`, "building")}
      ${renderOtherBuildingSection(onlyOther, !here.length)}`;
  }

  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Find a Service", `Search or browse everything offered in <strong>${buildingName()}</strong>. Each card shows the floor, room and hours.`, `${icon("search")} Service & facility finder`)}
    <form data-form="finder-search" role="search">
      <label class="sr-only" for="finderSearch">Search services</label>
      <div class="finder-input">${icon("search")}<input id="finderSearch" type="search" placeholder="Search by service, office, room or requirement" value="${escapeHTML(state.finderTerm)}"></div>
    </form>
    <div class="chips" role="group" aria-label="Filter by category">
      <button class="chip" type="button" data-action="finder-category" data-category="all" aria-pressed="${state.finderCategory === "all"}">All</button>
      ${CATEGORIES.map((c) => `<button class="chip" type="button" data-action="finder-category" data-category="${escapeHTML(c.category)}" aria-pressed="${state.finderCategory === c.category}">${escapeHTML(c.category)}</button>`).join("")}
    </div>
    <div class="section" style="margin-top:18px">${results}</div>`;
}

function renderCategoryPage(cat) {
  const all = state.data.services.filter((s) => s.category === cat.category);
  const { here, onlyOther } = splitByBuilding(all);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader(cat.category, `${escapeHTML(cat.blurb)} Showing what's available in <strong>${buildingName()}</strong>.`, `${icon(cat.icon)} ${buildingName()}`)}
    ${here.length ? `<div class="grid grid-auto">${here.map((s) => renderServiceCard(s)).join("")}</div>`
      : renderEmptyState(`No ${cat.category} services in ${buildingName()}`, `They're offered at ${buildingName(otherBuilding())} — see below.`, "building")}
    ${renderOtherBuildingSection(onlyOther, !here.length)}`;
}

async function renderMovingPage() {
  const { floors, rooms } = await getFloorsAndRooms();
  const floorList = [...floors]; // rooms with no floor set are not listed
  if (!state.floorId || !floorList.some((f) => f.id === state.floorId)) state.floorId = floorList[0]?.id || null;
  const floor = floorList.find((f) => f.id === state.floorId);
  const floorRooms = floor ? rooms.filter((r) => r.floor_id === floor.id) : [];
  const servicesOnFloor = floor ? servicesIn().filter((s) => s.floor_label && floor.floor_label && s.floor_label.includes(floor.floor_label) && s.service_type !== "Online") : [];

  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader(`Moving Around ${buildingName()}`, "Pick a floor to see its rooms and the services located there.", `${icon("map")} Floor directory`)}
    ${floorList.length ? `
    <div class="floor-layout">
      <div class="floor-list" role="group" aria-label="Floors">
        ${floorList.map((f) => `
          <button class="floor-button" type="button" data-action="select-floor" data-id="${f.id}" aria-pressed="${f.id === state.floorId}">
            <span>${escapeHTML(f.floor_label)}</span>${f.is_off_limits ? '<span class="badge">Off limits</span>' : f.area_name ? `<span class="badge">${escapeHTML(f.area_name)}</span>` : ""}
          </button>`).join("")}
      </div>
      <div>
        ${floor?.is_off_limits ? `<div class="notice">${icon("ban")} <span><strong>${escapeHTML(floor.floor_label)} is off limits to students.</strong> Follow campus safety instructions.</span></div>` : ""}
        ${floor?.is_hypothetical ? `<div class="notice notice-sample" style="margin-bottom:12px">${icon("flask-conical")} <span>Location details on this floor are sample data and need to be verified with CIIT.</span></div>` : ""}
        ${floorRooms.length ? `<div class="grid grid-auto">${floorRooms.map(renderRoomCard).join("")}</div>`
          : floor?.is_off_limits ? "" : renderEmptyState("No rooms listed", "Rooms for this floor haven't been added yet.", "door-closed")}
        ${servicesOnFloor.length ? `<h2 class="section">Services on ${escapeHTML(floor.floor_label)}</h2><div class="grid grid-auto">${servicesOnFloor.map((s) => renderServiceCard(s)).join("")}</div>` : ""}
      </div>
    </div>` : renderEmptyState("No floor directory yet", `Floors for ${buildingName()} haven't been added.`, "map")}`;
}

function renderRoomCard(r) {
  return `
    <article class="card">
      <div class="row"><span class="service-icon">${icon(r.room_type?.includes("Lab") ? "monitor" : r.is_bookable ? "calendar-days" : "door-open")}</span>
        <div><h3 style="margin:0">${escapeHTML(r.name)}</h3><span class="muted" style="font-size:.88rem">${escapeHTML(r.room_type || "Room")}${r.capacity ? ` · up to ${r.capacity}` : ""}</span></div></div>
      <div class="service-meta" style="margin-top:10px">
        ${r.purpose ? `<span>${icon("info")} ${escapeHTML(r.purpose)}</span>` : ""}
        ${r.hours ? `<span>${icon("clock")} ${escapeHTML(r.hours)}</span>` : ""}
      </div>
      <div class="row" style="margin-top:10px">
        ${r.is_hypothetical ? '<span class="badge badge-sample">Sample data</span>' : ""}
        ${r.is_bookable ? `<span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-action="open-booking-form" data-room="${r.id}">${icon("calendar-plus")} Book</button>` : ""}
      </div>
    </article>`;
}

function renderDirectoryPage() {
  const tab = state.directoryTab || "offices";
  const offices = [...state.data.offices].sort((a, b) => (a.building_key === state.building ? -1 : 1) - (b.building_key === state.building ? -1 : 1) || a.name.localeCompare(b.name));
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Help & Contact", "Who to ask when you can't find something — with hours, location and what to bring. Offices in other buildings are listed too.", `${icon("contact")} Office directory`)}
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" type="button" data-action="directory-tab" data-tab="offices" aria-selected="${tab === "offices"}">${icon("building-2")} Offices</button>
      <button class="tab" role="tab" type="button" data-action="directory-tab" data-tab="professors" aria-selected="${tab === "professors"}">${icon("graduation-cap")} Professors</button></div>
    ${tab === "professors" ? renderProfessorsTab() : `<div class="grid grid-2">${offices.map(renderOfficeCard).join("")}</div>`}`;
}

function renderOfficeCard(o, compact = false) {
  const handled = state.data.services.filter((s) => s.office_key === o.office_key && s.building_key === o.building_key).slice(0, 6);
  return `
    <article class="card">
      <div class="row"><span class="service-icon">${icon("building-2")}</span>
        <div><h3 style="margin:0">${escapeHTML(o.name)}</h3><span class="badge badge-building">${buildingName(o.building_key)}</span></div></div>
      ${o.description ? `<p class="muted" style="margin:10px 0">${escapeHTML(o.description)}</p>` : ""}
      <div class="service-meta">
        <span>${icon("map-pin")} ${escapeHTML([buildingName(o.building_key), o.floor_label, o.room_number].filter(Boolean).join(" · ") || "Location not yet added")}</span>
        <span>${icon("clock")} ${escapeHTML(o.hours || "Hours not yet added")}</span>
        ${o.what_to_bring ? `<span>${icon("backpack")} Bring: ${escapeHTML(o.what_to_bring)}</span>` : ""}
        ${o.email ? `<span>${icon("mail")} <a href="${gmailHref(o.email)}" target="_blank" rel="noopener">${escapeHTML(o.email)}</a>
          <button class="btn btn-sm btn-ghost" type="button" data-action="copy-email" data-email="${escapeHTML(o.email)}" aria-label="Copy ${escapeHTML(o.email)}">${icon("copy")}</button></span>` : ""}
      </div>
      <div class="badges" style="margin-top:10px">${o.details_verified ? '<span class="badge badge-ok">Verified</span>' : '<span class="badge badge-sample">Sample details</span>'}
        ${o.is_hypothetical ? '<span class="badge badge-sample">Location unconfirmed</span>' : ""}</div>
      ${!compact && handled.length ? `<p class="muted" style="margin:12px 0 4px;font-size:.85rem">Handles: ${handled.map((s) => escapeHTML(s.name)).join(", ")}</p>` : ""}
    </article>`;
}

// ---------- PULSE: status and next steps (Feature 4) ----------
function recordTitle(r) {
  if (r._type === "requests") return r.service_name;
  if (r._type === "appointments") return r.appointment_type;
  if (r._type === "bookings") return r.rooms?.name || "Room booking";
  if (r._type === "borrow_records") return `${r.equipment?.name || "Equipment"}${r.quantity > 1 ? ` × ${r.quantity}` : ""}`;
  return r.title;
}
function statusPill(status) {
  const cls = ["Completed", "Returned", "Accepted", "Approved", "Confirmed", "Ready for pickup", "Borrowed"].includes(status) ? "status-done"
    : ["Declined", "Cancelled"].includes(status) ? "status-stopped"
    : ["In review", "Rescheduled", "Needs revision"].includes(status) ? "status-progress" : "status-waiting";
  const ic = cls === "status-done" ? "check-circle-2" : cls === "status-stopped" ? "circle-slash" : cls === "status-progress" ? "loader" : "hourglass";
  return `<span class="status-pill ${cls}">${icon(ic)} ${escapeHTML(status)}</span>`;
}
/** Plain-language "what happens next" for each status (accurate feedback, no false promises). */
function nextStepText(r) {
  const service = r.service_id ? state.data.services.find((s) => s.id === r.service_id) : null;
  const office = service ? officeByKey(service.office_key) : null;
  const where = office ? `${office.name} (${[buildingName(office.building_key), office.floor_label, office.room_number].filter(Boolean).join(", ")})` : "the office";
  const t = {
    Submitted: `Received. Waiting for ${office ? office.name : "the office"} to review it${service?.processing_time ? ` — usually ${service.processing_time}` : ""}. Nothing else is needed from you yet.`,
    "In review": "The office is reviewing your submission. You'll be notified here when the status changes.",
    Approved: r._type === "borrow_records" ? `Approved. Pick up the item at ${r.equipment?.location || "The Forge"} on ${formatDate(r.pickup_date)}. Bring your student ID.`
      : r._type === "bookings" ? `Approved. Show this booking and your ID at the room on ${formatDate(r.booking_date)}.`
      : "Approved. The office is preparing it. You'll be notified when it's ready.",
    "Ready for pickup": `Ready. Claim it at ${where}${office?.hours ? ` during ${office.hours}` : ""}. Bring your student ID${service?.what_to_bring?.length ? ` and ${service.what_to_bring.join(", ")}` : ""}.`,
    Confirmed: `Confirmed for ${formatDate(r.preferred_date)}, ${r.time_slot}. Arrive 10 minutes early at ${where}.`,
    Rescheduled: "The office proposed a different schedule. Check the note below or contact the office.",
    Borrowed: `Return the item on or before ${formatDate(r.return_date)}.`,
    "Needs revision": "Update your project based on the note below, then submit a new version.",
    Completed: "Done. No further action needed.", Returned: "Returned. Thank you!", Accepted: "Accepted. Congratulations!",
    Declined: "Declined. Read the note from the office or contact them for help.", Cancelled: "You cancelled this. Submit a new one anytime."
  };
  return t[r.status] || "";
}
function renderStepTracker(r) {
  const flow = RECORD_TYPES[r._type].flow;
  const idx = flow.indexOf(r.status === "Rescheduled" ? "Submitted" : r.status === "Needs revision" ? "In review" : r.status);
  if (idx === -1) return "";
  return `<ol class="steps" aria-label="Progress">${flow.map((step, i) => `<li class="${i < idx ? "done" : i === idx ? "done current" : ""}" ${i === idx ? 'aria-current="step"' : ""}>${escapeHTML(step)}</li>`).join("")}</ol>`;
}
function renderRecordCard(r) {
  const details = r._type === "requests" ? r.details
    : r._type === "appointments" ? `${formatDate(r.preferred_date)} · ${r.time_slot}${r.reason ? ` — ${r.reason}` : ""}`
    : r._type === "bookings" ? `${formatDate(r.booking_date)} · ${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}${r.purpose ? ` — ${r.purpose}` : ""}`
    : r._type === "borrow_records" ? `Pickup ${formatDate(r.pickup_date)} · Return ${formatDate(r.return_date)}${r.purpose ? ` — ${r.purpose}` : ""}`
    : r.description;
  return `
    <article class="record-card">
      <div class="record-head">
        <div><div class="row">${icon(RECORD_TYPES[r._type].icon)}<h3 style="margin:0">${escapeHTML(recordTitle(r))}</h3></div>
          <p class="muted" style="margin:4px 0 0;font-size:.88rem">${RECORD_TYPES[r._type].label} · submitted ${formatDate(r.created_at, true)}${r.building_key ? ` · ${buildingName(r.building_key)}` : ""}</p></div>
        ${statusPill(r.status)}
      </div>
      ${renderStepTracker(r)}
      <div class="next-steps"><strong>What happens next:</strong> ${escapeHTML(nextStepText(r))}</div>
      ${r.staff_note ? `<p style="margin:10px 0 0"><strong>Note from the office:</strong> ${escapeHTML(r.staff_note)}</p>` : ""}
      ${details ? `<p class="muted" style="margin:10px 0 0">${escapeHTML(details)}</p>` : ""}
      ${r._events?.length ? `<details style="margin-top:10px"><summary class="muted">Status history (${r._events.length})</summary>
        <ul class="timeline">${r._events.map((e) => `<li><strong>${escapeHTML(e.status)}</strong> · ${formatDate(e.created_at, true)}${e.note ? ` — ${escapeHTML(e.note)}` : ""}</li>`).join("")}</ul></details>` : ""}
      ${r.status === "Submitted" && r.student_id === state.user.id ? `<div class="dialog-actions"><button class="btn btn-sm btn-danger" type="button" data-action="cancel-record" data-type="${r._type}" data-id="${r.id}">${icon("x-circle")} Cancel</button></div>` : ""}
    </article>`;
}
async function renderMyRequestsPage() {
  const all = (await getMyRecords()).filter((r) => r.student_id === state.user.id);
  const tabs = [["all", "All"], ...Object.entries(RECORD_TYPES).map(([k, v]) => [k, v.label === "Equipment" ? "Equipment" : v.label + "s"])];
  const shown = state.pulseTab === "all" ? all : all.filter((r) => r._type === state.pulseTab);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("My Requests", "Every request, booking and appointment you've submitted, with its current status and what happens next.", `${icon("list-checks")} Status & next steps`)}
    <div class="tabs" role="tablist">${tabs.map(([k, label]) => `<button class="tab" role="tab" type="button" data-action="pulse-tab" data-tab="${k}" aria-selected="${state.pulseTab === k}">${label} (${k === "all" ? all.length : all.filter((r) => r._type === k).length})</button>`).join("")}</div>
    ${shown.length ? `<div class="grid" data-tour="requests-list">${shown.map(renderRecordCard).join("")}</div>`
      : renderEmptyState("Nothing here yet", "Open any service and use its button to submit a request, book a room or set an appointment.", "inbox", `<button class="btn btn-primary" type="button" data-section="finder">${icon("search")} Find a service</button>`)}`;
}

// ---------- Innovation Hub ----------
async function renderInnovationPage() {
  const [equipment, records] = await Promise.all([getEquipmentWithAvailability(), getMyRecords()]);
  const mine = records.filter((r) => r.student_id === state.user.id);
  const borrows = mine.filter((r) => r._type === "borrow_records");
  const projects = mine.filter((r) => r._type === "projects");
  const hereItems = equipment.filter((e) => e.building_key === state.building);
  const elsewhere = equipment.filter((e) => e.building_key !== state.building);
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Innovation Hub", "Borrow maker equipment from The Forge and submit project ideas.", `${icon("lightbulb")} Make & build`,
      `<button class="btn btn-primary" type="button" data-action="open-project-form">${icon("plus")} Submit a project</button>`)}
    ${!hereItems.length && elsewhere.length ? `<div class="notice" style="margin-bottom:16px">${icon("building")} <span>Equipment borrowing isn't offered in ${buildingName()}. Items are picked up at <strong>${escapeHTML(elsewhere[0].location || buildingName(otherBuilding()))}</strong> in ${buildingName(otherBuilding())}.</span></div>` : ""}
    <h2>Equipment</h2>
    ${equipment.length ? `<div class="grid grid-auto">${[...hereItems, ...elsewhere].map((e) => `
      <article class="card ${neonClass(e.name)}">
        <div class="row"><span class="service-icon">${icon(e.icon_name)}</span><div><h3 style="margin:0">${escapeHTML(e.name)}</h3>
          <span class="muted" style="font-size:.86rem">${escapeHTML(buildingName(e.building_key))}</span></div></div>
        <p class="muted" style="margin:10px 0">${escapeHTML(e.description || "")}</p>
        <div class="service-meta"><span>${icon("map-pin")} ${escapeHTML(e.location || "Location to be added")}</span>
          <span>${icon("package-check")} ${e.available === null ? "Availability unknown" : `${e.available} of ${e.total_quantity} available`}</span></div>
        <div class="row" style="margin-top:10px">${e.is_hypothetical ? '<span class="badge badge-sample">Sample data</span>' : ""}<span class="spacer"></span>
          <button class="btn btn-sm btn-primary" type="button" data-action="open-borrow-form" data-id="${e.id}" ${e.available === 0 ? "disabled" : ""}>${e.available === 0 ? "None available" : `${icon("hand")} Borrow`}</button></div>
      </article>`).join("")}</div>` : renderEmptyState("No equipment listed", "The Forge hasn't added equipment yet.", "package")}
    <div class="grid grid-2 section">
      <section><h2>My borrowing</h2>${borrows.length ? `<div class="grid">${borrows.map(renderRecordCard).join("")}</div>` : renderEmptyState("No borrowing requests", "Choose an item above to borrow it.", "package")}</section>
      <section><h2>My projects</h2>${projects.length ? `<div class="grid">${projects.map(renderRecordCard).join("")}</div>` : renderEmptyState("No projects submitted", "Have an idea or a finished project? Submit it for review.", "lightbulb")}</section>
    </div>`;
}

async function renderHandbookPage() {
  const docs = await getDocuments();
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("College Handbook", "The student handbook and official memoranda.", `${icon("book-open")} Policies`)}
    ${docs.length ? `<div class="grid">${docs.map((d) => {
      const url = safeUrl(d.document_url);
      return `<article class="card row"><span class="service-icon">${icon("file-text")}</span>
        <div style="flex:1"><h3 style="margin:0">${escapeHTML(d.title)}</h3><p class="muted" style="margin:2px 0 0">${escapeHTML(d.description || "")} · ${formatDate(d.published_at)}</p></div>
        ${url ? `<a class="btn btn-sm" href="${escapeHTML(url)}" target="_blank" rel="noopener">${icon("external-link")} Open</a>` : '<span class="badge">File not yet uploaded</span>'}</article>`;
    }).join("")}</div>` : renderEmptyState("No documents yet", "Handbook documents haven't been added.", "book-open")}`;
}

function renderSettingsPage() {
  const p = state.profile || {};
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Settings", "Your profile and display preferences.", `${icon("settings")} Preferences`)}
    <div class="grid grid-2">
      <form class="card" data-form="profile">
        <h2>Profile</h2>
        <p class="muted">Used to personalize Quick Access.</p>
        <div class="field"><label for="pName">Name</label><input id="pName" name="full_name" type="text" value="${escapeHTML(p.full_name || "")}" required></div>
        <div class="form-row">
          <div class="field"><label for="pProgram">Program</label><select id="pProgram" name="program"><option value="">Choose…</option>
            ${["Tech", "Arts", "Entrepreneurship"].map((x) => `<option ${p.program === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label for="pYear">Year level</label><select id="pYear" name="year_level"><option value="">Choose…</option>
            ${[1, 2, 3, 4].map((y) => `<option value="${y}" ${p.year_level === y ? "selected" : ""}>${y}${["st", "nd", "rd", "th"][y - 1]} year</option>`).join("")}</select></div>
        </div>
        <p class="muted" style="font-size:.88rem">Signed in as ${escapeHTML(state.user.email)} · Role: ${escapeHTML(p.role || "student")}</p>
        <button class="btn btn-primary" type="submit">Save profile</button>
      </form>
      <section class="card">
        <h2>Display</h2>
        <div class="field"><label for="textSize">Text size</label>
          <select id="textSize" data-setting="text-size">${[["15px", "Small"], ["16px", "Default"], ["18px", "Large"], ["20px", "Extra large"]].map(([v, l]) => `<option value="${v}" ${state.textSize === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <label class="checkbox-row"><input type="checkbox" data-setting="high-contrast" ${state.highContrast ? "checked" : ""}> High contrast</label>
        <p class="form-help">Building colours: Interweave uses CIIT navy and white; Glitch Tower uses charcoal with neon accents. The building name is always shown, so colour is never the only cue.</p>
        <hr style="border:0;border-top:1px solid var(--border);margin:18px 0">
        <button class="btn btn-danger" type="button" data-action="sign-out">${icon("log-out")} Sign out</button>
      </section>
    </div>`;
}

// ---------- Admin panel: statuses, announcements, services and offices ----------
async function renderStaffPage() {
  if (!isStaff()) return navigateTo("home");
  const tabs = [["records", "Requests & bookings"], ["announcements", "Announcements"], ["services", "Services"], ["offices", "Offices"], ["campus", "Canteen & Shuttle"], ["carehub", "Carehub"]];
  if (!tabs.some(([k]) => k === state.staffTab)) state.staffTab = "records";
  let body = "", actions = "";
  const verifiedBadge = (v) => v ? '<span class="badge badge-ok">Verified</span>' : '<span class="badge badge-sample">Sample</span>';

  if (state.staffTab === "records") {
    const [records, profiles] = await Promise.all([getMyRecords(), supabaseClient.from("profiles").select("id, full_name, program, year_level")]);
    const people = Object.fromEntries((profiles.data || []).map((p) => [p.id, p]));
    const open = records.filter((r) => !["Completed", "Returned", "Declined", "Cancelled", "Accepted"].includes(r.status));
    body = open.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Submitted</th><th>Student</th><th>Type</th><th>Item</th><th>Details</th><th>Status & note</th></tr></thead>
      <tbody>${open.map((r) => `<tr>
        <td>${formatDate(r.created_at, true)}</td>
        <td>${escapeHTML(people[r.student_id]?.full_name || "Student")}<br><small class="muted">${escapeHTML([people[r.student_id]?.program, people[r.student_id]?.year_level ? `Year ${people[r.student_id].year_level}` : ""].filter(Boolean).join(" · "))}</small></td>
        <td>${RECORD_TYPES[r._type].label}</td>
        <td><strong>${escapeHTML(recordTitle(r))}</strong></td>
        <td style="max-width:260px">${escapeHTML(r.details || r.reason || r.purpose || r.description || "")}${r.preferred_date ? `<br><small>${formatDate(r.preferred_date)} · ${escapeHTML(r.time_slot)}</small>` : ""}${r.booking_date ? `<br><small>${formatDate(r.booking_date)} · ${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}</small>` : ""}</td>
        <td><form class="grid" style="gap:6px;min-width:220px" data-form="staff-status" data-type="${r._type}" data-id="${r.id}">
          <label class="sr-only" for="st-${r.id}">Status</label>
          <select id="st-${r.id}" name="status">${ALL_STATUSES[r._type].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label class="sr-only" for="sn-${r.id}">Note to student</label>
          <input id="sn-${r.id}" name="staff_note" type="text" placeholder="Note to student (optional)" value="${escapeHTML(r.staff_note || "")}">
          <button class="btn btn-sm btn-primary" type="submit">Update</button></form></td>
      </tr>`).join("")}</tbody></table></div>`
      : renderEmptyState("No open records", "New requests, bookings and appointments from students will appear here.", "inbox");

  } else if (state.staffTab === "announcements") {
    const { data, error } = await supabaseClient.from("announcements").select("*").order("published_at", { ascending: false });
    if (error) throw error;
    state.data.adminAnnouncements = data;
    actions = `<button class="btn btn-primary" type="button" data-action="new-announcement">${icon("plus")} New announcement</button>`;
    body = data.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Announcement</th><th>Shown in</th><th>Published</th><th>Actions</th></tr></thead>
      <tbody>${data.map((a) => `<tr>
        <td style="max-width:420px"><strong>${escapeHTML(a.title)}</strong>${a.tag ? ` <span class="badge badge-info">${escapeHTML(a.tag)}</span>` : ""}<br><small class="muted">${escapeHTML(String(a.body || "").slice(0, 140))}${String(a.body || "").length > 140 ? "…" : ""}</small></td>
        <td>${a.building_key ? escapeHTML(buildingName(a.building_key)) : "Both buildings"}</td>
        <td>${formatDate(a.published_at)}</td>
        <td><div class="row"><button class="btn btn-sm" type="button" data-action="edit-announcement" data-id="${escapeHTML(a.id)}">${icon("pencil")} Edit</button>
          <button class="btn btn-sm btn-danger" type="button" data-action="delete-announcement" data-id="${escapeHTML(a.id)}">${icon("trash-2")} Delete</button></div></td>
      </tr>`).join("")}</tbody></table></div>`
      : renderEmptyState("No announcements yet", "Press New announcement to post the first one.", "megaphone");

  } else if (state.staffTab === "services") {
    const list = servicesIn();
    actions = `<button class="btn btn-primary" type="button" data-action="new-service">${icon("plus")} Add service</button>`;
    body = `<p class="muted">Showing ${list.length} service${list.length === 1 ? "" : "s"} in <strong>${buildingName()}</strong>. Switch buildings at the top to manage the other one. Tick <strong>Verified</strong> once confirmed with the office.</p>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Service (${buildingName()})</th><th>Location</th><th>Hours</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${list.map((s) => `<tr><td><strong>${escapeHTML(s.name)}</strong><br><small class="muted">${escapeHTML(s.category)}</small></td><td>${escapeHTML(locationLine(s))}</td><td>${escapeHTML(s.hours || "—")}</td>
        <td>${verifiedBadge(s.details_verified)}</td>
        <td><div class="row"><button class="btn btn-sm" type="button" data-action="edit-service" data-id="${escapeHTML(s.id)}">${icon("pencil")} Edit</button>
          <button class="btn btn-sm btn-danger" type="button" data-action="delete-service" data-id="${escapeHTML(s.id)}">${icon("trash-2")} Delete</button></div></td></tr>`).join("")}
      </tbody></table></div>` : renderEmptyState("No services in this building", "Press Add service to create the first one.", "building")}`;

  } else if (state.staffTab === "carehub") {
    body = await window.Carehub.renderAdminTab();
  } else if (state.staffTab === "campus") {
    body = await window.CampusToday.renderAdminTab();
  } else {
    body = `<div class="table-wrap"><table><thead><tr><th>Office</th><th>Location</th><th>Hours</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>
      ${state.data.offices.map((o) => `<tr><td><strong>${escapeHTML(o.name)}</strong><br><small class="muted">${buildingName(o.building_key)}</small></td><td>${escapeHTML([o.floor_label, o.room_number].filter(Boolean).join(" · ") || "—")}</td>
        <td>${escapeHTML(o.hours || "—")}</td><td>${escapeHTML(o.email || "—")}</td><td>${verifiedBadge(o.details_verified)}</td>
        <td><button class="btn btn-sm" type="button" data-action="edit-office" data-id="${o.id}">${icon("pencil")} Edit</button></td></tr>`).join("")}
      </tbody></table></div>`;
  }
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Admin Panel", "Update request statuses, post announcements, and keep services and office details current. Changes show to students right away.", `${icon("shield-check")} Admin only`, actions ? `<span data-tour="admin-actions">${actions}</span>` : "")}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" type="button" data-action="staff-tab" data-tab="${k}" aria-selected="${state.staffTab === k}">${l}</button>`).join("")}</div>
    <div id="adminBody">${body}</div>`;
}

// =========================================================
// 9. SERVICE CARDS + DETAIL DIALOG (Feature 1: finder)
// =========================================================
function serviceBadges(s) {
  const b = [];
  if (s.service_type === "Online") b.push(`<span class="badge badge-info">${icon("globe")} Online</span>`);
  if (s.building_key !== state.building) b.push(`<span class="badge badge-building">${icon(BUILDINGS[s.building_key].icon)} ${buildingName(s.building_key)}</span>`);
  else if (s.service_type !== "Online" && serviceByCode(s.service_code, otherBuilding())) b.push(`<span class="badge">Also at ${buildingName(otherBuilding())}</span>`);
  if (s.is_hypothetical) b.push(`<span class="badge badge-sample">${icon("flask-conical")} Sample service</span>`);
  else if (!s.details_verified && s.service_type !== "Online") b.push('<span class="badge badge-sample">Sample details</span>');
  return b.join("");
}
function renderServiceCard(s) {
  return `
    <button class="service-card ${catClass(s.category)}" type="button" data-action="open-service" data-id="${s.id}">
      <div class="service-card-top">
        <span class="service-icon">${icon(serviceIcon(s))}</span>
        <div><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.description || "")}</p></div>
      </div>
      <div class="service-meta">
        <span>${icon(s.service_type === "Online" ? "globe" : "map-pin")} ${escapeHTML(locationLine(s))}</span>
        ${s.hours ? `<span>${icon("clock")} ${escapeHTML(s.hours)}</span>` : ""}
      </div>
      <div class="badges">${serviceBadges(s)}</div>
    </button>`;
}

const ACTION_BUTTONS = {
  request: ["open-request-form", "send", "Start request"],
  appointment: ["open-appointment-form", "calendar-plus", "Request appointment"],
  booking: ["open-booking-form", "calendar-plus", "Book a room"],
  borrow: ["go-innovation", "hand", "Borrow equipment"]
};
function openServiceDialog(id) {
  const s = state.data.services.find((x) => x.id === id);
  if (!s) return;
  // Carehub opens the daily CIITzen Care Hub check-in form (carehub.js) instead of a service page.
  if (s.service_code === "carehub" && window.Carehub) return window.Carehub.open();
  const office = officeByKey(s.office_key);
  const twin = serviceByCode(s.service_code, otherBuilding(s.building_key));
  const url = safeUrl(s.website_url);
  const list = (items) => items?.length ? `<ul>${items.map((i) => `<li>${escapeHTML(i)}</li>`).join("")}</ul>` : '<span class="muted">None listed</span>';
  let actionBtn = "";
  if (ACTION_BUTTONS[s.action_type]) {
    const [action, ic, label] = ACTION_BUTTONS[s.action_type];
    actionBtn = `<button class="btn btn-primary" type="button" data-action="${action}" data-id="${s.id}">${icon(ic)} ${label}</button>`;
  } else if (s.action_type === "link") {
    actionBtn = url ? `<a class="btn btn-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener">${icon("external-link")} Open ${escapeHTML(s.name)}</a>`
      : `<button class="btn" type="button" disabled>${icon("link-2-off")} Link not added yet</button>`;
  }
  const crossNote = s.building_key !== state.building
    ? `<div class="notice" style="margin-bottom:12px">${icon("building")} <span>This service is at <strong>${buildingName(s.building_key)}</strong>, not ${buildingName()}.
        <button class="btn btn-sm" type="button" data-action="switch-building" data-building="${s.building_key}">Switch to ${buildingName(s.building_key)}</button></span></div>`
    : twin && s.service_type !== "Online" ? `<div class="notice" style="margin-bottom:12px">${icon("building-2")} <span>Also available at <strong>${buildingName(twin.building_key)}</strong> — ${escapeHTML(locationLine(twin))}.</span></div>` : "";

  showDialog(s.name, `
    ${crossNote}
    <div class="badges">${serviceBadges(s)}<span class="badge">${escapeHTML(s.category)}</span></div>
    <p style="margin-top:12px">${escapeHTML(s.description || "")}</p>
    <div class="detail-grid">
      <div class="detail-item"><div class="label">${icon("map-pin")} Where</div>${escapeHTML(locationLine(s))}</div>
      <div class="detail-item"><div class="label">${icon("clock")} Hours</div>${escapeHTML(s.hours || office?.hours || "Not yet added")}</div>
      <div class="detail-item"><div class="label">${icon("clipboard-list")} Requirements</div>${list(s.requirements)}</div>
      <div class="detail-item"><div class="label">${icon("backpack")} What to bring</div>${list(s.what_to_bring)}</div>
      ${s.processing_time ? `<div class="detail-item"><div class="label">${icon("timer")} Processing time</div>${escapeHTML(s.processing_time)}</div>` : ""}
      ${office ? `<div class="detail-item"><div class="label">${icon("contact")} Contact</div><strong>${escapeHTML(office.name)}</strong><br>
        ${office.email ? `<a href="mailto:${escapeHTML(office.email)}">${escapeHTML(office.email)}</a><br>` : ""}<small class="muted">${escapeHTML([buildingName(office.building_key), office.floor_label, office.room_number].filter(Boolean).join(" · "))}</small></div>` : ""}
    </div>
    ${s.next_steps ? `<div class="next-steps"><strong>Next step:</strong> ${escapeHTML(s.next_steps)}</div>` : ""}
    ${(s.is_hypothetical || (!s.details_verified && s.service_type !== "Online")) ? `<p class="form-help" style="margin-top:10px">${icon("flask-conical")} Some details are sample data for the prototype and haven't been verified with CIIT.</p>` : ""}
    <div class="dialog-actions">
      <button class="btn" type="button" data-action="toggle-pin" data-code="${escapeHTML(s.service_code)}">${icon("pin")} ${state.shortcutPrefs[s.service_code]?.is_pinned ? "Unpin from" : "Pin to"} Quick access</button>
      ${actionBtn}
    </div>`, { wide: true });
}

// =========================================================
// 10. FORMS
// =========================================================
/** Request form with a review step before submitting (proposal: "reviews it before submitting"). */
function openRequestForm(serviceId) {
  const s = state.data.services.find((x) => x.id === serviceId);
  showDialog(`Request: ${s.name}`, `
    <form data-form="request" data-id="${s.id}" novalidate>
      <div class="notice" style="margin-bottom:12px">${icon("info")} <span>Requirements: ${escapeHTML((s.requirements || []).join("; ") || "none listed")}.</span></div>
      <div class="field"><label for="reqDetails">Details for the office</label>
        <textarea id="reqDetails" name="details" required placeholder="e.g. 2 copies of my TOR for a scholarship application"></textarea>
        <small>Say what you need, how many, and why.</small></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">Review request ${icon("arrow-right")}</button></div>
    </form>`, { description: `${buildingName(s.building_key)} · ${s.processing_time || "Processing time not listed"}` });
}
function showRequestReview(s, details) {
  const office = officeByKey(s.office_key);
  showDialog("Review your request", `
    <dl class="detail-grid">
      <div class="detail-item"><div class="label">Service</div>${escapeHTML(s.name)}</div>
      <div class="detail-item"><div class="label">Building</div>${buildingName(s.building_key)}</div>
      <div class="detail-item" style="grid-column:1/-1"><div class="label">Details</div>${escapeHTML(details)}</div>
      <div class="detail-item"><div class="label">Handled by</div>${escapeHTML(office?.name || "The office")}</div>
      <div class="detail-item"><div class="label">Usually takes</div>${escapeHTML(s.processing_time || "Not listed")}</div>
    </dl>
    <p class="form-help">After you submit, the status starts at <strong>Submitted</strong>. Only the office can change it. You can cancel while it's still Submitted.</p>
    <div class="dialog-actions"><button class="btn" type="button" data-action="edit-request" data-id="${s.id}">${icon("arrow-left")} Edit</button>
      <button class="btn btn-primary" type="button" data-action="confirm-request" data-id="${s.id}">${icon("send")} Submit request</button></div>`);
  state.pendingRequest = { serviceId: s.id, details };
}
async function submitRequest() {
  const { serviceId, details } = state.pendingRequest || {};
  const s = state.data.services.find((x) => x.id === serviceId);
  const { error } = await supabaseClient.from("requests").insert({ service_id: s.id, service_name: s.name, building_key: s.building_key, details });
  if (error) return showToast("We couldn't submit your request. Please try again.", true);
  state.pendingRequest = null;
  closeDialog();
  showToast("Request received. Waiting for the office to review it.");
  navigateTo("pulse");
}

function openAppointmentForm(serviceId) {
  const s = state.data.services.find((x) => x.id === serviceId);
  showDialog(s.name, `
    <form data-form="appointment" data-id="${s.id}" novalidate>
      <div class="form-row">
        <div class="field"><label for="apDate">Preferred date</label><input id="apDate" name="preferred_date" type="date" min="${todayString()}" required></div>
        <div class="field"><label for="apSlot">Preferred time</label><select id="apSlot" name="time_slot" required>${TIME_SLOTS.map((t) => `<option>${t}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="apReason">Reason (optional)</label><textarea id="apReason" name="reason" placeholder="Briefly describe your concern"></textarea>
        <small>${s.service_code === "guidance-appointment-scheduler" ? "Only the Guidance office sees this. If you need help right now, go to the Guidance & Counseling Center or call your local crisis hotline." : "Only the office handling your appointment sees this."}</small></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("calendar-plus")} Request appointment</button></div>
    </form>`, { description: `${buildingName(s.building_key)} · ${s.hours || ""}` });
}
async function submitAppointment(form) {
  const s = state.data.services.find((x) => x.id === form.dataset.id);
  const f = form.elements;
  if (!f.preferred_date.value || f.preferred_date.value < todayString()) return (document.getElementById("formError").textContent = "Choose today or a future date.");
  const { error } = await supabaseClient.from("appointments").insert({
    service_id: s.id, appointment_type: s.name, building_key: s.building_key,
    preferred_date: f.preferred_date.value, time_slot: f.time_slot.value, reason: f.reason.value.trim() || null
  });
  if (error) return showToast("We couldn't send your appointment request. Please try again.", true);
  closeDialog(); showToast("Appointment request received. The office will confirm your slot."); navigateTo("pulse");
}

async function openBookingForm(roomId = null) {
  const rooms = await getBookableRooms();
  const here = rooms.filter((r) => r.building_key === state.building);
  const there = rooms.filter((r) => r.building_key !== state.building);
  const opt = (r) => `<option value="${r.id}" ${r.id === roomId ? "selected" : ""}>${escapeHTML(r.name)}${r.capacity ? ` (up to ${r.capacity})` : ""}</option>`;
  showDialog("Book a space", `
    <form data-form="booking" novalidate>
      <div class="field"><label for="bkRoom">Room</label><select id="bkRoom" name="room_id" required>
        <optgroup label="${buildingName()}">${here.map(opt).join("")}</optgroup>
        ${there.length ? `<optgroup label="${buildingName(otherBuilding())}">${there.map(opt).join("")}</optgroup>` : ""}</select></div>
      <div class="field"><label for="bkDate">Date</label><input id="bkDate" name="booking_date" type="date" min="${todayString()}" required></div>
      <div class="form-row">
        <div class="field"><label for="bkStart">Start</label><input id="bkStart" name="start_time" type="time" min="07:00" max="21:00" step="1800" required></div>
        <div class="field"><label for="bkEnd">End</label><input id="bkEnd" name="end_time" type="time" min="07:00" max="21:00" step="1800" required></div>
      </div>
      <div class="field"><label for="bkPurpose">Purpose</label><input id="bkPurpose" name="purpose" type="text" placeholder="e.g. Group thesis meeting" required></div>
      <p class="form-help">Rooms open 7:00 AM – 9:00 PM. Maximum 3 hours. We check for conflicts before sending.</p>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("calendar-plus")} Send booking request</button></div>
    </form>`);
}
async function submitBooking(form) {
  const f = form.elements; const err = document.getElementById("formError");
  const [sh, sm] = f.start_time.value.split(":").map(Number); const [eh, em] = f.end_time.value.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!f.booking_date.value || f.booking_date.value < todayString()) return (err.textContent = "Choose today or a future date.");
  if (!f.start_time.value || !f.end_time.value || minutes <= 0) return (err.textContent = "End time must be after start time.");
  if (minutes > 180) return (err.textContent = "Bookings can be at most 3 hours.");
  if (!f.purpose.value.trim()) return (err.textContent = "Tell the office what the room is for.");
  const free = await supabaseClient.rpc("room_is_free", { p_room_id: f.room_id.value, p_date: f.booking_date.value, p_start: f.start_time.value, p_end: f.end_time.value });
  if (free.error) return showToast("We couldn't check room availability. Please try again.", true);
  if (!free.data) return (err.textContent = "That room is already requested or booked at that time. Try another time or room.");
  const { error } = await supabaseClient.from("bookings").insert({ room_id: f.room_id.value, booking_date: f.booking_date.value, start_time: f.start_time.value, end_time: f.end_time.value, purpose: f.purpose.value.trim() });
  if (error) return showToast("We couldn't send your booking. Please try again.", true);
  closeDialog(); showToast("Booking request received. Facilities will approve or decline it."); navigateTo("pulse");
}

async function openBorrowForm(equipmentId) {
  const items = await getEquipmentWithAvailability();
  const e = items.find((x) => x.id === equipmentId);
  showDialog(`Borrow: ${e.name}`, `
    <form data-form="borrow" data-id="${e.id}" novalidate>
      <div class="notice" style="margin-bottom:12px">${icon("map-pin")} <span>Pick up at <strong>${escapeHTML(e.location || buildingName(e.building_key))}</strong>. ${e.available} available now.</span></div>
      <div class="field"><label for="brQty">Quantity</label><input id="brQty" name="quantity" type="number" min="1" max="${Math.max(1, e.available)}" value="1" required></div>
      <div class="form-row">
        <div class="field"><label for="brPick">Pickup date</label><input id="brPick" name="pickup_date" type="date" min="${todayString()}" required></div>
        <div class="field"><label for="brRet">Return date</label><input id="brRet" name="return_date" type="date" min="${todayString()}" required></div>
      </div>
      <div class="field"><label for="brPurpose">Purpose</label><input id="brPurpose" name="purpose" type="text" placeholder="e.g. Capstone prototype testing" required></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("hand")} Send borrowing request</button></div>
    </form>`);
  state.borrowMax = e.available;
}
async function submitBorrow(form) {
  const f = form.elements; const err = document.getElementById("formError");
  const qty = Number(f.quantity.value);
  if (!qty || qty < 1 || qty > state.borrowMax) return (err.textContent = `Choose between 1 and ${state.borrowMax}.`);
  if (!f.pickup_date.value || f.pickup_date.value < todayString()) return (err.textContent = "Choose today or a future pickup date.");
  if (!f.return_date.value || f.return_date.value < f.pickup_date.value) return (err.textContent = "Return date can't be before the pickup date.");
  if (!f.purpose.value.trim()) return (err.textContent = "Add a short purpose.");
  const { error } = await supabaseClient.from("borrow_records").insert({ equipment_id: form.dataset.id, quantity: qty, pickup_date: f.pickup_date.value, return_date: f.return_date.value, purpose: f.purpose.value.trim() });
  if (error) return showToast("We couldn't send your borrowing request. Please try again.", true);
  closeDialog(); showToast("Borrowing request received. Wait for approval before pickup."); renderCurrentPage();
}

function openProjectForm() {
  showDialog("Submit a project", `
    <form data-form="project" novalidate>
      <div class="field"><label for="prTitle">Project title</label><input id="prTitle" name="title" type="text" required></div>
      <div class="field"><label for="prType">Type</label><select id="prType" name="project_type">${["Idea / proposal", "Game", "App or website", "Hardware / maker", "Film or animation", "Other"].map((t) => `<option>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="prDesc">Description</label><textarea id="prDesc" name="description" required></textarea></div>
      <div class="field"><label for="prTeam">Team members (optional)</label><input id="prTeam" name="team_members" type="text" placeholder="Names, separated by commas"></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${icon("send")} Submit project</button></div>
    </form>`);
}
async function submitProject(form) {
  const f = form.elements;
  if (!f.title.value.trim() || !f.description.value.trim()) return (document.getElementById("formError").textContent = "Add a title and description.");
  const { error } = await supabaseClient.from("projects").insert({ title: f.title.value.trim(), project_type: f.project_type.value, description: f.description.value.trim(), team_members: f.team_members.value.trim() || null });
  if (error) return showToast("We couldn't submit your project. Please try again.", true);
  closeDialog(); showToast("Project submitted for review."); renderCurrentPage();
}

async function saveProfile(form) {
  const f = form.elements;
  const update = { full_name: f.full_name.value.trim(), program: f.program.value || null, year_level: f.year_level.value ? Number(f.year_level.value) : null };
  const { data, error } = await supabaseClient.from("profiles").update(update).eq("id", state.user.id).select().single();
  if (error) return showToast("We couldn't save your profile.", true);
  state.profile = data; closeDialog(); showToast("Profile saved. Quick access updated."); renderAppShell(); renderCurrentPage();
}
function openProfileDialog() {
  const p = state.profile || {};
  showDialog("Your program and year", `
    <form data-form="profile">
      <input type="hidden" name="full_name" value="${escapeHTML(p.full_name || state.user.email.split("@")[0])}">
      <div class="form-row">
        <div class="field"><label for="dProgram">Program</label><select id="dProgram" name="program" required><option value="">Choose…</option>${["Tech", "Arts", "Entrepreneurship"].map((x) => `<option ${p.program === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label for="dYear">Year level</label><select id="dYear" name="year_level" required><option value="">Choose…</option>${[1, 2, 3, 4].map((y) => `<option value="${y}" ${p.year_level === y ? "selected" : ""}>${y}</option>`).join("")}</select></div>
      </div>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Later</button><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`);
}

/** Customize Quick access: pin or hide any service in this building. */
function openShortcutEditor() {
  const list = servicesIn().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  showDialog("Customize Quick access", `
    <p class="muted"><strong>Always show</strong> pins a service to the top. <strong>Never show</strong> hides it. <strong>Auto</strong> lets Quick access suggest it based on your program and year.</p>
    <div class="table-wrap qp-edit" style="max-height:420px;overflow:auto"><table><thead><tr><th>Service</th><th>In Quick access</th></tr></thead><tbody>
      ${list.map((s) => { const p = state.shortcutPrefs[s.service_code] || {}; const mode = p.is_pinned ? "pin" : p.is_hidden ? "hide" : "auto"; return `<tr><td><div class="row ${catClass(s.category)}" style="flex-wrap:nowrap"><span class="service-icon service-icon-sm">${icon(serviceIcon(s))}</span><span>${escapeHTML(s.name)}<br><small class="muted">${escapeHTML(s.category)}</small></span></div></td>
        <td><select class="qp-mode qp-mode-${mode}" aria-label="Quick access setting for ${escapeHTML(s.name)}" data-pref="mode" data-code="${escapeHTML(s.service_code)}">
          <option value="auto" ${mode === "auto" ? "selected" : ""}>Auto</option>
          <option value="pin" ${mode === "pin" ? "selected" : ""}>Always show</option>
          <option value="hide" ${mode === "hide" ? "selected" : ""}>Never show</option>
        </select></td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="dialog-actions"><button class="btn btn-primary" type="button" data-action="close-and-refresh">Done</button></div>`, { wide: true });
}
async function saveShortcutPref(code, changes) {
  const current = state.shortcutPrefs[code] || { service_code: code, is_pinned: false, is_hidden: false };
  const next = { ...current, ...changes, service_code: code };
  if (changes.is_pinned) next.is_hidden = false;
  if (changes.is_hidden) next.is_pinned = false;
  const { error } = await supabaseClient.from("shortcut_preferences").upsert({ student_id: state.user.id, service_code: code, is_pinned: next.is_pinned, is_hidden: next.is_hidden });
  if (error) return showToast("We couldn't save that shortcut.", true);
  state.shortcutPrefs[code] = next;
}

function openOfficeEditor(id) {
  const o = state.data.offices.find((x) => x.id === id);
  showDialog(`Edit: ${o.name}`, `
    <form data-form="staff-office" data-id="${o.id}">
      <div class="form-row">
        <div class="field"><label for="eoFloor">Floor</label><input id="eoFloor" name="floor_label" type="text" value="${escapeHTML(o.floor_label || "")}"></div>
        <div class="field"><label for="eoRoom">Room</label><input id="eoRoom" name="room_number" type="text" value="${escapeHTML(o.room_number || "")}"></div>
      </div>
      <div class="field"><label for="eoHours">Hours</label><input id="eoHours" name="hours" type="text" value="${escapeHTML(o.hours || "")}"></div>
      <div class="field"><label for="eoBring">What to bring</label><input id="eoBring" name="what_to_bring" type="text" value="${escapeHTML(o.what_to_bring || "")}"></div>
      <div class="field"><label for="eoEmail">Email</label><input id="eoEmail" name="email" type="email" value="${escapeHTML(o.email || "")}"></div>
      <label class="checkbox-row"><input type="checkbox" name="details_verified" ${o.details_verified ? "checked" : ""}> Verified with the office</label>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>
    </form>`);
}
const lines = (v) => v.split("\n").map((x) => x.trim()).filter(Boolean);
async function saveStaffForm(form) {
  const f = form.elements;
  const isService = form.dataset.form === "staff-service";
  const update = isService ? {
    floor_label: f.floor_label.value.trim() || null, room_number: f.room_number.value.trim() || null, hours: f.hours.value.trim() || null,
    requirements: lines(f.requirements.value), what_to_bring: lines(f.what_to_bring.value), processing_time: f.processing_time.value.trim() || null,
    website_url: safeUrl(f.website_url.value.trim()) || null, next_steps: f.next_steps.value.trim() || null, details_verified: f.details_verified.checked
  } : {
    floor_label: f.floor_label.value.trim() || null, room_number: f.room_number.value.trim() || null, hours: f.hours.value.trim() || null,
    what_to_bring: f.what_to_bring.value.trim() || null, email: f.email.value.trim() || null, details_verified: f.details_verified.checked
  };
  const { error } = await supabaseClient.from(isService ? "services" : "offices").update(update).eq("id", form.dataset.id);
  if (error) return showToast("Save failed. Only staff accounts can edit this.", true);
  await loadSharedData(true);
  closeDialog(); showToast("Saved. Students see the update right away."); renderCurrentPage();
}
async function saveStaffStatus(form) {
  const { error } = await supabaseClient.from(form.dataset.type).update({ status: form.elements.status.value, staff_note: form.elements.staff_note.value.trim() || null }).eq("id", form.dataset.id);
  if (error) return showToast("Couldn't update the status.", true);
  showToast("Status updated. The student has been notified."); renderCurrentPage();
}

async function openNotifications() {
  let items = [];
  try { items = await getNotifications(); } catch { return showToast("Couldn't load notifications.", true); }
  showDialog("Notifications", items.length ? `
    <div class="dialog-actions" style="margin-top:0"><button class="btn btn-sm" type="button" data-action="mark-all-read">${icon("check-check")} Mark all as read</button></div>
    ${items.map((n) => `<div class="announcement"><div class="row">${n.is_read ? "" : '<span class="badge badge-info">New</span>'}<strong>${escapeHTML(n.title)}</strong></div>
      <p class="muted" style="margin:4px 0">${escapeHTML(n.body || "")}</p><small class="muted">${formatDate(n.created_at, true)}</small>
      ${n.link_section ? ` · <button class="btn btn-sm btn-ghost" type="button" data-action="notif-go" data-section-target="${escapeHTML(n.link_section)}">View</button>` : ""}</div>`).join("")}`
    : renderEmptyState("No notifications", "When an office updates one of your requests, you'll see it here.", "bell"));
}

function openProfileMenu(anchor) {
  const existing = document.getElementById("profileMenu");
  if (existing) { existing.remove(); return; }
  const menu = document.createElement("div");
  menu.id = "profileMenu"; menu.className = "menu-popover"; menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <p style="padding:6px 10px;margin:0"><strong>${escapeHTML(state.profile?.full_name || "")}</strong><br><small class="muted">${escapeHTML(state.user.email)}</small></p>
    <button class="btn btn-ghost" role="menuitem" type="button" data-section="settings">${icon("settings")} Settings</button>
    <button class="btn btn-ghost" role="menuitem" type="button" data-section="myrequests">${icon("list-checks")} My requests</button>
    <button class="btn btn-ghost phone-only" role="menuitem" type="button" data-action="start-tour" data-tour-section="">${icon("circle-help")} Tutorial</button>
    <button class="btn btn-ghost" role="menuitem" type="button" data-action="sign-out">${icon("log-out")} Sign out</button>`;
  document.body.appendChild(menu);
  refreshIcons();
  menu.querySelector("button").focus();
}

// =========================================================
// 10b. PULSE (SIMULATION), USER MANUAL, TUTORIAL MODE, ADMIN FORMS
// =========================================================

// ---------- PULSE (simulation) ----------
// PULSE is a practice tool for reporting campus concerns. Entries live only in this
// browser (localStorage) and are never sent to CIIT. "My Requests" is the real tracker.
const PULSE_TYPES = [
  { key: "facility", label: "Facility issue", icon: "wrench" },
  { key: "service", label: "Service concern", icon: "headset" },
  { key: "it", label: "IT or Wi-Fi", icon: "wifi" },
  { key: "safety", label: "Safety and security", icon: "shield-alert" },
  { key: "suggestion", label: "Suggestion", icon: "message-square-plus" }
];
const PULSE_STAGES = ["Received", "Routed to office", "Being handled", "Resolved"];
const PULSE_NOTES = [
  "Your concern was logged. A PULSE officer would review it next.",
  "It has been routed to the office that handles this kind of concern.",
  "The office is working on it. You would get updates here.",
  "Resolved. In a real system you would be asked how it went."
];
function pulseKey() { return `gw-pulse-${state.user?.id || "guest"}`; }
function loadPulse() { try { return JSON.parse(localStorage.getItem(pulseKey()) || "[]"); } catch { return []; } }
function savePulse(list) { try { localStorage.setItem(pulseKey(), JSON.stringify(list)); } catch { showToast("Couldn't save in this browser.", true); } }

function renderPulsePage() {
  const list = loadPulse();
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("PULSE", "Report a campus concern or suggestion and watch it move from received to resolved.", `${icon("flask-conical")} Simulation`)}
    <div class="notice notice-sample" role="note" style="margin-bottom:18px">${icon("flask-conical")}
      <span><strong>Simulation only.</strong> PULSE entries are practice data saved in this browser. They are not sent to CIIT.
      Looking for your real requests, bookings or appointments? Open <button class="btn btn-sm" type="button" data-section="myrequests">My Requests</button>.</span></div>
    <div class="grid grid-2">
      <form class="card" id="pulseForm" data-form="pulse-concern" novalidate>
        <h2>Submit a concern</h2>
        <div class="form-row">
          <div class="field"><label for="pcType">Type</label><select id="pcType" name="type">${PULSE_TYPES.map((t) => `<option value="${t.key}">${t.label}</option>`).join("")}</select></div>
          <div class="field"><label for="pcUrgency">Urgency</label><select id="pcUrgency" name="urgency"><option>Low</option><option selected>Normal</option><option>Urgent</option></select></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="pcBuilding">Building</label><select id="pcBuilding" name="building">${Object.entries(BUILDINGS).map(([k, b]) => `<option value="${k}" ${k === state.building ? "selected" : ""}>${b.name}</option>`).join("")}</select></div>
          <div class="field"><label for="pcLocation">Where exactly?</label><input id="pcLocation" name="location" type="text" placeholder="e.g. 5F hallway, Room 502"></div>
        </div>
        <div class="field"><label for="pcText">What happened?</label><textarea id="pcText" name="text" required placeholder="Describe the concern or suggestion."></textarea></div>
        <p class="form-error" id="pulseError" role="alert"></p>
        <button class="btn btn-primary" type="submit">${icon("send")} Submit to PULSE</button>
      </form>
      <section class="card" id="pulseList" aria-labelledby="pulseListTitle">
        <div class="section-head"><h2 id="pulseListTitle">Your PULSE concerns (${list.length})</h2>
          ${list.length ? `<button class="btn btn-sm btn-ghost btn-danger" type="button" data-action="pulse-reset">${icon("trash-2")} Clear all</button>` : ""}</div>
        ${list.length ? `<div class="grid">${list.map(renderPulseCard).join("")}</div>`
          : renderEmptyState("No concerns yet", "Submit one on the left to see how tracking works.", "inbox")}
      </section>
    </div>`;
}
function renderPulseCard(c) {
  const type = PULSE_TYPES.find((t) => t.key === c.type) || PULSE_TYPES[0];
  const done = c.stage >= PULSE_STAGES.length - 1;
  return `
    <article class="record-card">
      <div class="record-head">
        <div><div class="row">${icon(type.icon)}<h3 style="margin:0">${escapeHTML(type.label)}</h3></div>
          <p class="muted" style="margin:4px 0 0;font-size:.88rem">${escapeHTML(c.ref)} · ${formatDate(c.created_at, true)} · ${escapeHTML(buildingName(c.building))}${c.location ? ` · ${escapeHTML(c.location)}` : ""}</p></div>
        <span class="badge ${c.urgency === "Urgent" ? "badge-sample" : ""}">${escapeHTML(c.urgency)}</span>
      </div>
      <p style="margin:10px 0 0">${escapeHTML(c.text)}</p>
      <ol class="steps" aria-label="Progress">${PULSE_STAGES.map((st, i) => `<li class="${i < c.stage ? "done" : i === c.stage ? "done current" : ""}" ${i === c.stage ? 'aria-current="step"' : ""}>${st}</li>`).join("")}</ol>
      <div class="next-steps"><strong>What happens next:</strong> ${escapeHTML(PULSE_NOTES[c.stage])}</div>
      <div class="dialog-actions">
        <button class="btn btn-sm btn-danger" type="button" data-action="pulse-delete" data-id="${escapeHTML(c.id)}">${icon("trash-2")} Delete</button>
        ${done ? "" : `<button class="btn btn-sm btn-primary" type="button" data-action="pulse-advance" data-id="${escapeHTML(c.id)}">${icon("fast-forward")} Move to next stage (demo)</button>`}
      </div>
    </article>`;
}
function submitPulse(form) {
  const f = form.elements;
  const text = f.text.value.trim();
  if (!text) { document.getElementById("pulseError").textContent = "Describe what happened so the simulation has something to track."; f.text.focus(); return; }
  const list = loadPulse();
  list.unshift({
    id: `p${Date.now()}`, ref: `PLS-${String(Date.now()).slice(-5)}`, type: f.type.value, urgency: f.urgency.value,
    building: f.building.value, location: f.location.value.trim(), text, stage: 0, created_at: new Date().toISOString()
  });
  savePulse(list);
  showToast("Submitted to PULSE (simulation).");
  renderPulsePage(); refreshIcons();
}

// ---------- USER MANUAL ----------
const MANUAL = [
  { icon: "rocket", title: "Getting started", tour: "shell", section: "home", steps: [
    "Sign in with your CIIT email (name@ciit.edu.ph) and password.",
    "Use the building switch at the top right to choose Interweave or Glitch Tower. Every page changes to match.",
    "Use the sidebar on the left to move between pages. My Requests is right under Home. Press Services to show or hide the service categories. On tablets it shows icons only. On phones, tap the menu button at the top left to open it.",
    "Use the search box at the top to find any service, room or office in both buildings.",
    "Press Tutorial at the top any time to replay the guided tour."] },
  { icon: "house", title: "Home", tour: "home", section: "home", steps: [
    "The banner greets you and links to Carehub check-in and your open requests.",
    "Announcements show news for your building. Press Hide to dismiss one, or Show hidden to bring them back.",
    "Quick access is the panel on the right side of every page. It lists Carehub, your pinned services, suggestions for your program and year, and the services students use most. Press Customize to pin or hide services. On tablets, open it with the Quick access button in the top bar; on phones it appears on Home.",
    "Each service has its own icon, and each category has its own colour, so you can spot them at a glance."] },
  { icon: "search", title: "Find a Service", tour: "finder", section: "finder", steps: [
    "Type a keyword such as transcript, clinic or Mac lab. Results update as you type.",
    "Use the category chips to narrow the list.",
    "Open a card to see where it is, the hours, requirements and what to bring.",
    "A Sample details badge means the information has not been verified with CIIT yet."] },
  { icon: "graduation-cap", title: "Service categories", tour: "academics", section: "academics", steps: [
    "Academics, Requests, Careers, Student Life, Health and Support each list their services for your current building.",
    "Services found only in the other building are tucked into a section at the bottom.",
    "Open a service card, then use its button to start a request, book a room, set an appointment or borrow equipment."] },
  { icon: "map", title: "Moving Around", tour: "moving", section: "moving", steps: [
    "Pick a floor from the list to see its rooms and the services located there.",
    "Off-limits floors are clearly marked. Follow campus safety instructions."] },
  { icon: "heart-pulse", title: "Carehub check-in", tour: "home", section: "home", steps: [
    "Every day you open GlitchWayve, the CIITzen Care Hub form appears once. You can also open it from Carehub check-in on Home or Carehub in Quick access.",
    "Answer both questions: whether you have any health issue today, and how you're feeling. Then press Submit.",
    "If you don't feel well, you'll see where the Clinic is. If you're going through something, you'll see Guidance & Counseling, and if you need help now, the 24/7 crisis hotline numbers.",
    "Press Change my answers if something changes during the day."] },
  { icon: "clock", title: "Canteen & Shuttle", tour: "campus", section: "campus", steps: [
    "Open Canteen & Shuttle in the menu, or press the Today card on Home.",
    "Food menu: today's meals and snacks, with photos and prices, for the building you're viewing. Interweave and Glitch Tower have different canteens and menus. Press Tomorrow to see the next day's menu if it's posted.",
    "Shuttle schedule: every trip from your building and back, the next trip, and notices such as holidays with no service.",
    "Canteen staff: press Edit menu, use Copy previous day to start quickly, change the dishes and prices, then press Publish menu. Use Mark sold out during the day."] },
  { icon: "contact", title: "Help & Contact", tour: "directory", section: "directory", steps: [
    "Find the office that handles your concern, with its location, hours and email.",
    "Press an email address to write to the office in Gmail, or copy it with one click.",
    "Open the Professors tab to see each professor's classes, rooms and consultation hours. Use the department buttons to filter."] },
  { icon: "activity", title: "PULSE (simulation)", tour: "pulse", section: "pulse", steps: [
    "PULSE is a practice tool for reporting campus concerns. Nothing is sent to CIIT.",
    "Choose a type, urgency, building and location, describe the concern, then press Submit to PULSE.",
    "Your concern appears on the right with a progress tracker.",
    "Press Move to next stage (demo) to see how a real concern would travel from Received to Resolved."] },
  { icon: "list-checks", title: "My Requests", tour: "myrequests", section: "myrequests", steps: [
    "This is your real tracker for requests, appointments, room bookings, equipment and projects.",
    "Use the tabs to filter by type. The number shows how many you have.",
    "Each card shows its status, a progress bar and what happens next.",
    "You can cancel something while its status is still Submitted."] },
  { icon: "lightbulb", title: "Innovation Hub", tour: "innovation", section: "innovation", steps: [
    "Browse equipment from The Forge. The card shows how many are available.",
    "Press Borrow, pick your dates and review before submitting.",
    "Press Submit a project to share an idea or finished work for review.",
    "Your borrowing and project history appears at the bottom."] },
  { icon: "book-open", title: "College Handbook", tour: "handbook", section: "handbook", steps: [
    "Open the student handbook and official memoranda.",
    "A File not yet uploaded badge means the document has not been added."] },
  { icon: "bell", title: "Notifications and profile", tour: "shell", section: "home", steps: [
    "The bell shows updates when an office changes one of your requests. A dot means something is new.",
    "The profile menu at the top right opens Settings, My Requests and Sign out."] },
  { icon: "settings", title: "Settings", tour: "settings", section: "settings", steps: [
    "Set your name, program and year level. Quick access uses them to suggest services.",
    "Change the text size or turn on high contrast.",
    "Sign out when you are done, especially on a shared computer."] },
  { icon: "message-circle-question", title: "Ask GlitchWayve", tour: "shell", section: "home", steps: [
    "Press Ask GlitchWayve at the bottom right to open the FAQ assistant when it is available."] },
  { icon: "shield-check", title: "Admin panel", tour: "staff", section: "staff", staffOnly: true, steps: [
    "Requests and bookings: change a status, add a note, press Update. Students are notified automatically.",
    "Announcements: press New announcement, write the title and message, choose which building sees it, then publish. Edit or Delete any announcement from the list.",
    "Services: press Add service to create one, Edit to change details, or Delete to remove it from student view.",
    "Offices: keep hours, rooms and emails current and tick Verified once confirmed with the office."] }
];
// ---------- Rezbin (recycling partner app) ----------
// TODO: replace with Rezbin's real app link (Play Store / App Store / website).
const REZBIN_APP_URL = "https://play.google.com/store/search?q=rezbin&c=apps";

function renderRezbinPage() {
  const placeholder = (title, ic) => `
    <article class="card">
      <div class="row"><span class="service-icon">${icon(ic)}</span><h3 style="margin:0">${title}</h3></div>
      <p class="muted" style="margin:10px 0 0">Information about this will be added soon.</p>
      <div class="badges" style="margin-top:10px"><span class="badge badge-sample">Placeholder</span></div>
    </article>`;
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("Rezbin", "Recycle right on campus with the Rezbin app.", `${icon("recycle")} Recycling`)}
    <section class="card rz-note" aria-label="A note on recycling">
      <span class="rz-note-icon">${icon("leaf")}</span>
      <div>
        <h2 style="margin:0 0 6px">Keep CIIT clean — sort before you toss</h2>
        <p style="margin:0">Every bottle, can and paper you put in the right bin keeps it out of landfills and our waterways.
          Please separate your waste into <strong>recyclables</strong>, <strong>biodegradables</strong> and <strong>residual</strong> waste,
          rinse containers when you can, and never leave trash behind. Small habits add up when the whole campus does them.
          Download the Rezbin app to find bins and start recycling today.</p>
        <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px">
          <a class="btn btn-primary" href="${REZBIN_APP_URL}" target="_blank" rel="noopener">${icon("download")} Download the Rezbin app</a>
        </div>
      </div>
    </section>
    <div class="grid grid-2" style="margin-top:16px">
      ${placeholder("About Rezbin", "info")}
      ${placeholder("How it works", "list-ordered")}
      ${placeholder("Where to find Rezbin bins", "map-pin")}
      ${placeholder("Rewards and points", "gift")}
    </div>`;
}

function renderManualPage() {
  const items = MANUAL.filter((m) => !m.staffOnly || isStaff());
  document.getElementById("mainContent").innerHTML = `
    ${renderPageHeader("User Manual", "Step-by-step help for every page of GlitchWayve.", `${icon("book-marked")} Help`,
      `<button class="btn btn-primary" type="button" data-action="start-tour" data-tour-section="">${icon("play")} Start full tutorial</button>`)}
    <div class="notice" role="note" style="margin-bottom:16px">${icon("info")}
      <span>Open a topic to read the steps. Press <strong>Show me on screen</strong> to see it in tutorial mode, where the page blurs and each part is explained.</span></div>
    <div class="manual-list" data-tour="manual-list">
      ${items.map((m, i) => `
        <details class="manual-item" ${i === 0 ? "open" : ""}>
          <summary>${icon(m.icon)}<span>${escapeHTML(m.title)}</span></summary>
          <div class="manual-body">
            <ol>${m.steps.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ol>
            <div class="row">
              <button class="btn btn-sm btn-primary" type="button" data-action="start-tour" data-tour-section="${m.tour}">${icon("scan-eye")} Show me on screen</button>
              <button class="btn btn-sm" type="button" data-section="${m.section}">${icon("arrow-right")} Open page</button>
            </div>
          </div>
        </details>`).join("")}
    </div>`;
}

// ---------- TUTORIAL MODE ----------
// Blurs the whole screen, cuts a spotlight around one element, and explains it in a card.
// "shell" steps belong to the always-visible sidebar/top bar. Other steps name their page.
const TOUR_STEPS = [
  { section: "shell", target: "#sidebar .brand", title: "Welcome to GlitchWayve", text: "This is your CIIT student dashboard. Services, rooms, offices and your requests for Interweave and Glitch Tower are all here." },
  { section: "shell", target: "#sidebar", title: "Main menu", text: "Jump between pages here. My Requests is right under Home. Press Services to open or close the service categories. On tablets only icons show. On phones, tap the menu button at the top left to open it." },
  { section: "shell", target: ".building-switch", title: "Switch buildings", text: "Interweave and Glitch Tower have different services, rooms and hours. Switching changes the colours and what every page shows." },
  { section: "shell", target: ".topbar-search", title: "Search everything", text: "Type a service, room or office name and press Enter. It searches both buildings and shows the current one first." },
  { section: "shell", target: ".tour-button", title: "Tutorial button", text: "Replay this tour whenever you like. The User Manual in the menu has the same steps in writing." },
  { section: "shell", target: '[data-action="open-notifications"]', title: "Notifications", text: "When an office updates one of your requests, a dot appears here. Open it to read the message." },
  { section: "shell", target: ".profile-button", title: "Your profile menu", text: "Open Settings, jump to My Requests, or sign out." },
  { section: "shell", target: "#chatbotLauncher", title: "Ask GlitchWayve", text: "Open the FAQ assistant for quick answers. If it says it's coming soon, use search or Help & Contact for now." },

  { section: "home", target: ".hero", title: "Home banner", text: "Your greeting, a Carehub check-in shortcut, and a button to My Requests that shows how many are still open." },
  { section: "home", target: ".announcements-top", title: "Announcements", text: "News for your building. Press Hide to dismiss one and Show hidden to bring dismissed ones back. Admins also get a Manage button here." },
  { section: "home", target: '[data-tour="today"]', title: "Today at your campus", text: "The canteen's current meal and the next shuttle from the building you're viewing. Press either one for the full menu or schedule." },
  { section: "home", target: '[data-tour="quick"]', title: "Quick access", text: "Your most useful services, always on the right side of the screen (on tablets, open it with the Quick access button at the top; on phones it's on Home). Press Customize to pin or hide services. Your requests and their status are in My Requests in the menu." },

  { section: "finder", target: 'form[data-form="finder-search"]', title: "Search box", text: "Type a keyword such as transcript, clinic or Mac lab. Results update as you type." },
  { section: "finder", target: "#mainContent .chips", title: "Category filters", text: "Narrow the results to one category, or choose All to see everything." },
  { section: "finder", target: "#mainContent .section", title: "Results", text: "Press a card to see the floor, room, hours, requirements and what to bring. A Sample details badge means CIIT hasn't verified it yet." },

  { section: "academics", target: "#mainContent .page-header", title: "Service pages", text: "Academics, Requests, Careers, Student Life, Health and Support all work like this page. Each lists the services in your current building." },
  { section: "academics", target: "#mainContent .grid-auto", title: "Service cards", text: "Open a card, then use its button to start a request, book a room, set an appointment, borrow equipment or open a link." },

  { section: "moving", target: ".floor-list", title: "Floors", text: "Pick a floor to see what's on it. Floors that are off limits to students are marked." },
  { section: "moving", target: ".floor-layout > div:nth-child(2)", title: "Rooms and services", text: "The rooms on the chosen floor, plus the services located there." },

  { section: "campus", before: () => { state.campusTab = "canteen"; }, target: '[data-tour="campus-tabs"]', title: "Canteen & Shuttle", text: "Switch between the food menu and the shuttle schedule. Both follow the building switch: each campus has its own canteen." },
  { section: "campus", before: () => { state.campusTab = "canteen"; }, target: '[data-tour="canteen-card"]', title: "Today's menu", text: "Meals and snacks for today, with photos and prices, posted by the canteen every morning. Sold-out dishes are crossed out. Use Tomorrow to plan ahead." },
  { section: "campus", before: () => { state.campusTab = "shuttle"; }, target: '[data-tour="shuttle-times"]', title: "Shuttle schedule", text: "Every trip from this building and back. Yellow trips are peak hours, the outlined one is the next trip, and crossed-out ones have already left." },
  { section: "directory", target: "#mainContent .page-header + *", title: "Offices and contacts", text: "Find who handles your concern, where they are, when they're open and how to email them." },

  { section: "pulse", target: "#pulseForm", title: "PULSE concern form", text: "PULSE is a simulation. Choose a type, urgency and location, describe the concern, then submit. Nothing is sent to CIIT." },
  { section: "pulse", target: "#pulseList", title: "PULSE tracker", text: "Your practice concerns appear here. Press Move to next stage (demo) to see how a concern would go from Received to Resolved." },

  { section: "myrequests", target: "#mainContent .tabs", title: "Filter by type", text: "Switch between requests, appointments, room bookings, equipment and projects. The number shows how many you have." },
  { section: "myrequests", target: '[data-tour="requests-list"]', title: "Your requests", text: "Each card has a progress bar, a plain-language 'What happens next', and a Cancel button while the status is still Submitted." },

  { section: "innovation", target: '[data-action="open-project-form"]', title: "Submit a project", text: "Share an idea or finished project with the Innovation Hub for review." },
  { section: "innovation", target: "#mainContent .grid-auto", title: "Equipment", text: "Maker equipment from The Forge. Each card shows how many are available. Press Borrow to pick your dates." },
  { section: "innovation", target: "#mainContent .grid-2", title: "My borrowing and projects", text: "Track your borrowing requests and project submissions here." },

  { section: "handbook", target: "#mainContent .page-header + *", title: "Handbook and memos", text: "Open the student handbook and official memoranda. A badge tells you if a file hasn't been uploaded yet." },

  { section: "manual", target: '[data-tour="manual-list"]', title: "User Manual", text: "Open any topic for written steps. Press Show me on screen to replay that page's tutorial." },

  { section: "settings", target: 'form[data-form="profile"]', title: "Profile", text: "Set your name, program and year level so Quick access can suggest the right services." },
  { section: "settings", target: "#textSize", title: "Display options", text: "Make the text larger or turn on high contrast. The choice is remembered on this device." },
  { section: "settings", target: '[data-action="sign-out"]', title: "Sign out", text: "Sign out when you're done, especially on a shared computer." },

  { section: "staff", staffOnly: true, before: () => { state.staffTab = "records"; }, target: "#mainContent .tabs", title: "Admin tabs", text: "Switch between student records, announcements, services and offices." },
  { section: "staff", staffOnly: true, before: () => { state.staffTab = "records"; }, target: "#adminBody", title: "Requests and bookings", text: "Pick a new status, add an optional note, then press Update. The student is notified automatically." },
  { section: "staff", staffOnly: true, before: () => { state.staffTab = "announcements"; }, target: '[data-tour="admin-actions"]', title: "Add announcements", text: "Press New announcement, write the message and choose which building sees it. You can edit or delete any announcement in the list below." },
  { section: "staff", staffOnly: true, before: () => { state.staffTab = "services"; }, target: '[data-tour="admin-actions"]', title: "Add services", text: "Press Add service to create one in the building you're viewing. Use Edit to change details or Delete to remove it from student view." },
  { section: "staff", staffOnly: true, before: () => { state.staffTab = "offices"; }, target: "#adminBody", title: "Offices", text: "Keep hours, rooms and emails current. Tick Verified once an office has confirmed the details." }
];

const tour = { active: false, steps: [], i: 0, token: 0 };

function startTour(section = null) {
  const steps = TOUR_STEPS.filter((s) => (!s.staffOnly || isStaff()) && (!section || s.section === section));
  if (!steps.length) return showToast("There's no tutorial for this page yet.", true);
  closeDialog();
  document.getElementById("profileMenu")?.remove();
  if (tour.active) endTour(false);
  tour.active = true; tour.steps = steps; tour.i = 0;
  const root = document.createElement("div");
  root.id = "tourRoot";
  root.innerHTML = `
    <div class="tour-veil"></div>
    <div class="tour-ring" hidden></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" tabindex="-1">
      <p class="tour-count" id="tourCount"></p>
      <h2 id="tourTitle"></h2>
      <p id="tourText"></p>
      <div class="tour-actions">
        <button class="btn btn-sm btn-ghost" type="button" data-action="tour-skip">Skip tutorial</button>
        <span class="spacer"></span>
        <button class="btn btn-sm" type="button" data-action="tour-prev" id="tourPrev">Back</button>
        <button class="btn btn-sm btn-primary" type="button" data-action="tour-next" id="tourNext">Next</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  window.addEventListener("resize", positionTour);
  window.addEventListener("scroll", positionTour, true);
  showTourStep(0);
}
function endTour(finished) {
  tour.active = false; tour.token++;
  setNavOpen(false);
  document.getElementById("tourRoot")?.remove();
  window.removeEventListener("resize", positionTour);
  window.removeEventListener("scroll", positionTour, true);
  try { localStorage.setItem("gw-tour-seen", "1"); } catch { /* storage may be blocked */ }
  if (finished) showToast("Tutorial finished. You can replay it from the Tutorial button.");
}
function tourGo(delta) {
  const next = tour.i + delta;
  if (next < 0) return;
  if (next >= tour.steps.length) return endTour(true);
  showTourStep(next);
}
/** Waits until the wanted page has finished rendering and the target exists (or gives up). */
/** First element matching the selector that is actually on screen (skips hidden copies). */
function visibleQuery(selector) {
  return [...document.querySelectorAll(selector)].find((el) => el.getClientRects().length > 0) || null;
}
function waitForTourTarget(selector, wantedSection, ms = 3500) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const pageReady = (!wantedSection || state.section === wantedSection) && !document.querySelector("#mainContent .skeleton");
      const el = pageReady ? visibleQuery(selector) : null;
      if (el) return resolve(el);
      if (Date.now() - t0 > ms) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}
async function showTourStep(i) {
  const step = tour.steps[i];
  if (!step) return endTour(true);
  tour.i = i;
  const token = ++tour.token;
  const root = document.getElementById("tourRoot");
  root.querySelector("#tourCount").textContent = `Step ${i + 1} of ${tour.steps.length}`;
  root.querySelector("#tourTitle").textContent = step.title;
  root.querySelector("#tourText").textContent = step.text;
  root.querySelector("#tourPrev").disabled = i === 0;
  root.querySelector("#tourNext").textContent = i === tour.steps.length - 1 ? "Finish" : "Next";

  const wanted = step.section === "shell" ? null : step.section;
  setNavOpen(step.target.startsWith("#sidebar"));
  setQuickPanelOpen(step.target.includes("quick"));
  if (step.before) step.before();
  if (wanted && state.section !== wanted) navigateTo(wanted);
  else if (step.before) renderCurrentPage();

  const el = await waitForTourTarget(step.target, wanted);
  if (token !== tour.token || !tour.active) return;
  if (el) el.scrollIntoView({ block: "center", inline: "nearest" });
  positionTour();
  setTimeout(positionTour, 320); // re-measure once the phone menu has finished sliding
  root.querySelector("#tourNext").focus({ preventScroll: true });
}
function positionTour() {
  const root = document.getElementById("tourRoot");
  const step = tour.steps[tour.i];
  if (!tour.active || !root || !step) return;
  const veil = root.querySelector(".tour-veil");
  const ring = root.querySelector(".tour-ring");
  const card = root.querySelector(".tour-card");
  const W = document.documentElement.clientWidth;
  const H = document.documentElement.clientHeight;
  const gap = 14, pad = 8, margin = 12;
  const el = visibleQuery(step.target);
  const r = el ? el.getBoundingClientRect() : null;
  const cardW = card.offsetWidth, cardH = card.offsetHeight;

  if (!r || !r.width || !r.height) {
    veil.style.clipPath = "none"; ring.hidden = true;
    card.style.left = `${Math.max(margin, (W - cardW) / 2)}px`;
    card.style.top = `${Math.max(margin, (H - cardH) / 2)}px`;
    return;
  }
  const x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad);
  const x2 = Math.min(W, r.right + pad), y2 = Math.min(H, r.bottom + pad);
  veil.style.clipPath = `polygon(0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px)`;
  ring.hidden = false;
  Object.assign(ring.style, { left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });

  let top;
  if (H - y2 >= cardH + gap + margin) top = y2 + gap;            // below the target
  else if (y1 >= cardH + gap + margin) top = y1 - cardH - gap;   // above it
  else top = H - cardH - margin;                                 // target fills the screen: dock at the bottom
  let left = Math.min(Math.max(margin, x1), W - cardW - margin);
  if (left < margin) left = margin;
  card.style.left = `${left}px`;
  card.style.top = `${Math.max(margin, top)}px`;
}
function maybeOfferTour() {
  let seen = false;
  try { seen = localStorage.getItem("gw-tour-seen") === "1"; } catch { /* ignore */ }
  if (seen) return;
  showDialog("Welcome to GlitchWayve", `
    <p>New here? Take a short guided tutorial. The screen blurs and each part of the dashboard is explained, one at a time.</p>
    <p class="muted">You can replay it any time from the Tutorial button, or read the User Manual.</p>
    <div class="dialog-actions">
      <button class="btn" type="button" data-action="tour-later">Maybe later</button>
      <button class="btn btn-primary" type="button" data-action="start-tour" data-tour-section="">${icon("play")} Start tutorial</button>
    </div>`);
}

// ---------- ADMIN: announcements + services ----------
const adminOnly = () => { if (isStaff()) return true; showToast("Only admin accounts can do that.", true); return false; };
const findById = (list, id) => (list || []).find((x) => String(x.id) === String(id));

function openAnnouncementEditor(id = null) {
  if (!adminOnly()) return;
  const a = id ? findById(state.data.adminAnnouncements, id) : null;
  const date = (a?.published_at || new Date().toISOString()).slice(0, 10);
  showDialog(a ? "Edit announcement" : "New announcement", `
    <form data-form="staff-announcement" data-id="${a ? escapeHTML(a.id) : ""}" novalidate>
      <div class="field"><label for="anTitle">Title</label><input id="anTitle" name="title" type="text" value="${escapeHTML(a?.title || "")}" required></div>
      <div class="field"><label for="anBody">Message</label><textarea id="anBody" name="body" required>${escapeHTML(a?.body || "")}</textarea></div>
      <div class="form-row">
        <div class="field"><label for="anTag">Label</label><input id="anTag" name="tag" type="text" list="anTags" value="${escapeHTML(a?.tag || "")}" placeholder="e.g. Reminder"></div>
        <div class="field"><label for="anBuilding">Show in</label><select id="anBuilding" name="building_key">
          <option value="" ${!a?.building_key ? "selected" : ""}>Both buildings</option>
          ${Object.entries(BUILDINGS).map(([k, b]) => `<option value="${k}" ${a?.building_key === k ? "selected" : ""}>${b.name} only</option>`).join("")}</select></div>
      </div>
      <datalist id="anTags"><option>Reminder</option><option>Event</option><option>Notice</option><option>Maintenance</option><option>Deadline</option></datalist>
      <div class="field"><label for="anDate">Publish date</label><input id="anDate" name="published_at" type="date" value="${date}"></div>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">${a ? "Save changes" : "Publish"}</button></div>
    </form>`, { description: "Students see this on their Home page." });
}
async function saveAnnouncementForm(form) {
  if (!adminOnly()) return;
  const f = form.elements, err = document.getElementById("formError");
  const title = f.title.value.trim(), body = f.body.value.trim();
  if (!title || !body) { err.textContent = "Add a title and a message."; return; }
  const row = {
    title, body, tag: f.tag.value.trim() || null, building_key: f.building_key.value || null,
    published_at: new Date(`${f.published_at.value || todayString()}T08:00:00`).toISOString()
  };
  const editing = !!form.dataset.id;
  const { data, error } = editing
    ? await supabaseClient.from("announcements").update(row).eq("id", form.dataset.id).select()
    : await supabaseClient.from("announcements").insert(row).select();
  if (error || !data?.length) return showToast(`Couldn't save the announcement. ${error?.message || "Your account may not have permission. See admin-policies.sql."}`, true);
  closeDialog(); showToast(editing ? "Announcement updated." : "Announcement published."); renderCurrentPage();
}
async function deleteAnnouncement(id) {
  const { data, error } = await supabaseClient.from("announcements").delete().eq("id", id).select();
  if (error || !data?.length) return showToast(`Couldn't delete the announcement. ${error?.message || "Your account may not have permission. See admin-policies.sql."}`, true);
  showToast("Announcement deleted."); renderCurrentPage();
}

function makeServiceCode(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
  let code = base, n = 2;
  while (serviceByCode(code)) code = `${base}-${n++}`;
  return code;
}
function openServiceEditor(id = null) {
  if (!adminOnly()) return;
  const s = id ? findById(state.data.services, id) : null;
  if (id && !s) return;
  const distinct = (key, extra = []) => [...new Set([...extra, ...state.data.services.map((x) => x[key])].filter(Boolean))];
  const types = distinct("service_type", ["Online"]);
  const actions = distinct("action_type", ["request", "appointment", "booking", "borrow", "link"]);
  const actionLabel = { request: "Request form", appointment: "Appointment form", booking: "Room booking", borrow: "Equipment borrowing", link: "Link to a website" };
  const opt = (value, label, current) => `<option value="${escapeHTML(value)}" ${value === (current ?? "") ? "selected" : ""}>${escapeHTML(label)}</option>`;
  showDialog(s ? `Edit: ${s.name}` : "Add a service", `
    <form data-form="staff-service" data-id="${s ? escapeHTML(s.id) : ""}" novalidate>
      <div class="field"><label for="esName">Service name</label><input id="esName" name="service_name" type="text" value="${escapeHTML(s?.name || "")}" required></div>
      <div class="field"><label for="esDesc">Short description</label><textarea id="esDesc" name="description">${escapeHTML(s?.description || "")}</textarea></div>
      <div class="form-row">
        <div class="field"><label for="esCat">Category</label><select id="esCat" name="category">${CATEGORIES.map((c) => opt(c.category, c.category, s?.category)).join("")}</select></div>
        <div class="field"><label for="esType">Type</label><select id="esType" name="service_type">${types.map((t) => opt(t, t, s?.service_type)).join("")}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="esAction">Button on the service</label><select id="esAction" name="action_type">
          ${opt("", "None (information only)", s?.action_type)}${actions.map((a) => opt(a, actionLabel[a] || a, s?.action_type)).join("")}</select></div>
        <div class="field"><label for="esOffice">Office</label><select id="esOffice" name="office_key">
          ${opt("", "None", s?.office_key)}${state.data.offices.map((o) => opt(o.office_key, `${o.name} (${buildingName(o.building_key)})`, s?.office_key)).join("")}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="esFloor">Floor</label><input id="esFloor" name="floor_label" type="text" value="${escapeHTML(s?.floor_label || "")}"></div>
        <div class="field"><label for="esRoom">Room / area</label><input id="esRoom" name="room_number" type="text" value="${escapeHTML(s?.room_number || "")}"></div>
      </div>
      <div class="field"><label for="esHours">Hours</label><input id="esHours" name="hours" type="text" value="${escapeHTML(s?.hours || "")}"></div>
      <div class="field"><label for="esReq">Requirements (one per line)</label><textarea id="esReq" name="requirements">${escapeHTML((s?.requirements || []).join("\n"))}</textarea></div>
      <div class="field"><label for="esBring">What to bring (one per line)</label><textarea id="esBring" name="what_to_bring">${escapeHTML((s?.what_to_bring || []).join("\n"))}</textarea></div>
      <div class="form-row">
        <div class="field"><label for="esProc">Processing time</label><input id="esProc" name="processing_time" type="text" value="${escapeHTML(s?.processing_time || "")}"></div>
        <div class="field"><label for="esUrl">Link (https)</label><input id="esUrl" name="website_url" type="text" value="${escapeHTML(s?.website_url || "")}"></div>
      </div>
      <div class="field"><label for="esNext">Next step for students</label><textarea id="esNext" name="next_steps">${escapeHTML(s?.next_steps || "")}</textarea></div>
      <div class="field"><label for="esIcon">Icon name</label><input id="esIcon" name="icon_name" type="text" value="${escapeHTML(s?.icon_name || "circle-dot")}"><small>Any icon name from lucide.dev, e.g. library, printer, heart-pulse.</small></div>
      <label class="checkbox-row"><input type="checkbox" name="is_popular" ${s?.is_popular ? "checked" : ""}> Suggest in Quick access (popular service)</label>
      <label class="checkbox-row"><input type="checkbox" name="details_verified" ${s?.details_verified ? "checked" : ""}> Verified with the office</label>
      <p class="form-error" id="formError" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">${s ? "Save changes" : "Add service"}</button></div>
    </form>`, { wide: true, description: s ? `${buildingName(s.building_key)} · ${s.category}` : `It will be added to ${buildingName()}.` });
}
async function saveServiceForm(form) {
  if (!adminOnly()) return;
  const f = form.elements, err = document.getElementById("formError");
  const name = f.service_name.value.trim();
  if (!name) { err.textContent = "Add a service name."; f.service_name.focus(); return; }
  const rawUrl = f.website_url.value.trim();
  if (rawUrl && !safeUrl(rawUrl)) { err.textContent = "Use a link that starts with https://"; f.website_url.focus(); return; }
  const row = {
    name, description: f.description.value.trim() || null, category: f.category.value, service_type: f.service_type.value,
    action_type: f.action_type.value || null, office_key: f.office_key.value || null,
    floor_label: f.floor_label.value.trim() || null, room_number: f.room_number.value.trim() || null, hours: f.hours.value.trim() || null,
    requirements: lines(f.requirements.value), what_to_bring: lines(f.what_to_bring.value),
    processing_time: f.processing_time.value.trim() || null, website_url: safeUrl(rawUrl) || null, next_steps: f.next_steps.value.trim() || null,
    icon_name: f.icon_name.value.trim() || "circle-dot", is_popular: f.is_popular.checked, details_verified: f.details_verified.checked
  };
  const editing = !!form.dataset.id;
  if (!editing) Object.assign(row, { building_key: state.building, service_code: makeServiceCode(name), is_active: true, is_hypothetical: false });
  const { data, error } = editing
    ? await supabaseClient.from("services").update(row).eq("id", form.dataset.id).select()
    : await supabaseClient.from("services").insert(row).select();
  if (error || !data?.length) return showToast(`Couldn't save the service. ${error?.message || "Your account may not have permission. See admin-policies.sql."}`, true);
  await loadSharedData(true);
  closeDialog(); showToast(editing ? "Service updated. Students see it right away." : "Service added. Students can find it now."); renderCurrentPage();
}
/** "Delete" hides the service from students (is_active = false) so old requests that point to it keep working. */
async function deleteService(id) {
  const { data, error } = await supabaseClient.from("services").update({ is_active: false }).eq("id", id).select();
  if (error || !data?.length) return showToast(`Couldn't delete the service. ${error?.message || "Your account may not have permission."}`, true);
  await loadSharedData(true);
  showToast("Service deleted. Students no longer see it."); renderCurrentPage();
}

// =========================================================
// 11. EVENT HANDLING + START-UP
// =========================================================
async function handleClick(event) {
  const target = event.target.closest("[data-action], [data-section], [data-building-key]");
  if (!target) { document.getElementById("profileMenu")?.remove(); return; }
  if (!target.closest("#profileMenu") && target.dataset.action !== "open-profile-menu") document.getElementById("profileMenu")?.remove();

  if (target.dataset.buildingKey) return setBuilding(target.dataset.buildingKey);
  if (target.dataset.section && !target.dataset.action) { closeDialog(); return navigateTo(target.dataset.section); }

  const { action, id } = target.dataset;
  switch (action) {
    case "toggle-services":
      state.servicesOpen = target.getAttribute("aria-expanded") !== "true";
      localStorage.setItem("gw-services-open", state.servicesOpen);
      target.setAttribute("aria-expanded", String(state.servicesOpen));
      document.getElementById("navServices").hidden = !state.servicesOpen;
      return;
    case "toggle-quick-panel": return setQuickPanelOpen(!state.quickPanelOpen);
    case "close-quick-panel": return setQuickPanelOpen(false);
    case "toggle-nav": return setNavOpen(!document.body.classList.contains("nav-open"), { focus: true });
    case "close-nav": return setNavOpen(false, { focus: true });
    case "close-dialog": return closeDialog();
    case "close-dialog-backdrop": if (event.target === target) closeDialog(); return;
    case "close-and-refresh": closeDialog(); return renderCurrentPage();
    case "retry": state.data.loaded = false; try { await loadSharedData(); } catch (e) { return showPageError(e); } return renderCurrentPage();
    case "sign-out": return signOut();
    case "open-service": return openServiceDialog(id);
    case "switch-building": closeDialog(); return setBuilding(target.dataset.building);
    case "open-request-form": return openRequestForm(id);
    case "edit-request": return openRequestForm(id);
    case "confirm-request": return submitRequest();
    case "open-appointment-form": return openAppointmentForm(id);
    case "open-booking-form": try { return await openBookingForm(target.dataset.room || null); } catch { return showToast("Couldn't load rooms. Try again.", true); }
    case "open-borrow-form": try { return await openBorrowForm(id); } catch { return showToast("Couldn't load equipment. Try again.", true); }
    case "go-innovation": closeDialog(); return navigateTo("innovation");
    case "open-project-form": return openProjectForm();
    case "edit-profile": return openProfileDialog();
    case "edit-shortcuts": return openShortcutEditor();
    case "toggle-pin": {
      const code = target.dataset.code;
      await saveShortcutPref(code, { is_pinned: !state.shortcutPrefs[code]?.is_pinned });
      closeDialog(); showToast(state.shortcutPrefs[code]?.is_pinned ? "Pinned to Quick access." : "Removed from Quick access.");
      renderQuickPanel();
      if (state.section === "home") renderCurrentPage();
      return;
    }
    case "dismiss-announcement":
      await supabaseClient.from("dismissed_announcements").insert({ announcement_id: id });
      return renderCurrentPage();
    case "restore-announcements":
      await supabaseClient.from("dismissed_announcements").delete().eq("student_id", state.user.id);
      return renderCurrentPage();
    case "finder-category": state.finderCategory = target.dataset.category; return renderFinderPage(), refreshIcons();
    case "clear-search": state.finderTerm = ""; renderAppShell(); renderFinderPage(); return refreshIcons();
    case "select-floor": state.floorId = id; return renderCurrentPage();
    case "pulse-tab": state.pulseTab = target.dataset.tab; return renderCurrentPage();
    case "staff-tab": state.staffTab = target.dataset.tab; return renderCurrentPage();
    case "directory-tab": state.directoryTab = target.dataset.tab; return renderCurrentPage();
    case "prof-filter": state.profFilter = target.dataset.filter; return renderCurrentPage();
    case "edit-service": return openServiceEditor(id);
    case "new-service": return openServiceEditor();
    case "delete-service": if (!adminOnly() || !confirmInline(target, "Tap again to delete")) return; return deleteService(id);
    case "new-announcement": return openAnnouncementEditor();
    case "edit-announcement": return openAnnouncementEditor(id);
    case "delete-announcement": if (!adminOnly() || !confirmInline(target, "Tap again to delete")) return; return deleteAnnouncement(id);
    case "manage-announcements": state.staffTab = "announcements"; return navigateTo("staff");
    case "pulse-advance": { const list = loadPulse(); const c = list.find((x) => x.id === id); if (c && c.stage < PULSE_STAGES.length - 1) { c.stage++; savePulse(list); } return renderPulsePage(), refreshIcons(); }
    case "pulse-delete": { if (!confirmInline(target, "Tap again to delete")) return; savePulse(loadPulse().filter((x) => x.id !== id)); showToast("Deleted from PULSE."); return renderPulsePage(), refreshIcons(); }
    case "pulse-reset": { if (!confirmInline(target, "Tap again to clear")) return; savePulse([]); showToast("PULSE simulation cleared."); return renderPulsePage(), refreshIcons(); }
    case "start-tour": return startTour(target.dataset.tourSection || null);
    case "tour-next": return tourGo(1);
    case "tour-prev": return tourGo(-1);
    case "tour-skip": return endTour(false);
    case "tour-later": try { localStorage.setItem("gw-tour-seen", "1"); } catch { /* ignore */ } return closeDialog();
    case "edit-office": return openOfficeEditor(id);
    case "cancel-record": {
      if (!confirmInline(target)) return;
      const { error } = await supabaseClient.from(target.dataset.type).update({ status: "Cancelled" }).eq("id", id);
      if (error) return showToast("Couldn't cancel. It may already be under review.", true);
      showToast("Cancelled."); return renderCurrentPage();
    }
    case "copy-email":
      try { await navigator.clipboard.writeText(target.dataset.email); showToast("Email copied."); } catch { showToast("Couldn't copy. Select the email instead.", true); }
      return;
    case "open-notifications": return openNotifications();
    case "mark-all-read":
      await supabaseClient.from("notifications").update({ is_read: true }).eq("is_read", false);
      await refreshUnreadCount(); return openNotifications();
    case "notif-go": closeDialog(); return navigateTo(target.dataset.sectionTarget === "pulse" ? "myrequests" : target.dataset.sectionTarget);
    case "open-profile-menu": return openProfileMenu(target);
    case "open-chatbot":
      if (window.GlitchWayveChatbot?.open) { document.getElementById("chatbotRoot").hidden = false; return window.GlitchWayveChatbot.open({ building: state.building, services: state.data.services, offices: state.data.offices }); }
      return showDialog("Ask GlitchWayve", `<p>The FAQ assistant is coming soon.</p><p class="muted">Until then, search for a service or ask an office directly.</p>
        <div class="dialog-actions"><button class="btn" type="button" data-section="directory">${icon("contact")} Help & Contact</button><button class="btn btn-primary" type="button" data-section="finder">${icon("search")} Find a service</button></div>`);
    default: return undefined;
  }
}
/** Two-step confirm on the same button (no browser confirm() pop-ups). */
function confirmInline(button, armedText = "Tap again to cancel") {
  if (button.dataset.confirming) return true;
  const original = button.innerHTML;
  button.dataset.confirming = "1";
  button.innerHTML = `${icon("alert-triangle")} ${armedText}`;
  refreshIcons();
  setTimeout(() => { if (document.contains(button)) { delete button.dataset.confirming; button.innerHTML = original; refreshIcons(); } }, 4000);
  return false;
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === "loginForm") { event.preventDefault(); return signIn(form); }
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (["global-search", "home-search", "finder-search"].includes(kind)) {
      state.finderTerm = form.querySelector("input").value.trim();
      state.finderCategory = "all";
      if (state.section === "finder") { renderAppShell(); renderFinderPage(); refreshIcons(); } else navigateTo("finder");
    } else if (kind === "request") {
      const details = form.elements.details.value.trim();
      if (!details) { document.getElementById("formError").textContent = "Add a few details so the office knows what you need."; return; }
      showRequestReview(state.data.services.find((x) => x.id === form.dataset.id), details);
    } else if (kind === "appointment") await submitAppointment(form);
    else if (kind === "booking") await submitBooking(form);
    else if (kind === "borrow") await submitBorrow(form);
    else if (kind === "project") await submitProject(form);
    else if (kind === "profile") await saveProfile(form);
    else if (kind === "pulse-concern") submitPulse(form);
    else if (kind === "staff-announcement") await saveAnnouncementForm(form);
    else if (kind === "staff-service") await saveServiceForm(form);
    else if (kind === "staff-office") await saveStaffForm(form);
    else if (kind === "staff-status") await saveStaffStatus(form);
  } finally {
    if (submit && document.contains(submit)) submit.disabled = false;
  }
}

async function handleChange(event) {
  const el = event.target;
  if (el.dataset.setting === "text-size") { state.textSize = el.value; localStorage.setItem("gw-text-size", el.value); applyAccessibilitySettings(); }
  if (el.dataset.setting === "high-contrast") { state.highContrast = el.checked; localStorage.setItem("gw-high-contrast", el.checked); applyAccessibilitySettings(); }
  if (el.dataset.pref) {
    await saveShortcutPref(el.dataset.code, { is_pinned: el.value === "pin", is_hidden: el.value === "hide" });
    const saved = state.shortcutPrefs[el.dataset.code] || {};
    el.value = saved.is_pinned ? "pin" : saved.is_hidden ? "hide" : "auto";
    el.className = `qp-mode qp-mode-${el.value}`;
    renderQuickPanel();
  }
}

/** Live search on the Finder page: results update as you type (keeps the term when switching buildings). */
let searchTimer;
function handleInput(event) {
  if (event.target.id !== "finderSearch") return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.finderTerm = event.target.value;
    const pos = event.target.selectionStart;
    renderFinderPage(); refreshIcons();
    const input = document.getElementById("finderSearch");
    input.focus(); input.setSelectionRange(pos, pos);
  }, 250);
}

function handleKeydown(event) {
  if (tour.active) {
    if (event.key === "Escape") return endTour(false);
    if (event.key === "ArrowRight") return tourGo(1);
    if (event.key === "ArrowLeft") return tourGo(-1);
    if (event.key === "Tab") {
      const buttons = [...document.querySelectorAll("#tourRoot .tour-card button:not([disabled])")];
      if (!buttons.length) return;
      const at = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
    return;
  }
  if (event.key === "Escape") {
    if (document.body.classList.contains("nav-open")) return setNavOpen(false, { focus: true });
    if (state.quickPanelOpen) { setQuickPanelOpen(false); return document.querySelector(".qp-toggle")?.focus(); }
    document.getElementById("profileMenu")?.remove(); closeDialog();
  }
  // Arrow keys move between the two building buttons
  if (event.target.closest?.(".building-switch") && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    setBuilding(otherBuilding());
    setTimeout(() => document.querySelector(`[data-building-key="${state.building}"]`)?.focus(), 50);
  }
}

function updateOnlineStatus() {
  const banner = document.getElementById("offlineBanner");
  banner.hidden = navigator.onLine;
  refreshIcons();
  if (navigator.onLine && state.user && document.querySelector(".error-state")) renderCurrentPage();
}

async function startGlitchWayve() {
  applyAccessibilitySettings();
  applyBuildingTheme();
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("hashchange", handleRouteChange);
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  if (!supabaseClient) return renderLoginScreen();
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) { state.user = data.session.user; await openDashboard(); }
  else renderLoginScreen();
  supabaseClient.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") renderLoginScreen(); });
}

startGlitchWayve();