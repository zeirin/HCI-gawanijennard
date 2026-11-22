/* =========================================================
   GLITCHWAYVE — CIITzen CARE HUB (daily health + wellbeing check-in)
   Loaded after script.js. Uses its helpers (supabaseClient, state, showDialog, icon…).

   - Students are asked once per day (when they open the dashboard) and can open it any time
     from the Home banner, Quick access or the Carehub service.
   - Two questions, both required: physical health and mood. ("Expected locations" was removed.)
   - After submitting, the student gets a next step that matches the answers:
     clinic info if unwell, Guidance & Counseling if struggling, and crisis hotlines if they need help now.
   - Saved in carehub_checkins (supabase/06_carehub_and_menu.sql). Students only see their own answers.
   ========================================================= */
(function () {
  const HEALTH = [
    { value: "good", label: "None, I feel good." },
    { value: "unwell", label: "Yes, I don't feel well." }
  ];
  const MOODS = [
    { value: "happy", label: "Happy", face: "laugh" },
    { value: "okay", label: "Okay", face: "smile" },
    { value: "going_through", label: "Going through something", face: "frown" },
    { value: "need_help", label: "Really need help", face: "life-buoy" }
  ];
  // Follow-up options, taken from the official CareHub form. Edit these lists to match CIIT's form exactly.
  const SYMPTOMS = [
    "Aches and Pains", "Diarrhea", "Dry Cough", "Fatigue", "Fever", "Headache and/or Dizziness",
    "Loss of Smell and Taste", "Post-Nasal Drip or Phlegm", "Rashes",
    "Runny or Stuffy Nose", "Sore Throat", "Nausea or Vomiting", "Stomach Ache", "Shortness of Breath", "Other"
  ];
  const CONCERNS = [
    "Academic concerns are affecting my mental health.",
    "There are family concerns that I am going through right now.",
    "My relationship with my friends or romantic partner is not going well.",
    "My emotions are overwhelming for me at the moment.",
    "There are a lot of thoughts that are bothering me at the moment.",
    "I am just feeling blue today."
  ];
  // NCMH Crisis Hotline (DOH): 24/7, free. Numbers as published by the DOH, Jan 2026.
  const HOTLINES = [
    { label: "NCMH Crisis Hotline (toll-free)", number: "1553" },
    { label: "Smart / TNT", number: "0919-057-1553" },
    { label: "Globe / TM", number: "0917-899-8727" }
  ];
  let today = null; // today's check-in row, once loaded

  const manilaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const isStudentAccount = () => !state.profile?.role || state.profile.role === "student";

  async function loadToday() {
    const { data, error } = await supabaseClient.from("carehub_checkins").select("*")
      .eq("student_id", state.user.id).eq("checkin_date", manilaDate()).maybeSingle();
    if (error) throw error;
    today = data;
    updateHeroButton();
    return data;
  }
  function updateHeroButton() {
    const btn = document.getElementById("carehubHeroBtn");
    if (!btn) return;
    btn.innerHTML = today ? `${icon("circle-check")} Carehub · checked in` : `${icon("heart-pulse")} Carehub check-in`;
    btn.classList.toggle("is-done", Boolean(today));
    refreshIcons();
  }

  function radioCard(name, value, label, checked, extra = "") {
    return `<label class="ch-option"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} required>
      <span class="ch-option-body">${extra}<span>${escapeHTML(label)}</span></span></label>`;
  }
  function open() {
    const first = (state.profile?.full_name || "").split(/[\s,]+/)[0] || "there";
    showDialog("CIITzen Care Hub", `
      <form data-form="carehub" class="ch-form" novalidate>
        <div class="ch-brand">${icon("heart-handshake")}<div><strong>CIITzen</strong><span>Care Hub</span></div></div>
        <h3 class="ch-lead">Please fill out the CareHub form each time you enter the campus.</h3>
        <p class="ch-note">If you have symptoms and are advised by the clinic to go home, this counts as an excused medical absence
          (you can submit assignments and quizzes that you missed), but it is still included in the computation of your total allowable absences.</p>
        <p class="ch-note">However, failure to declare medical conditions or to follow the clinic's advice may result in disciplinary or academic consequences.</p>
        <hr class="ch-rule">
        <fieldset class="ch-q">
          <legend>Hello ${escapeHTML(first)}, do you have any health issue or discomfort today? <span class="ch-req" aria-hidden="true">*</span></legend>
          <div class="ch-options ch-options-2">${HEALTH.map((h) => radioCard("health", h.value, h.label, today?.health_status === h.value)).join("")}</div>
        </fieldset>
        <fieldset class="ch-q ch-follow" id="chSymptoms" ${today?.health_status === "unwell" ? "" : "hidden"}>
          <legend>What are you feeling? <span class="ch-req" aria-hidden="true">*</span><small>Select all that apply.</small></legend>
          <div class="ch-picker">
            <div class="ch-search">${icon("search")}<input type="search" placeholder="Search for option…" aria-label="Search symptoms" data-ch-filter="symptom"></div>
            <div class="ch-pick-list" role="group" aria-label="Symptoms">${SYMPTOMS.map((x) => `
              <label class="ch-pick" data-ch-item="symptom"><input type="checkbox" name="symptom" value="${escapeHTML(x)}" ${today?.symptoms?.includes(x) ? "checked" : ""}><span>${escapeHTML(x)}</span></label>`).join("")}
              <p class="muted ch-no-match" hidden>No matching symptom. Choose Other and describe it.</p></div>
          </div>
          <div class="ch-selected" id="chSymptomChips" aria-live="polite"></div>
          <input type="text" name="symptom_other" maxlength="120" class="ch-other" placeholder="Describe your symptom" aria-label="Other symptom"
            value="${escapeHTML(today?.symptom_other || "")}" ${today?.symptoms?.includes("Other") ? "" : "hidden"}>
        </fieldset>
        <fieldset class="ch-q">
          <legend>In terms of emotions, how are you feeling today? <span class="ch-req" aria-hidden="true">*</span></legend>
          <div class="ch-options ch-options-grid">${MOODS.map((m) => radioCard("mood", m.value, m.label, today?.mood === m.value, `<span class="ch-face ch-face-${m.value}">${icon(m.face)}</span>`)).join("")}</div>
        </fieldset>
        <fieldset class="ch-q ch-follow" id="chConcerns" ${["going_through", "need_help"].includes(today?.mood) ? "" : "hidden"}>
          <legend>What concerns you at the moment? <span class="ch-req" aria-hidden="true">*</span><small>Select all that apply.</small></legend>
          <div class="ch-pick-list ch-pick-plain" role="group" aria-label="Concerns">${CONCERNS.map((x) => `
            <label class="ch-pick"><input type="checkbox" name="concern" value="${escapeHTML(x)}" ${today?.concerns?.includes(x) ? "checked" : ""}><span>${escapeHTML(x)}</span></label>`).join("")}</div>
        </fieldset>
        <p class="form-error" id="formError" role="alert"></p>
        <p class="form-help">${icon("lock")} Your answers are shared only with authorized CIIT staff so the Clinic and Guidance office can help.</p>
        <div class="dialog-actions"><button class="btn btn-primary" type="submit">${icon("send")} ${today ? "Update check-in" : "Submit"}</button></div>
      </form>`, { wide: true });
    renderSymptomChips();
  }

  /** Show/hide the follow-up questions as the student answers. */
  function syncFollowUps(form) {
    const unwell = form.elements.health.value === "unwell";
    const mood = form.elements.mood.value;
    const sym = form.querySelector("#chSymptoms"), con = form.querySelector("#chConcerns");
    if (sym.hidden === unwell) { sym.hidden = !unwell; }
    con.hidden = !["going_through", "need_help"].includes(mood);
    const other = form.querySelector('input[name="symptom"][value="Other"]');
    form.querySelector(".ch-other").hidden = !(unwell && other?.checked);
    renderSymptomChips();
  }
  function renderSymptomChips() {
    const box = document.getElementById("chSymptomChips");
    if (!box) return;
    const chosen = [...document.querySelectorAll('input[name="symptom"]:checked')].map((c) => c.value);
    box.innerHTML = chosen.length ? `<span class="muted">Selected:</span> ${chosen.map((c) => `<span class="badge badge-info">${escapeHTML(c)}</span>`).join(" ")}` : "";
  }
  function filterSymptoms(term) {
    const t = term.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('[data-ch-item="symptom"]').forEach((el) => {
      const hit = !t || el.textContent.toLowerCase().includes(t) || el.querySelector("input").value === "Other";
      el.hidden = !hit; if (hit && el.querySelector("input").value !== "Other") shown++;
    });
    const none = document.querySelector(".ch-no-match");
    if (none) none.hidden = shown > 0 || !t;
  }

  async function submit(form) {
    const err = document.getElementById("formError");
    const health = form.elements.health.value;
    const mood = form.elements.mood.value;
    if (!health || !mood) return (err.textContent = !health ? "Answer the health question first." : "Choose how you're feeling today.");
    const symptoms = health === "unwell" ? [...form.querySelectorAll('input[name="symptom"]:checked')].map((c) => c.value) : [];
    const symptomOther = symptoms.includes("Other") ? form.elements.symptom_other.value.trim() : "";
    const needsConcerns = ["going_through", "need_help"].includes(mood);
    const concerns = needsConcerns ? [...form.querySelectorAll('input[name="concern"]:checked')].map((c) => c.value) : [];
    if (health === "unwell" && !symptoms.length) { err.textContent = "Select at least one symptom you're feeling."; return form.querySelector("#chSymptoms input").focus(); }
    if (symptoms.includes("Other") && !symptomOther) { err.textContent = "Describe your other symptom."; return form.elements.symptom_other.focus(); }
    if (needsConcerns && !concerns.length) { err.textContent = "Select at least one thing that concerns you."; return form.querySelector('input[name="concern"]').focus(); }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { data, error } = await supabaseClient.from("carehub_checkins")
      .upsert({ student_id: state.user.id, checkin_date: manilaDate(), health_status: health, mood,
        symptoms, symptom_other: symptomOther || null, concerns }, { onConflict: "student_id,checkin_date" })
      .select().single();
    btn.disabled = false;
    if (error) return showToast("We couldn't save your check-in. Please try again.", true);
    today = data;
    updateHeroButton();
    showResult();
  }

  function officeLine(key) {
    const o = state.data.offices.find((x) => x.office_key === key);
    if (!o) return "";
    return `<div class="ch-office">${icon("map-pin")} <span><strong>${escapeHTML(o.name)}</strong> · ${escapeHTML([buildingName(o.building_key), o.floor_label, o.room_number].filter(Boolean).join(", "))}
      ${o.hours ? `<br><small>${escapeHTML(o.hours)}</small>` : ""}${o.email ? `<br><a href="mailto:${escapeHTML(o.email)}">${escapeHTML(o.email)}</a>` : ""}</span></div>`;
  }
  function concernList() {
    return today.concerns?.length ? `<p class="ch-small"><strong>You shared:</strong></p><ul class="ch-concerns">${today.concerns.map((c) => `<li>${escapeHTML(c)}</li>`).join("")}</ul>` : "";
  }
  function showResult() {
    const blocks = [];
    if (today.mood === "need_help") {
      blocks.push(`<div class="ch-result ch-urgent" role="alert">
        <h3>${icon("life-buoy")} You don't have to go through this alone</h3>
        <p>Please talk to someone today. The Guidance & Counseling Center is here for you, and the crisis hotline is free and open 24/7.</p>
        ${concernList()}
        <ul class="ch-hotlines">${HOTLINES.map((h) => `<li><a class="btn" href="tel:${h.number.replace(/-/g, "")}">${icon("phone")} ${escapeHTML(h.number)}</a><small>${escapeHTML(h.label)}</small></li>`).join("")}</ul>
        ${officeLine("guidance")}
        <p class="ch-small">If you or someone else is in immediate danger, call <a href="tel:911"><strong>911</strong></a>.</p>
      </div>`);
    } else if (today.mood === "going_through") {
      blocks.push(`<div class="ch-result ch-support">
        <h3>${icon("hand-heart")} It's okay not to be okay</h3>
        <p>The Guidance & Counseling Center can talk things through with you. Walk-ins are welcome, or request a session.</p>
        ${concernList()}
        ${officeLine("guidance")}
        <button class="btn btn-sm" type="button" data-action="carehub-guidance">${icon("calendar-plus")} Request a counseling session</button>
      </div>`);
    }
    if (today.health_status === "unwell") {
      blocks.push(`<div class="ch-result ch-clinic">
        <h3>${icon("stethoscope")} Please visit the Clinic</h3>
        <p>Go to the clinic before your classes so the nurse can check on you. If the clinic advises you to go home, it counts as an excused medical absence.</p>
        ${today.symptoms?.length ? `<p class="ch-small"><strong>You reported:</strong> ${today.symptoms.map((x) => escapeHTML(x === "Other" && today.symptom_other ? `Other (${today.symptom_other})` : x)).join(", ")}</p>` : ""}
        ${officeLine("clinic")}
      </div>`);
    }
    if (!blocks.length) {
      blocks.push(`<div class="ch-result ch-ok"><h3>${icon("circle-check")} You're checked in for today</h3><p>Thanks for checking in. Have a great day on campus!</p></div>`);
    }
    showDialog("CIITzen Care Hub", `
      <p class="ch-done">${icon("circle-check")} Check-in saved for ${new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}.</p>
      ${blocks.join("")}
      <div class="dialog-actions"><button class="btn" type="button" data-action="carehub-edit">${icon("pencil")} Change my answers</button>
        <button class="btn btn-primary" type="button" data-action="close-dialog">Done</button></div>`, { wide: true });
  }

  /** Ask once per day when a student opens the dashboard. Returns true if the form was shown. */
  async function maybePrompt() {
    if (!isStudentAccount()) return false;
    try {
      const row = await loadToday();
      if (row) return false;
      if (sessionStorage.getItem(`gw-carehub-skip-${manilaDate()}`)) return false;
      open();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // ---------- Admin Panel → Carehub tab ----------
  const MOOD_LABEL = Object.fromEntries(MOODS.map((m) => [m.value, m.label]));
  async function renderAdminTab() {
    const date = manilaDate();
    const [rows, people] = await Promise.all([
      supabaseClient.from("carehub_checkins").select("*").eq("checkin_date", date).order("created_at", { ascending: false }),
      supabaseClient.from("profiles").select("id, full_name, program, year_level")
    ]);
    if (rows.error) throw rows.error;
    const who = Object.fromEntries((people.data || []).map((p) => [p.id, p]));
    const list = rows.data;
    const unwell = list.filter((r) => r.health_status === "unwell");
    const help = list.filter((r) => r.mood === "need_help");
    const struggling = list.filter((r) => r.mood === "going_through");
    const flagged = list.filter((r) => r.health_status === "unwell" || r.mood === "need_help" || r.mood === "going_through")
      .sort((a, b) => (b.mood === "need_help") - (a.mood === "need_help"));
    const stat = (n, label, cls = "") => `<div class="card ch-stat ${cls}"><strong>${n}</strong><span>${label}</span></div>`;
    return `
      <div class="notice notice-sample" style="margin-bottom:14px">${icon("lock")}<span>Sensitive health and wellbeing information. For a real rollout, only the Clinic and Guidance office should have access.</span></div>
      <div class="grid grid-auto" style="margin-bottom:16px">
        ${stat(list.length, "Checked in today")}${stat(unwell.length, "Not feeling well", "ch-stat-clinic")}
        ${stat(struggling.length, "Going through something", "ch-stat-support")}${stat(help.length, "Really need help", "ch-stat-urgent")}
      </div>
      <h3>Students to follow up today</h3>
      ${flagged.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Health</th><th>Mood</th><th>Details</th><th>Checked in</th><th>Who should follow up</th></tr></thead><tbody>
        ${flagged.map((r) => { const p = who[r.student_id] || {}; return `<tr>
          <td><strong>${escapeHTML(p.full_name || "Student")}</strong><br><small class="muted">${escapeHTML([p.program, p.year_level ? `Year ${p.year_level}` : ""].filter(Boolean).join(" · "))}</small></td>
          <td>${r.health_status === "unwell" ? '<span class="badge badge-sample">Not feeling well</span>' : '<span class="badge badge-ok">Feels good</span>'}</td>
          <td>${r.mood === "need_help" ? `<span class="badge badge-sold">${MOOD_LABEL[r.mood]}</span>` : `<span class="badge">${escapeHTML(MOOD_LABEL[r.mood])}</span>`}</td>
          <td style="max-width:280px;font-size:.86rem">${(r.symptoms || []).length ? `<strong>Symptoms:</strong> ${escapeHTML(r.symptoms.map((x) => (x === "Other" && r.symptom_other ? `Other (${r.symptom_other})` : x)).join(", "))}<br>` : ""}${(r.concerns || []).length ? `<strong>Concerns:</strong> ${escapeHTML(r.concerns.join(" "))}` : ""}</td>
          <td>${formatDate(r.updated_at, true)}</td>
          <td>${[r.mood === "need_help" || r.mood === "going_through" ? "Guidance & Counseling" : "", r.health_status === "unwell" ? "Clinic" : ""].filter(Boolean).join(" + ")}</td></tr>`; }).join("")}
        </tbody></table></div>` : renderEmptyState("No one flagged today", "Students who say they feel unwell or need support will appear here.", "heart-pulse")}`;
  }

  // ---------- Events ----------
  document.addEventListener("submit", (event) => {
    if (event.target.dataset?.form !== "carehub") return;
    event.preventDefault(); event.stopPropagation();
    submit(event.target);
  }, true);
  document.addEventListener("change", (event) => {
    const form = event.target.closest?.('form[data-form="carehub"]');
    if (form) { syncFollowUps(form); const err = document.getElementById("formError"); if (err) err.textContent = ""; }
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches?.('[data-ch-filter="symptom"]')) filterSymptoms(event.target.value);
  });
  // Pressing Enter in the symptom search shouldn't submit the whole form
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches?.('[data-ch-filter="symptom"]')) event.preventDefault();
  });
  document.addEventListener("click", (event) => {
    const t = event.target.closest("[data-action]");
    if (!t) return;
    const a = t.dataset.action;
    if (a === "carehub-edit") { event.stopPropagation(); return open(); }
    if (a === "carehub-guidance") {
      event.stopPropagation();
      const s = state.data.services.find((x) => x.service_code === "guidance-appointment-scheduler" && x.building_key === state.building)
        || state.data.services.find((x) => x.service_code === "guidance-appointment-scheduler");
      closeDialog();
      if (s) openAppointmentForm(s.id);
      return;
    }
    // Closing the daily prompt without answering: don't ask again until the next visit today.
    if ((a === "close-dialog" || a === "close-dialog-backdrop") && document.querySelector('form[data-form="carehub"]') && !today) {
      sessionStorage.setItem(`gw-carehub-skip-${manilaDate()}`, "1");
    }
  }, true);

  window.Carehub = { open, maybePrompt, loadToday, updateHeroButton, renderAdminTab, hasCheckedIn: () => Boolean(today) };
})();
