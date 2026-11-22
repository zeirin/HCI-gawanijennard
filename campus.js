/* =========================================================
   GLITCHWAYVE — CAMPUS TODAY (canteen menu + shuttle schedule)
   Loaded after script.js and uses its helpers (supabaseClient, state, icon, escapeHTML…).

   Map of this file:
     1. Time helpers (always Philippine time, whatever the device clock zone)
     2. Data loading
     3. Shuttle helpers (next trip, timetable grid)
     4. Home "Today" card
     5. Canteen & Shuttle page (Food menu tab + Shuttle schedule tab)
     6. Menu editor (admins + canteen staff of THAT campus only)
     7. Admin Panel → Canteen & Shuttle tab (shuttle notices, timetable, canteen details)
     8. Clicks, forms and the once-a-minute refresh
   Security lives in the database (supabase/04_campus_today.sql): canteen staff can only
   change their own campus's menu, and only admins can change the shuttle.
   ========================================================= */
(function () {
  // Facts printed on the CIIT shuttle schedule poster
  const SHUTTLE_FACTS = {
    capacity: 16,
    peakInterval: "every 10 minutes",
    regularInterval: "every 15 minutes",
    reminders: [
      "Arrive at the designated pickup point before the scheduled departure time.",
      "Service intervals may be adjusted based on operational requirements.",
      "The 7:00 PM trip is the final scheduled departure from Interweave."
    ]
  };
  const MEALS = ["Meals", "Snacks"];
  const DISH_TAGS = ["Best seller", "New", "Spicy", "Vegetarian"];

  // ---------- 1. Time helpers ----------
  /** Today's date (YYYY-MM-DD) and minutes since midnight in the Philippines. */
  function manilaNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  }
  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const toMinutes = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  function clock(mins) {
    let h = Math.floor(mins / 60); const m = mins % 60; const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }
  function niceDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
  }

  // ---------- 2. Data loading ----------
  const cache = { canteens: null, trips: null, notices: [] };
  async function getCanteens(force = false) {
    if (cache.canteens && !force) return cache.canteens;
    const { data, error } = await supabaseClient.from("canteens").select("*");
    if (error) throw error;
    cache.canteens = data;
    return data;
  }
  async function getCanteen(building = state.building) {
    return (await getCanteens()).find((c) => c.building_key === building) || null;
  }
  async function getMenu(canteenId, date) {
    const { data, error } = await supabaseClient.from("menu_items").select("*")
      .eq("canteen_id", canteenId).eq("menu_date", date).order("sort_order").order("name");
    if (error) throw error;
    return data.sort((a, b) => MEALS.indexOf(a.meal_period) - MEALS.indexOf(b.meal_period) || a.sort_order - b.sort_order);
  }
  async function getTrips(force = false) {
    if (cache.trips && !force) return cache.trips;
    const { data, error } = await supabaseClient.from("shuttle_trips").select("*").order("depart_time");
    if (error) throw error;
    cache.trips = data;
    return data;
  }
  async function getNotices(fromDate) {
    const { data, error } = await supabaseClient.from("shuttle_notices").select("*")
      .gte("notice_date", fromDate).order("notice_date").limit(20);
    if (error) throw error;
    cache.notices = data;
    return data;
  }
  const isCanteenStaff = () => state.profile?.role === "canteen";
  /** Admins can edit any canteen's menu; canteen staff only the menu of their assigned campus. */
  const canEditMenu = (building) => isStaff() || (isCanteenStaff() && state.profile?.canteen_building === building);

  // ---------- 3. Shuttle helpers ----------
  function tripsFrom(trips, building) {
    return trips.filter((t) => t.from_building === building).map((t) => ({ ...t, min: toMinutes(t.depart_time) }));
  }
  function nextTrip(list, minutes) {
    const i = list.findIndex((t) => t.min >= minutes);
    return i === -1 ? { next: null, after: null } : { next: list[i], after: list[i + 1] || null };
  }
  /** Home "Today" card shuttle box: route, next departure, the next few trips,
      trips left, the way back, and any notice for today. */
  function renderNextShuttle(trips, notices, building) {
    const now = manilaNow();
    const todayNotice = notices.find((n) => n.notice_date === now.date);
    const to = otherBuilding(building);
    const route = `<p class="ct-kicker">${icon("bus")} Shuttle</p>
      <div class="cts-route" aria-label="From ${escapeHTML(buildingName(building))} to ${escapeHTML(buildingName(to))}">
        <span class="cts-dot"></span><strong>${escapeHTML(buildingName(building))}</strong>
        <span class="cts-line" aria-hidden="true">${icon("arrow-right")}</span>
        <span class="cts-dot cts-dot-end"></span><strong>${escapeHTML(buildingName(to))}</strong>
      </div>`;
    if (todayNotice?.no_service) {
      return `${route}<p class="ct-big cts-time">No shuttle today</p>
        <p class="ct-sub ct-warn">${icon("triangle-alert")} ${escapeHTML(todayNotice.message)}</p>`;
    }
    const list = tripsFrom(trips, building);
    if (!list.length) return `${route}<p class="ct-big cts-time">No trips listed yet</p>`;
    const upcoming = list.filter((t) => t.min >= now.minutes);
    const next = upcoming[0];
    const back = tripsFrom(trips, to).find((t) => t.min >= now.minutes);
    const notice = todayNotice ? `<p class="ct-sub ct-warn">${icon("triangle-alert")} ${escapeHTML(todayNotice.message)}</p>` : "";
    if (!next) {
      return `${route}<p class="ct-big cts-time">No more trips today</p>
        <p class="ct-sub">${icon("sunrise")} First trip tomorrow: <strong>${clock(list[0].min)}</strong></p>
        ${back ? `<p class="ct-sub">${icon("undo-2")} From ${escapeHTML(buildingName(to))}: next at <strong>${clock(back.min)}</strong></p>` : ""}${notice}`;
    }
    const wait = next.min - now.minutes;
    const waitText = wait === 0 ? "Leaving now" : wait < 60 ? `in ${wait} min` : `in ${Math.floor(wait / 60)} hr ${wait % 60 ? `${wait % 60} min` : ""}`.trim();
    const later = upcoming.slice(1, 4);
    const last = list[list.length - 1];
    return `${route}
      <div class="cts-next">
        <span class="cts-label">Next departure</span>
        <p class="ct-big cts-time">${clock(next.min)} <span class="cts-wait ${wait <= 5 ? "soon" : ""}">${waitText}</span></p>
        ${next.is_peak ? `<span class="cts-peak">${icon("zap")} Peak trip</span>` : ""}
      </div>
      ${later.length ? `<div class="cts-then"><span>Then</span>${later.map((t) => `<span class="cts-chip ${t.is_peak ? "peak" : ""}">${clock(t.min)}</span>`).join("")}</div>` : ""}
      <ul class="cts-meta">
        <li>${icon("circle-check")} ${upcoming.length} trip${upcoming.length === 1 ? "" : "s"} left · last at ${clock(last.min)}</li>
        ${back ? `<li>${icon("undo-2")} Way back: next from ${escapeHTML(buildingName(to))} at ${clock(back.min)}</li>` : ""}
        <li>${icon("users")} ${SHUTTLE_FACTS.capacity} seats per van · every 10–15 min</li>
      </ul>
      ${notice}`;
  }

  // ---------- 4. Home "Today" card ----------
  async function renderTodayCard() {
    const slot = document.getElementById("todayCard");
    if (!slot) return;
    try {
      const now = manilaNow();
      const [canteen, trips, notices] = await Promise.all([getCanteen(), getTrips(), getNotices(now.date)]);
      const menu = canteen ? await getMenu(canteen.id, now.date) : [];
      // Feature available meals first, then snacks; photos first so the card looks good.
      const available = menu.filter((m) => !m.is_sold_out);
      const featured = [...available].sort((a, b) => (a.meal_period === "Meals" ? 0 : 1) - (b.meal_period === "Meals" ? 0 : 1)
        || Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)));
      slot.innerHTML = `
        <div class="section-head"><h2>${icon("sun")} Today at ${escapeHTML(buildingName())}</h2><span class="muted" style="font-size:.88rem">${niceDate(now.date)}</span></div>
        <div class="ct-today-grid">
          <button class="ct-box" type="button" data-action="campus-open" data-tab="canteen">
            <p class="ct-kicker">${icon("utensils-crossed")} Today's menu · ${escapeHTML(canteen?.name || "Canteen")}</p>
            ${featured.length ? `
              <div class="ct-thumbs">${featured.slice(0, 3).map((m) => { const img = safeUrl(m.image_url); return `
                <span class="ct-thumb">${img ? `<img src="${escapeHTML(img)}" alt="" loading="lazy">` : `<span class="ct-no-photo">${icon("utensils-crossed")}</span>`}
                  <span class="ct-thumb-name">${escapeHTML(m.name)}</span>${m.price != null ? `<span class="ct-thumb-price">₱${Number(m.price).toLocaleString("en-PH")}</span>` : ""}</span>`; }).join("")}</div>`
              : `<p class="ct-big">Today's menu hasn't been posted yet</p>`}
            <p class="ct-link">See full menu ${icon("arrow-right")}</p>
          </button>
          <button class="ct-box" type="button" data-action="campus-open" data-tab="shuttle" id="todayShuttle">
            ${renderNextShuttle(trips, notices, state.building)}
            <p class="ct-link">Full schedule ${icon("arrow-right")}</p>
          </button>
        </div>`;
      refreshIcons();
    } catch (error) {
      console.error(error);
      slot.innerHTML = `<p class="muted">${icon("triangle-alert")} Couldn't load today's menu and shuttle. <button class="btn btn-sm" type="button" data-action="campus-retry-card">Try again</button></p>`;
      refreshIcons();
    }
  }

  // ---------- 5. Canteen & Shuttle page ----------
  async function renderCampusPage() {
    const tab = state.campusTab || "canteen";
    const header = renderPageHeader("Canteen & Shuttle", `Today's food menu and the shuttle schedule between Interweave and Glitch Tower. Showing <strong>${escapeHTML(buildingName())}</strong>.`, `${icon("clock")} Food and shuttle`);
    const tabs = `<div class="tabs" role="tablist" data-tour="campus-tabs">
      <button class="tab" role="tab" type="button" data-action="campus-tab" data-tab="canteen" aria-selected="${tab === "canteen"}">${icon("utensils-crossed")} Food menu</button>
      <button class="tab" role="tab" type="button" data-action="campus-tab" data-tab="shuttle" aria-selected="${tab === "shuttle"}">${icon("bus")} Shuttle schedule</button></div>`;
    const body = tab === "shuttle" ? await renderShuttleTab() : await renderCanteenTab();
    document.getElementById("mainContent").innerHTML = header + tabs + body;
  }

  async function renderCanteenTab() {
    const now = manilaNow();
    const date = state.menuDate && state.menuDate >= now.date ? state.menuDate : now.date;
    const canteen = await getCanteen();
    if (!canteen) return renderEmptyState("No canteen listed", `A canteen for ${escapeHTML(buildingName())} hasn't been added yet.`, "store");
    const menu = await getMenu(canteen.id, date);
    const editable = canEditMenu(state.building);
    const lastUpdate = menu.reduce((t, m) => (m.updated_at > t ? m.updated_at : t), "");
    const other = await getCanteen(otherBuilding());
    const groups = MEALS.map((meal) => [meal, menu.filter((m) => m.meal_period === meal)]).filter(([, items]) => items.length);
    const dayChip = (d, label) => `<button class="chip" type="button" data-action="menu-date" data-date="${d}" aria-pressed="${date === d}">${label}</button>`;

    return `
      <section class="card" data-tour="canteen-card">
        <div class="ct-canteen-head">
          <div class="row" style="flex-wrap:nowrap"><span class="service-icon">${icon("store")}</span>
            <div><h2 style="margin:0">${escapeHTML(canteen.name)}</h2>
              <span class="muted" style="font-size:.9rem">${escapeHTML([canteen.provider_name, canteen.location, canteen.hours].filter(Boolean).join(" · "))}</span></div></div>
          ${editable ? `<button class="btn btn-primary" type="button" data-action="menu-edit" data-date="${date}">${icon("pencil")} Edit menu</button>` : ""}
        </div>
        <div class="row" style="margin:14px 0 4px">
          ${dayChip(now.date, `Today · ${niceDate(now.date)}`)}${dayChip(addDays(now.date, 1), `Tomorrow · ${niceDate(addDays(now.date, 1))}`)}
          <span class="spacer"></span>
          ${lastUpdate ? `<span class="badge">${icon("clock")} Updated ${formatDate(lastUpdate, true)}</span>` : ""}
        </div>
        ${groups.length ? groups.map(([meal, items]) => `
          <h3 class="ct-meal">${escapeHTML(meal)}</h3>
          <div class="ct-dish-grid">${items.map((m) => {
            const img = safeUrl(m.image_url);
            return `
            <article class="ct-dish-card ${m.is_sold_out ? "sold" : ""}">
              <div class="ct-dish-photo">${img ? `<img src="${escapeHTML(img)}" alt="${escapeHTML(m.name)}" loading="lazy">` : `<span class="ct-no-photo">${icon("utensils-crossed")}</span>`}
                ${m.is_sold_out ? '<span class="ct-sold-flag">Sold out</span>' : ""}</div>
              <div class="ct-dish-body">
                <div class="ct-dish-top"><h4>${escapeHTML(m.name)}</h4>${m.price != null ? `<span class="ct-price">₱${Number(m.price).toLocaleString("en-PH", { maximumFractionDigits: 2 })}</span>` : ""}</div>
                ${m.description ? `<p class="ct-desc">${escapeHTML(m.description)}</p>` : ""}
                ${(m.tags || []).length ? `<div class="badges">${m.tags.map((t) => `<span class="badge ct-tag ct-tag-${t.toLowerCase().replace(/\s+/g, "-")}">${escapeHTML(t)}</span>`).join("")}</div>` : ""}
                ${editable ? `<button class="btn btn-sm" type="button" data-action="menu-toggle-sold" data-id="${m.id}" data-sold="${m.is_sold_out}">${m.is_sold_out ? `${icon("rotate-ccw")} Mark available` : `${icon("ban")} Mark sold out`}</button>` : ""}
              </div>
            </article>`;
          }).join("")}</div>`).join("")
          : `<div class="empty-state" style="margin-top:12px">${icon("utensils-crossed")}<h3 style="margin-top:10px">${date === now.date ? "Today's menu hasn't been posted yet" : "No menu posted for this day yet"}</h3>
              <p class="muted">The canteen updates the menu every day. Check back later${date === now.date ? " this morning" : ""}.</p>
              ${editable ? `<button class="btn btn-primary" type="button" data-action="menu-edit" data-date="${date}">${icon("plus")} Post the menu</button>` : ""}</div>`}
      </section>
      ${other ? `<div class="notice section">${icon(BUILDINGS[otherBuilding()].icon)}
        <span>${escapeHTML(buildingName(otherBuilding()))} has its own canteen (${escapeHTML(other.name)}) with a different menu.
        <button class="btn btn-sm" type="button" data-action="switch-building" data-building="${otherBuilding()}">See ${escapeHTML(buildingName(otherBuilding()))}'s menu</button></span></div>` : ""}`;
  }

  // Shuttle view state: which way you're going (defaults to leaving the building you're viewing)
  const shuttleUI = { from: null, building: null, showPast: false };
  function shuttleFrom() {
    if (shuttleUI.building !== state.building) { shuttleUI.building = state.building; shuttleUI.from = state.building; shuttleUI.showPast = false; }
    return shuttleUI.from;
  }
  const PARTS = [
    { name: "Morning", icon: "sunrise", from: 0, to: 720 },
    { name: "Afternoon", icon: "sun", from: 720, to: 1020 },
    { name: "Evening", icon: "moon", from: 1020, to: 1440 }
  ];

  async function renderShuttleTab() {
    const now = manilaNow();
    await Promise.all([getTrips(), getNotices(now.date)]);
    return `<div id="shuttleView">${renderShuttleView()}</div>`;
  }

  /** Builds the whole shuttle tab from cached data, so the once-a-minute refresh can redraw it in place. */
  function renderShuttleView() {
    const now = manilaNow();
    const from = shuttleFrom();
    const to = otherBuilding(from);
    const notices = cache.notices || [];
    const todayNotice = notices.find((n) => n.notice_date === now.date);
    const stopped = Boolean(todayNotice?.no_service);
    const list = tripsFrom(cache.trips || [], from);
    const upcoming = stopped ? [] : list.filter((t) => t.min >= now.minutes);
    const next = upcoming[0] || null;
    const wait = next ? next.min - now.minutes : null;
    const past = list.length - upcoming.length;
    const last = list[list.length - 1];

    const nextBlock = stopped
      ? `<div class="sh-next-main"><small>Today</small><div class="sh-time">No service</div><div class="sh-count sh-warn">${icon("triangle-alert")} ${escapeHTML(todayNotice.message)}</div></div>`
      : next
        ? `<div class="sh-next-main"><small>Next departure</small>
             <div class="sh-time">${clock(next.min)}</div>
             <div class="sh-count ${wait <= 10 ? "sh-soon" : ""}">${wait === 0 ? "Leaving now" : wait < 60 ? `Leaves in ${wait} min` : `Leaves in ${Math.floor(wait / 60)} h ${wait % 60} min`}</div>
             ${next.is_peak ? `<span class="badge badge-peak">${icon("zap")} Peak trip</span>` : ""}</div>
           <div class="sh-then"><small>Then</small><div class="sh-then-list">${upcoming.slice(1, 4).map((t) => `<span class="sh-then-chip ${t.is_peak ? "peak" : ""}">${clock(t.min)}</span>`).join("") || '<span class="muted">Last trip today</span>'}</div></div>`
        : `<div class="sh-next-main"><small>Next departure</small><div class="sh-time">Done for today</div>
             <div class="sh-count">First trip tomorrow: ${list[0] ? clock(list[0].min) : "—"}</div></div>`;

    const groups = PARTS.map((part) => {
      const trips = list.filter((t) => t.min >= part.from && t.min < part.to);
      const visible = shuttleUI.showPast ? trips : trips.filter((t) => stopped || t.min >= now.minutes);
      if (!trips.length) return "";
      return `<div class="sh-part">
        <h3>${icon(part.icon)} ${part.name} <span class="muted">${trips.length} trip${trips.length === 1 ? "" : "s"}</span></h3>
        ${visible.length ? `<div class="sh-chips">${visible.map((t) => {
          const isPast = !stopped && t.min < now.minutes;
          const isNext = t === next;
          const label = `${clock(t.min)}${t.is_peak ? ", peak trip" : ""}${isNext ? ", next departure" : ""}${isPast ? ", already left" : ""}`;
          return `<span class="sh-chip ${t.is_peak ? "peak" : ""} ${isPast ? "past" : ""} ${isNext ? "next" : ""}" aria-label="${label}">
            ${t.is_peak && !isPast ? icon("zap") : ""}${clock(t.min)}${isNext ? '<em>Next</em>' : ""}</span>`;
        }).join("")}</div>` : `<p class="muted sh-none">All ${part.name.toLowerCase()} trips have left.</p>`}
      </div>`;
    }).join("");

    return `
      ${notices.length ? `<div class="ct-notices">${notices.map((n) => `
        <div class="notice ${n.no_service ? "notice-sample" : ""}">${icon(n.no_service ? "ban" : "megaphone")}
          <span><strong>${n.notice_date === now.date ? "Today" : niceDate(n.notice_date)}:</strong> ${escapeHTML(n.message)}</span></div>`).join("")}</div>` : ""}

      <section class="card sh-hero" aria-label="Next shuttle">
        <div class="sh-route">
          <div class="sh-stop"><span class="sh-dot"></span><div><small>From</small><strong>${escapeHTML(buildingName(from))}</strong></div></div>
          <div class="sh-track" aria-hidden="true"><span class="sh-bus">${icon("bus-front")}</span></div>
          <div class="sh-stop sh-stop-end"><span class="sh-dot"></span><div><small>To</small><strong>${escapeHTML(buildingName(to))}</strong></div></div>
          <button class="btn btn-sm sh-swap" type="button" data-action="shuttle-swap" aria-label="Show trips from ${escapeHTML(buildingName(to))} instead">${icon("arrow-left-right")} Swap</button>
        </div>
        <div class="sh-next">${nextBlock}</div>
        <p class="sh-status">${stopped ? `${icon("ban")} No shuttle service today` : `${icon("circle-check")} ${upcoming.length} trip${upcoming.length === 1 ? "" : "s"} left today${last ? ` · last trip ${clock(last.min)}` : ""}`}</p>
      </section>

      <div class="sh-facts">
        <div class="sh-fact">${icon("users")}<div><strong>${SHUTTLE_FACTS.capacity} people</strong><small>per van</small></div></div>
        <div class="sh-fact sh-fact-peak">${icon("zap")}<div><strong>Every 10 min</strong><small>during peak hours</small></div></div>
        <div class="sh-fact">${icon("clock")}<div><strong>Every 15 min</strong><small>regular hours</small></div></div>
        <div class="sh-fact sh-fact-green">${icon("leaf")}<div><strong>100% electric</strong><small>lower emission</small></div></div>
      </div>

      <section class="card" data-tour="shuttle-times">
        <div class="section-head">
          <h2 class="ct-dir">${icon("route")} All trips from ${escapeHTML(buildingName(from))}</h2>
          ${past && !stopped ? `<button class="btn btn-sm" type="button" data-action="shuttle-past" aria-pressed="${shuttleUI.showPast}">${icon(shuttleUI.showPast ? "chevrons-up" : "chevrons-down")} ${shuttleUI.showPast ? "Hide" : "Show"} ${past} earlier trip${past === 1 ? "" : "s"}</button>` : ""}
        </div>
        ${groups || renderEmptyState("No trips listed", "The timetable for this direction hasn't been added.", "bus")}
        <div class="ct-legend">
          <span><span class="sh-chip peak sh-key">${icon("zap")}</span> Peak trip</span>
          <span><span class="sh-chip next sh-key"></span> Next departure</span>
          ${shuttleUI.showPast ? '<span><span class="sh-chip past sh-key"></span> Already left</span>' : ""}
        </div>
      </section>

      <section class="card section ct-reminders-card">
        <h3>${icon("info")} Reminders</h3>
        <ul>${SHUTTLE_FACTS.reminders.map((r) => `<li>${escapeHTML(r)}</li>`).join("")}</ul>
      </section>`;
  }
  function redrawShuttle() {
    const view = document.getElementById("shuttleView");
    if (!view) return;
    view.innerHTML = renderShuttleView();
    refreshIcons();
  }

  // ---------- 6. Menu editor ----------
  const PHOTO_MAX_MB = 5;
  /** Shrinks a photo in the browser (max 1200px, JPEG) so menus load fast and storage stays small. */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("not an image")); };
      img.src = url;
    });
  }
  /** Uploads a dish photo into this campus's folder (menu-photos/<building>/…) and returns its public link. */
  async function uploadMenuPhoto(file, building) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP photo.");
    if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large. Use one under 15 MB.");
    const blob = await compressImage(file);
    if (blob.size > PHOTO_MAX_MB * 1024 * 1024) throw new Error(`Photo is still over ${PHOTO_MAX_MB} MB after resizing.`);
    const path = `${building}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabaseClient.storage.from("menu-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("Upload failed. Only this campus's canteen staff can add photos.");
    return supabaseClient.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
  }

  function photoThumb(url, name) {
    const safe = safeUrl(url);
    return safe ? `<img src="${escapeHTML(safe)}" alt="${escapeHTML(name || "Dish photo")}" loading="lazy">`
      : `<span class="ct-photo-empty">${icon("image-plus")}<small>Add photo</small></span>`;
  }
  /** One dish in the editor: photo, meal, name, price, description, tags, sold out. */
  function editorRow(item = {}) {
    const tags = item.tags || [];
    return `
      <div class="ct-edit-card" data-image="${escapeHTML(item.image_url || "")}">
        <div class="ct-edit-photo">
          <button class="ct-photo-btn" type="button" data-action="menu-photo-pick" aria-label="${item.image_url ? "Change" : "Add"} photo">${photoThumb(item.image_url, item.name)}</button>
          <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" data-photo-input tabindex="-1" aria-hidden="true">
          <button class="ct-photo-remove" type="button" data-action="menu-photo-remove" aria-label="Remove photo" ${item.image_url ? "" : "hidden"}>${icon("x")}</button>
        </div>
        <div class="ct-edit-fields">
          <div class="ct-edit-line">
            <select name="meal" aria-label="Category">${MEALS.map((m) => `<option ${item.meal_period === m ? "selected" : ""}>${m}</option>`).join("")}</select>
            <input name="dish" type="text" aria-label="Dish name" placeholder="Dish name, e.g. Chicken adobo with rice" value="${escapeHTML(item.name || "")}">
            <div class="ct-price-input"><span aria-hidden="true">₱</span><input name="price" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Price in pesos" placeholder="0" value="${item.price ?? ""}"></div>
          </div>
          <input name="description" type="text" maxlength="140" aria-label="Short description" placeholder="Short description (optional), e.g. Served with garlic rice" value="${escapeHTML(item.description || "")}">
          <div class="ct-edit-line ct-edit-meta">
            <div class="ct-tag-picks" role="group" aria-label="Tags">${DISH_TAGS.map((t) => `
              <label class="ct-tag-pick"><input type="checkbox" name="tag" value="${t}" ${tags.includes(t) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>
            <span class="spacer"></span>
            <label class="checkbox-row ct-sold"><input name="sold" type="checkbox" ${item.is_sold_out ? "checked" : ""}> Sold out</label>
            <button class="icon-button" type="button" data-action="menu-row-remove" aria-label="Remove dish">${icon("trash-2")}</button>
          </div>
        </div>
      </div>`;
  }
  async function openMenuEditor(date) {
    const canteen = await getCanteen();
    if (!canEditMenu(state.building)) return showToast("Only this campus's canteen staff can edit this menu.", true);
    const items = await getMenu(canteen.id, date);
    showDialog(`Edit menu · ${canteen.name}`, `
      <form data-form="menu-editor" data-canteen="${canteen.id}" data-building="${canteen.building_key}" novalidate>
        <div class="row" style="margin-bottom:12px">
          <div class="field" style="margin:0"><label for="menuDate">Date</label>
            <input id="menuDate" name="menu_date" type="date" value="${date}" min="${manilaNow().date}"></div>
          <span class="spacer"></span>
          <button class="btn" type="button" data-action="menu-copy-prev">${icon("copy")} Copy previous day</button>
        </div>
        <div id="menuRows">${(items.length ? items : [{ meal_period: "Meals" }, { meal_period: "Meals" }, { meal_period: "Snacks" }]).map(editorRow).join("")}</div>
        <button class="btn" type="button" data-action="menu-row-add" style="margin-top:12px">${icon("plus")} Add dish</button>
        <p class="form-help">Tap a photo box to add a picture (JPG, PNG or WebP). Photos are resized automatically. Students only see the menu for the date it's posted on.</p>
        <p class="form-error" id="formError" role="alert"></p>
        <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button>
          <button class="btn btn-primary" type="submit">${icon("check")} Publish menu</button></div>
      </form>`, { wide: true, description: `${buildingName()} · each campus's canteen edits only its own menu` });
  }
  async function loadRowsForDate(date, { fromPrevious = false } = {}) {
    const form = document.querySelector('form[data-form="menu-editor"]');
    if (!form) return;
    const source = fromPrevious ? addDays(date, -1) : date;
    const items = await getMenu(form.dataset.canteen, source);
    if (fromPrevious && !items.length) return showToast(`No menu was posted on ${niceDate(source)}.`, true);
    document.getElementById("menuRows").innerHTML = (items.length ? items.map((i) => ({ ...i, is_sold_out: fromPrevious ? false : i.is_sold_out })) : [{ meal_period: "Meals" }]).map(editorRow).join("");
    refreshIcons();
    if (fromPrevious) showToast(`Copied ${items.length} dishes (with photos) from ${niceDate(source)}. Edit them, then publish.`);
  }
  async function handlePhotoChosen(input) {
    const card = input.closest(".ct-edit-card");
    const form = input.closest("form");
    const file = input.files?.[0];
    if (!file || !card || !form) return;
    const btn = card.querySelector(".ct-photo-btn");
    const before = btn.innerHTML;
    btn.innerHTML = `<span class="ct-photo-empty">${icon("loader")}<small>Uploading…</small></span>`;
    btn.disabled = true; refreshIcons();
    try {
      const url = await uploadMenuPhoto(file, form.dataset.building);
      card.dataset.image = url;
      btn.innerHTML = photoThumb(url, card.querySelector('[name="dish"]').value);
      card.querySelector(".ct-photo-remove").hidden = false;
      showToast("Photo added. Press Publish menu to save.");
    } catch (e) {
      btn.innerHTML = before;
      showToast(e.message || "Couldn't upload that photo.", true);
    } finally {
      btn.disabled = false; input.value = ""; refreshIcons();
    }
  }
  async function saveMenu(form) {
    const err = document.getElementById("formError");
    const date = form.elements.menu_date.value;
    if (!date) return (err.textContent = "Choose a date.");
    if (form.querySelector(".ct-photo-btn:disabled")) return (err.textContent = "Wait for the photo to finish uploading.");
    const rows = [...form.querySelectorAll(".ct-edit-card")].map((r, i) => ({
      canteen_id: form.dataset.canteen, menu_date: date,
      meal_period: r.querySelector('[name="meal"]').value,
      name: r.querySelector('[name="dish"]').value.trim(),
      price: r.querySelector('[name="price"]').value === "" ? null : Number(r.querySelector('[name="price"]').value),
      description: r.querySelector('[name="description"]').value.trim() || null,
      tags: [...r.querySelectorAll('[name="tag"]:checked')].map((c) => c.value),
      image_url: r.dataset.image || null,
      is_sold_out: r.querySelector('[name="sold"]').checked, sort_order: i
    })).filter((r) => r.name);
    if (!rows.length) return (err.textContent = "Add at least one dish with a name.");
    if (rows.some((r) => r.price != null && (Number.isNaN(r.price) || r.price < 0))) return (err.textContent = "Prices must be 0 or more.");
    // Save the new dishes FIRST, then remove the old ones, so a failed save never leaves the day empty.
    const old = await supabaseClient.from("menu_items").select("id").eq("canteen_id", form.dataset.canteen).eq("menu_date", date);
    if (old.error) return showToast("Couldn't save the menu. Please try again.", true);
    const ins = await supabaseClient.from("menu_items").insert(rows);
    if (ins.error) return showToast("Couldn't save the menu. Only this campus's canteen staff can edit it.", true);
    const oldIds = (old.data || []).map((r) => r.id);
    if (oldIds.length) {
      const del = await supabaseClient.from("menu_items").delete().in("id", oldIds);
      if (del.error) return showToast("New menu saved, but the old dishes couldn't be removed. Refresh and check.", true);
    }
    closeDialog();
    state.menuDate = date;
    showToast(`Menu for ${niceDate(date)} published.`);
    renderCurrentPage();
  }

  // ---------- 7. Admin Panel → Canteen & Shuttle tab ----------
  async function renderAdminTab() {
    const now = manilaNow();
    const [trips, notices, canteens] = await Promise.all([getTrips(true), getNotices(now.date), getCanteens(true)]);
    const tripTable = (b) => {
      const list = tripsFrom(trips, b);
      return `<h3 style="margin-top:16px">From ${escapeHTML(buildingName(b))} (${list.length} trips)</h3>
        <div class="tt-grid">${list.map((t) => `<span class="tt-cell ${t.is_peak ? "peak" : ""} tt-admin">${clock(t.min)}
          <button class="btn btn-sm btn-ghost" type="button" data-action="trip-peak" data-id="${t.id}" data-peak="${t.is_peak}" aria-label="${t.is_peak ? "Unmark" : "Mark"} ${clock(t.min)} as peak">${icon("zap")}</button>
          <button class="btn btn-sm btn-ghost" type="button" data-action="trip-delete" data-id="${t.id}" aria-label="Delete ${clock(t.min)} trip">${icon("x")}</button></span>`).join("")}</div>`;
    };
    return `
      <section class="card">
        <h2>${icon("megaphone")} Shuttle notices</h2>
        <p class="muted">Use this for holidays, delays or changed trips. "No service" hides the next-trip times for that day.</p>
        <form class="ct-admin-form" data-form="shuttle-notice">
          <input name="notice_date" type="date" min="${now.date}" value="${now.date}" aria-label="Notice date" required>
          <input name="message" type="text" placeholder="No shuttle service (holiday)" aria-label="Notice message" required>
          <label class="checkbox-row"><input name="no_service" type="checkbox"> No service that day</label>
          <button class="btn btn-primary" type="submit">${icon("plus")} Post notice</button>
        </form>
        ${notices.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Notice</th><th>Type</th><th></th></tr></thead><tbody>
          ${notices.map((n) => `<tr><td>${niceDate(n.notice_date)}</td><td>${escapeHTML(n.message)}</td><td>${n.no_service ? '<span class="badge badge-sample">No service</span>' : '<span class="badge badge-info">Info</span>'}</td>
            <td><button class="btn btn-sm btn-danger" type="button" data-action="notice-delete" data-id="${n.id}">${icon("trash-2")} Delete</button></td></tr>`).join("")}
          </tbody></table></div>` : '<p class="muted" style="margin-top:10px">No upcoming notices.</p>'}
      </section>
      <section class="card section">
        <h2>${icon("bus")} Shuttle timetable</h2>
        <p class="muted">From the CIIT shuttle schedule poster. ${icon("zap")} toggles peak, × deletes a trip.</p>
        <form class="ct-admin-form" data-form="shuttle-trip">
          <select name="from_building" aria-label="Departs from">${Object.keys(BUILDINGS).map((b) => `<option value="${b}">From ${buildingName(b)}</option>`).join("")}</select>
          <input name="depart_time" type="time" required aria-label="Departure time">
          <label class="checkbox-row"><input name="is_peak" type="checkbox"> Peak trip</label>
          <button class="btn" type="submit">${icon("plus")} Add trip</button>
        </form>
        ${tripTable("interweave")}${tripTable("glitch")}
      </section>
      <section class="card section">
        <h2>${icon("store")} Canteens</h2>
        <p class="muted">Each campus has its own provider. To give a provider access, create their account and run the canteen staff lines in <code>supabase/04_campus_today.sql</code>.</p>
        ${canteens.map((c) => `
          <form class="ct-admin-form" data-form="canteen-info" data-id="${c.id}">
            <strong style="min-width:110px">${escapeHTML(buildingName(c.building_key))}</strong>
            <input name="name" type="text" value="${escapeHTML(c.name)}" aria-label="Canteen name" required>
            <input name="provider_name" type="text" value="${escapeHTML(c.provider_name || "")}" placeholder="Provider" aria-label="Provider">
            <input name="location" type="text" value="${escapeHTML(c.location || "")}" placeholder="Location" aria-label="Location">
            <input name="hours" type="text" value="${escapeHTML(c.hours || "")}" placeholder="Hours" aria-label="Hours">
            <button class="btn btn-sm" type="submit">Save</button>
          </form>`).join("")}
      </section>`;
  }

  // ---------- 8. Clicks, forms, refresh ----------
  async function onClick(event) {
    const t = event.target.closest("[data-action]");
    if (!t) return;
    const a = t.dataset.action;
    const handled = ["campus-open", "campus-tab", "menu-date", "menu-edit", "menu-row-add", "menu-row-remove", "menu-copy-prev",
      "menu-toggle-sold", "campus-retry-card", "menu-photo-pick", "menu-photo-remove", "shuttle-swap", "shuttle-past", "trip-peak", "trip-delete", "notice-delete"];
    if (!handled.includes(a)) return;
    event.stopPropagation();
    try {
      if (a === "campus-open") { state.campusTab = t.dataset.tab; return navigateTo("campus"); }
      if (a === "campus-tab") { state.campusTab = t.dataset.tab; return renderCurrentPage(); }
      if (a === "menu-date") { state.menuDate = t.dataset.date; return renderCurrentPage(); }
      if (a === "menu-edit") return await openMenuEditor(t.dataset.date);
      if (a === "menu-row-add") { document.getElementById("menuRows").insertAdjacentHTML("beforeend", editorRow({ meal_period: "Meals" })); refreshIcons(); return document.querySelector("#menuRows .ct-edit-card:last-child [name=dish]").focus(); }
      if (a === "menu-row-remove") return t.closest(".ct-edit-card").remove();
      if (a === "menu-photo-pick") return t.closest(".ct-edit-card").querySelector("[data-photo-input]").click();
      if (a === "menu-photo-remove") {
        const card = t.closest(".ct-edit-card");
        card.dataset.image = ""; t.hidden = true;
        card.querySelector(".ct-photo-btn").innerHTML = photoThumb("", ""); refreshIcons();
        return;
      }
      if (a === "menu-copy-prev") return await loadRowsForDate(document.getElementById("menuDate").value, { fromPrevious: true });
      if (a === "menu-toggle-sold") {
        const { error } = await supabaseClient.from("menu_items").update({ is_sold_out: t.dataset.sold !== "true" }).eq("id", t.dataset.id);
        if (error) return showToast("Couldn't update that dish.", true);
        return renderCurrentPage();
      }
      if (a === "campus-retry-card") return renderTodayCard();
      if (a === "shuttle-swap") { shuttleFrom(); shuttleUI.from = otherBuilding(shuttleUI.from); shuttleUI.showPast = false; return redrawShuttle(); }
      if (a === "shuttle-past") { shuttleUI.showPast = !shuttleUI.showPast; return redrawShuttle(); }
      if (a === "trip-peak") {
        const { error } = await supabaseClient.from("shuttle_trips").update({ is_peak: t.dataset.peak !== "true" }).eq("id", t.dataset.id);
        if (error) return showToast("Only admins can change the timetable.", true);
        return renderCurrentPage();
      }
      if (a === "trip-delete" || a === "notice-delete") {
        if (!confirmInline(t)) return;
        const { error } = await supabaseClient.from(a === "trip-delete" ? "shuttle_trips" : "shuttle_notices").delete().eq("id", t.dataset.id);
        if (error) return showToast("Couldn't delete it. Only admins can.", true);
        showToast("Deleted."); return renderCurrentPage();
      }
    } catch (error) {
      console.error(error); showToast("Something went wrong. Please try again.", true);
    }
  }
  async function onSubmit(event) {
    const form = event.target;
    const kind = form.dataset.form;
    if (!["menu-editor", "shuttle-notice", "shuttle-trip", "canteen-info"].includes(kind)) return;
    event.preventDefault();
    event.stopPropagation();
    const f = form.elements;
    if (kind === "menu-editor") return saveMenu(form);
    let res;
    if (kind === "shuttle-notice") {
      if (!f.message.value.trim()) return showToast("Write the notice first.", true);
      res = await supabaseClient.from("shuttle_notices").insert({ notice_date: f.notice_date.value, message: f.message.value.trim(), no_service: f.no_service.checked });
    } else if (kind === "shuttle-trip") {
      if (!f.depart_time.value) return showToast("Choose a departure time.", true);
      res = await supabaseClient.from("shuttle_trips").insert({ from_building: f.from_building.value, depart_time: f.depart_time.value, is_peak: f.is_peak.checked });
    } else {
      res = await supabaseClient.from("canteens").update({ name: f.name.value.trim(), provider_name: f.provider_name.value.trim() || null, location: f.location.value.trim() || null, hours: f.hours.value.trim() || null }).eq("id", form.dataset.id);
    }
    if (res.error) return showToast(res.error.code === "23505" ? "That trip already exists." : "Couldn't save. Only admins can change this.", true);
    showToast("Saved. Students see it right away.");
    renderCurrentPage();
  }
  function onChange(event) {
    if (event.target.matches?.("[data-photo-input]")) return handlePhotoChosen(event.target);
    if (event.target.id === "menuDate") loadRowsForDate(event.target.value).catch(console.error);
  }
  /** Once a minute, refresh only the "next shuttle" parts in place, so times stay current
      without reloading the page or jumping the scroll position. */
  function tick() {
    if (!state.user || document.hidden || !cache.trips) return;
    const homeBox = document.getElementById("todayShuttle");
    if (homeBox) { homeBox.innerHTML = renderNextShuttle(cache.trips, cache.notices, state.building) + `<p class="ct-link">Full schedule ${icon("arrow-right")}</p>`; refreshIcons(); }
    if (!document.querySelector(".dialog")) redrawShuttle();
  }


  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("change", onChange);
  setInterval(tick, 60000);

  window.CampusToday = { renderCampusPage, renderTodayCard, renderAdminTab, isCanteenStaff, manilaNow };
})();
