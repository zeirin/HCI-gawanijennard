/* =========================================================
   FOUNDIT — CAMPUS LOST & FOUND (web version of the FoundIt Android app)
   Shown under Services → FoundIt. script.js calls window.FoundIt.render(main).

   FoundIt keeps its OWN Supabase project, separate from GlitchWayve's:
     * same posts, photos and comments as the mobile app
     * its own login (email + password + Google Authenticator code)
     * its session is stored under its own browser key ("foundit-auth"),
       so it never touches the GlitchWayve login.
   Every request is checked on the server by Row Level Security and the
   database only answers sessions that passed 2FA (aal2).
   Uses helpers from script.js: escapeHTML, icon, refreshIcons, showToast,
   showDialog, closeDialog, renderPageHeader, renderEmptyState, renderLoading,
   formatDate, state.
   ========================================================= */
(() => {
  // Publishable key only (safe in the browser). Never put a secret/service_role key here.
  const FI_URL = "https://tljyfqubjnksiusrbzjl.supabase.co";
  const FI_KEY = "sb_publishable_B0mhxOynPJ8c5LIUm3o1Lw_zkmlf9bl";
  const BUCKET = "item-images";
  const CATEGORIES = ["Bags", "IDs & Cards", "Electronics", "Clothing", "Books", "Keys", "Others"];
  const CIIT_EMAIL_DOMAIN = "ciit.edu.ph"; // posters must give a school email ending in this
  const MAX_CODE_ATTEMPTS = 5;

  const fi = {
    client: null,
    stage: null,           // "logged_out" | "needs_enroll" | "needs_verify" | "ready"
    view: "browse",        // "browse" | "post" | "mine" | "account" | "rewards" | "detail" | "edit"
    detailId: null,
    backTo: "browse",
    query: "", type: null, category: null,
    registering: false,
    forgot: false,         // showing the "reset password" screen instead of login
    resetEmail: "",
    resetSent: false,      // step 2 of the reset (code + new password)
    resetting: false,      // true while the temporary recovery session exists
    enrollment: null,
    codeAttempts: 0,
    unread: 0,
    channel: null,
    photo: null,           // { blob, url } picked in the post form
    formCategory: "",
    formType: "LOST",
    confirmResolve: null,
    rewards: null,         // last my_reward_status() result
    lastRedeemed: null     // last ticket a staff member redeemed (confirmation card)
  };

  // ---------- Validation (same rules as the app and the database) ----------
  const V = {
    email(v) { v = v.trim(); if (!v) return "Email is required"; if (v.length > 254) return "Email is too long"; return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v) ? null : "Enter a valid email address"; },
    password(v) { if (!v) return "Password is required"; if (v.length < 8) return "Password must be at least 8 characters"; if (v.length > 72) return "Password is too long"; if (!/[A-Za-z]/.test(v)) return "Password must contain a letter"; if (!/\d/.test(v)) return "Password must contain a number"; return null; },
    otp(v) { return /^\d{6}$/.test(v) ? null : "Enter the 6-digit code from Google Authenticator"; },
    emailCode(v) { return /^\d{6,8}$/.test(v.trim()) ? null : "Enter the code from the email"; },
    name(v) { v = v.trim(); if (!v) return "Item name is required"; if (v.length < 2) return "Item name is too short"; return v.length > 60 ? "Item name must be at most 60 characters" : null; },
    location(v) { v = v.trim(); if (!v) return "Location is required"; if (v.length < 2) return "Location is too short"; return v.length > 80 ? "Location must be at most 80 characters" : null; },
    description(v) { return v.trim().length > 500 ? "Description must be at most 500 characters" : null; },
    /** Poster's contact email: required, and must be a CIIT school address. */
    ciitEmail(v) { v = v.trim(); return V.email(v) || (v.toLowerCase().endsWith(`@${CIIT_EMAIL_DOMAIN}`) ? null : `Use your CIIT email (@${CIIT_EMAIL_DOMAIN})`); },
    contactInfo(v) { return v.trim().length > 150 ? "Contact info must be at most 150 characters" : null; },
    comment(v) { v = v.trim(); if (!v) return "Comment cannot be empty"; return v.length > 300 ? "Comment must be at most 300 characters" : null; }
  };

  /** Short, safe message for the user. Never shows raw server text. */
  function friendly(e) {
    console.error("[FoundIt]", e);
    if (!navigator.onLine || (e instanceof TypeError && /fetch/i.test(e.message))) return "No connection. Check your internet and try again.";
    const code = String(e?.code || "").toLowerCase();
    const text = `${code} ${String(e?.message || "").toLowerCase()}`;
    if (e?.__isAuthError || /auth/i.test(e?.name || "")) {
      if (/invalid_credentials|invalid_grant|invalid login/.test(text)) return "Invalid email or password.";
      if (text.includes("email_not_confirmed")) return "Please confirm your email first, then log in.";
      if (/user_already_exists|email_exists|already registered/.test(text)) return "Could not create account. Try logging in instead.";
      if (text.includes("weak_password")) return "Password is too weak. Use at least 8 characters with letters and numbers.";
      if (/mfa|totp|code/.test(text)) return "Invalid or expired code. Check Google Authenticator and try again.";
      if (/over_|rate/.test(text) || e?.status === 429) return "Too many attempts. Please wait a minute and try again.";
      if (text.includes("same_password")) return "Your new password must be different from the old one.";
      if (/otp|expired/.test(text)) return "Invalid or expired code. Request a new one and try again.";
      return "Authentication failed. Please try again.";
    }
    // Messages written by FoundIt's own reward functions are safe to show as-is.
    if (String(e?.message || "").startsWith("REWARD:")) return e.message.slice(7).trim();
    if (e?.status === 401 || code === "pgrst301" || text.includes("jwt")) return "Your session expired. Please log in again.";
    if (code === "42501" || e?.status === 403 || text.includes("row-level security")) return "You are not allowed to do that.";
    if (code === "23505" || text.includes("duplicate")) return "You already have an open post for this item.";
    if (code === "23514" || text.includes("check constraint")) return "Some fields are invalid. Please review your input.";
    if (e?.status === 429) return "Too many requests. Please wait a moment.";
    return "Something went wrong. Please try again.";
  }

  // ---------- Small helpers ----------
  const isActive = () => state.section === "foundit";
  const main = () => document.getElementById("mainContent");
  const userId = () => fi.session?.user?.id || null;
  const myEmail = () => fi.session?.user?.email || "";
  function maskEmail(email) {
    const [name, domain] = String(email).split("@");
    return name && domain ? `${name[0]}***@${domain}` : email;
  }
  function typeBadge(item) {
    if (item.status === "CLAIMED") return `<span class="badge badge-ok">${icon("check-circle-2")} Claimed</span>`;
    return item.type === "LOST"
      ? `<span class="badge fi-badge-lost">${icon("circle-help")} Lost</span>`
      : `<span class="badge badge-info">${icon("hand-helping")} Found</span>`;
  }
  function photo(url, cls = "fi-photo") {
    const safe = safeUrl(url || "");
    return safe
      ? `<img class="${cls}" src="${escapeHTML(safe)}" alt="" loading="lazy">`
      : `<div class="${cls} fi-photo-empty" aria-hidden="true">${icon("image")}</div>`;
  }
  function setBusy(form, busy) {
    form?.querySelectorAll("button, input, textarea").forEach((el) => { el.disabled = busy; });
  }
  function setError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message || "";
  }
  function confirmDialog(title, message, okLabel, destructive = false) {
    return new Promise((resolve) => {
      fi.confirmResolve = resolve;
      showDialog(title, `
        <p>${escapeHTML(message)}</p>
        <div class="dialog-actions">
          <button class="btn" type="button" data-fi="confirm-no">Cancel</button>
          <button class="btn ${destructive ? "btn-danger" : "btn-primary"}" type="button" data-fi="confirm-yes">${escapeHTML(okLabel)}</button>
        </div>`);
    });
  }

  // ---------- Supabase client + auth stage ----------
  function client() {
    if (fi.client) return fi.client;
    fi.client = window.supabase.createClient(FI_URL, FI_KEY, {
      auth: { storageKey: "foundit-auth", persistSession: true, autoRefreshToken: true }
    });
    fi.client.auth.onAuthStateChange((event, session) => {
      fi.session = session;
      if (event === "SIGNED_OUT" && !fi.resetting) {
        stopListening();
        fi.stage = "logged_out"; fi.enrollment = null; fi.unread = 0;
        fi.rewards = null; fi.lastRedeemed = null;
        if (isActive()) draw();
      }
    });
    return fi.client;
  }

  async function computeStage() {
    const sb = client();
    const { data: { session } } = await sb.auth.getSession();
    fi.session = session;
    if (!session) return "logged_out";
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) throw error;
    const verified = (data.all || []).some((f) => f.factor_type === "totp" && f.status === "verified");
    if (!verified) return "needs_enroll";
    const { data: aal, error: aalError } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    return aal.currentLevel === "aal2" ? "ready" : "needs_verify";
  }

  async function refreshStage() {
    fi.stage = await computeStage();
    if (fi.stage === "ready") startListening();
  }

  // ---------- Realtime: hear about new posts ----------
  function startListening() {
    if (fi.channel) return;
    fi.channel = client().channel("public-items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "items" }, (payload) => {
        const item = payload.new || {};
        if (item.user_id === userId()) return;
        fi.unread++;
        updateBell();
        showToast(`FoundIt: new ${item.type === "LOST" ? "Lost" : "Found"} item — ${item.name || "item"}`);
        if (isActive() && fi.view === "browse") loadList();
      })
      .subscribe();
  }
  function stopListening() {
    if (fi.channel) { client().removeChannel(fi.channel); fi.channel = null; }
  }
  function updateBell() {
    const dot = document.getElementById("fiBellCount");
    if (!dot) return;
    dot.hidden = fi.unread === 0;
    dot.textContent = fi.unread > 99 ? "99+" : String(fi.unread);
  }

  // =========================================================
  // RENDER
  // =========================================================
  async function render() {
    const el = main();
    el.innerHTML = renderLoading(3);
    if (!window.supabase) { el.innerHTML = renderEmptyState("FoundIt couldn't load", "The Supabase library didn't load. Check your connection and refresh.", "alert-triangle"); return; }
    try {
      if (!fi.stage || fi.stage !== "ready") await refreshStage();
    } catch (e) {
      el.innerHTML = renderEmptyState("FoundIt couldn't load", escapeHTML(friendly(e)), "alert-triangle",
        `<button class="btn btn-primary" type="button" data-fi="retry">${icon("rotate-cw")} Try again</button>`);
      refreshIcons();
      return;
    }
    if (isActive()) draw();
  }

  function draw() {
    if (!isActive()) return;
    const el = main();
    const bell = fi.stage === "ready" ? `
      <button class="icon-button" type="button" data-fi="bell" aria-label="New items: show newest posts">
        ${icon("bell")}<span class="fi-count" id="fiBellCount" ${fi.unread ? "" : "hidden"}>${fi.unread}</span>
      </button>` : "";
    const header = renderPageHeader("FoundIt", "Campus lost &amp; found. Report items you lost or found, and help return them to their owners.",
      `${icon("package-search")} Lost &amp; found`, bell);

    let body = "";
    if (fi.stage === "logged_out") body = fi.forgot ? forgotView() : authView();
    else if (fi.stage === "needs_enroll") body = enrollView();
    else if (fi.stage === "needs_verify") body = verifyView();
    else {
      const tabs = [["browse", "Browse", "search"], ["post", "Report an item", "plus-circle"], ["mine", "My reports", "clipboard-list"], ["account", "Account", "user-round"]];
      const current = fi.view === "edit" ? "mine" : fi.view === "rewards" ? "account" : fi.view === "detail" ? fi.backTo : fi.view;
      body = `
        <div class="tabs" role="tablist" aria-label="FoundIt sections">
          ${tabs.map(([key, label, ic]) => `<button class="tab" type="button" role="tab" aria-selected="${current === key}" data-fi="view" data-view="${key}">${icon(ic)} ${label}</button>`).join("")}
        </div>
        <div id="fiView"></div>`;
    }
    el.innerHTML = header + body;
    refreshIcons();
    if (fi.stage === "needs_enroll" && !fi.enrollment) startEnrollment();
    if (fi.stage === "ready") drawView();
  }

  async function drawView() {
    const box = document.getElementById("fiView");
    if (!box) return;
    if (fi.view === "browse") {
      box.innerHTML = browseView();
      refreshIcons();
      return loadList();
    }
    if (fi.view === "post") { box.innerHTML = postForm(null); refreshIcons(); return; }
    box.innerHTML = renderLoading(3);
    try {
      if (fi.view === "mine") box.innerHTML = await mineView();
      else if (fi.view === "account") box.innerHTML = await accountView();
      else if (fi.view === "rewards") box.innerHTML = await rewardsView();
      else if (fi.view === "detail") box.innerHTML = await detailView(fi.detailId);
      else if (fi.view === "edit") {
        const item = await getItem(fi.detailId);
        box.innerHTML = item && item.user_id === userId() ? postForm(item) : renderEmptyState("Item not available", "It may have been deleted.", "search-x");
      }
    } catch (e) {
      box.innerHTML = renderEmptyState("Couldn't load this", escapeHTML(friendly(e)), "alert-triangle",
        `<button class="btn btn-primary" type="button" data-fi="view" data-view="${fi.view}">${icon("rotate-cw")} Try again</button>`);
    }
    refreshIcons();
  }

  function go(view, extra = {}) {
    if (view !== "detail" && view !== "edit") fi.backTo = view;
    Object.assign(fi, { view }, extra);
    if (view === "post") { fi.photo = null; fi.formCategory = ""; fi.formType = "LOST"; }
    draw();
    main().focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  // ---------- Login (step 1) ----------
  function authView() {
    const r = fi.registering;
    return `
      <div class="card fi-auth">
        <div class="fi-auth-head">${icon("package-search")}<div><h2>${r ? "Create a FoundIt account" : "Log in to FoundIt"}</h2>
          <p class="muted">FoundIt has its own account, separate from your GlitchWayve login. Use the same account as the FoundIt mobile app.</p></div></div>
        <div class="chips" role="group" aria-label="Log in or create account">
          <button class="chip" type="button" aria-pressed="${!r}" data-fi="auth-mode" data-mode="login">Log in</button>
          <button class="chip" type="button" aria-pressed="${r}" data-fi="auth-mode" data-mode="register">Create account</button>
        </div>
        <form data-fi-form="auth" novalidate style="margin-top:16px">
          <div class="field"><label for="fiEmail">School email</label><input id="fiEmail" name="email" type="email" autocomplete="email" maxlength="254" required><small class="form-error" id="fiEmailErr"></small></div>
          <div class="field"><label for="fiPassword">Password</label><input id="fiPassword" name="password" type="password" autocomplete="${r ? "new-password" : "current-password"}" maxlength="72" required>
            ${r ? '<small>At least 8 characters, with a letter and a number</small>' : ""}<small class="form-error" id="fiPasswordErr"></small></div>
          ${r ? `<div class="field"><label for="fiConfirm">Confirm password</label><input id="fiConfirm" name="confirm" type="password" autocomplete="new-password" maxlength="72" required><small class="form-error" id="fiConfirmErr"></small></div>` : ""}
          <p class="form-error" id="fiAuthErr" role="alert"></p>
          <button class="btn btn-primary" type="submit" style="width:100%">${r ? "Create account" : "Log in"}</button>
          ${r ? "" : '<button class="btn btn-ghost" type="button" data-fi="forgot" style="width:100%;margin-top:8px">Forgot password?</button>'}
        </form>
        <p class="form-help" style="text-align:center">You'll need the Google Authenticator app for two-step verification.</p>
      </div>`;
  }

  async function submitAuth(form) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const emailErr = V.email(email);
    const passErr = fi.registering ? V.password(password) : (password ? null : "Password is required");
    const confirmErr = fi.registering ? (!form.elements.confirm.value ? "Please confirm your password" : form.elements.confirm.value !== password ? "Passwords do not match" : null) : null;
    setError("fiEmailErr", emailErr); setError("fiPasswordErr", passErr); setError("fiConfirmErr", confirmErr); setError("fiAuthErr", "");
    if (emailErr || passErr || confirmErr) return;
    setBusy(form, true);
    try {
      const sb = client();
      if (fi.registering) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          fi.registering = false;
          draw();
          showToast("Account created. Check your email to confirm it, then log in.");
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      fi.codeAttempts = 0;
      await refreshStage();
      draw();
    } catch (e) {
      setBusy(form, false);
      setError("fiAuthErr", friendly(e));
    }
  }

  // ---------- Forgot password ----------
  // Step 1: email a recovery code. Step 2: that code + new password + authenticator code.
  // The temporary recovery session is always signed out afterwards, so the user logs in
  // again with the new password and a fresh authenticator code (same as the mobile app).
  function forgotView() {
    const sent = fi.resetSent;
    const email = escapeHTML(fi.resetEmail);
    const step1 = `
      <form data-fi-form="reset-send" novalidate style="margin-top:16px">
        <div class="field"><label for="fiResetEmail">School email</label><input id="fiResetEmail" name="email" type="email" autocomplete="email" maxlength="254" value="${email}" required><small class="form-error" id="fiResetEmailErr"></small></div>
        <p class="form-error" id="fiResetErr" role="alert"></p>
        <button class="btn btn-primary" type="submit" style="width:100%">Send code</button>
      </form>`;
    const step2 = `
      <form data-fi-form="reset" novalidate style="margin-top:16px">
        <div class="field"><label for="fiResetCode">Code from email</label><input id="fiResetCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required><small class="form-error" id="fiResetCodeErr"></small></div>
        <div class="field"><label for="fiNewPassword">New password</label><input id="fiNewPassword" name="password" type="password" autocomplete="new-password" maxlength="72" required>
          <small>At least 8 characters, with a letter and a number</small><small class="form-error" id="fiNewPasswordErr"></small></div>
        <div class="field"><label for="fiNewConfirm">Confirm new password</label><input id="fiNewConfirm" name="confirm" type="password" autocomplete="new-password" maxlength="72" required><small class="form-error" id="fiNewConfirmErr"></small></div>
        <div class="field"><label for="fiResetOtp">Google Authenticator code</label><input id="fiResetOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required><small class="form-error" id="fiResetOtpErr"></small></div>
        <p class="form-error" id="fiResetErr" role="alert"></p>
        <button class="btn btn-primary" type="submit" style="width:100%">Reset password</button>
        <button class="btn btn-ghost" type="button" data-fi="reset-resend" style="width:100%;margin-top:8px">Send a new code</button>
        <button class="btn btn-ghost" type="button" data-fi="reset-change-email" style="width:100%">Use a different email</button>
      </form>`;
    return `
      <div class="card fi-auth">
        <div class="fi-auth-head">${icon("lock-keyhole")}<div><h2>Reset password</h2>
          <p class="muted">${sent ? `Enter the code we emailed to ${email}, choose a new password, and enter your authenticator code.` : "Enter your school email and we'll send you a code."}</p></div></div>
        ${sent ? step2 : step1}
        <button class="btn btn-ghost" type="button" data-fi="forgot-back" style="width:100%;margin-top:8px">Back to log in</button>
      </div>`;
  }

  async function sendResetCode(email, form) {
    setBusy(form, true);
    try {
      const { error } = await client().auth.resetPasswordForEmail(email);
      if (error) throw error;
      fi.resetEmail = email; fi.resetSent = true;
      draw();
      showToast("If an account exists for that email, a code was sent.");
    } catch (e) {
      setBusy(form, false);
      setError("fiResetErr", friendly(e));
    }
  }

  function submitResetSend(form) {
    const email = form.elements.email.value.trim();
    const err = V.email(email);
    setError("fiResetEmailErr", err); setError("fiResetErr", "");
    if (err) return;
    return sendResetCode(email, form);
  }

  async function submitReset(form) {
    const code = form.elements.code.value.trim();
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    const otp = form.elements.otp.value.trim();
    const errs = {
      fiResetCodeErr: V.emailCode(code),
      fiNewPasswordErr: V.password(password),
      fiNewConfirmErr: !confirm ? "Please confirm your password" : confirm !== password ? "Passwords do not match" : null,
      fiResetOtpErr: V.otp(otp)
    };
    Object.entries(errs).forEach(([id, m]) => setError(id, m));
    setError("fiResetErr", "");
    if (Object.values(errs).some(Boolean)) return;
    setBusy(form, true);
    const sb = client();
    const endRecovery = () => sb.auth.signOut().catch(() => sb.auth.signOut({ scope: "local" }).catch(() => {}));
    fi.resetting = true; // keep the SIGNED_IN/SIGNED_OUT of the recovery session from redrawing
    try {
      const { error } = await sb.auth.verifyOtp({ email: fi.resetEmail, token: code, type: "recovery" });
      if (error) throw error;
      const { data, error: listError } = await sb.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = (data.all || []).find((f) => f.factor_type === "totp" && f.status === "verified");
      if (factor) {
        const { error: mfaError } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: otp });
        if (mfaError) throw mfaError;
      }
      const { error: updError } = await sb.auth.updateUser({ password });
      if (updError) throw updError;
      await endRecovery();
      fi.resetting = false;
      Object.assign(fi, { forgot: false, resetSent: false, registering: false, stage: "logged_out", session: null });
      draw();
      showToast("Password changed. Log in with your new password.");
    } catch (e) {
      await endRecovery();
      fi.resetting = false;
      fi.session = null;
      setBusy(form, false);
      setError("fiResetErr", friendly(e));
    }
  }

  // ---------- 2FA setup (sign-up step 2) ----------
  function enrollView() {
    const en = fi.enrollment;
    const content = !en
      ? `<div id="fiEnrollStatus">${renderLoading(1)}</div>`
      : `
        <ol class="fi-steps">
          <li>Install <strong>Google Authenticator</strong> on your phone.</li>
          <li>Tap <strong>+</strong>, then <strong>Scan a QR code</strong>, and scan this code:</li>
        </ol>
        <div class="fi-qr"><img src="${escapeHTML(en.qr)}" alt="QR code for Google Authenticator" width="200" height="200"></div>
        <p class="form-help" style="text-align:center">Can't scan? Choose "Enter a setup key" and type:</p>
        <p class="fi-secret">${escapeHTML(en.secret.match(/.{1,4}/g).join(" "))}</p>
        <ol class="fi-steps" start="3"><li>Enter the 6-digit code shown in the app.</li></ol>
        ${otpForm("enroll", "Verify and turn on")}`;
    return twoFactorCard("shield-check", "Set up two-step verification", "Protect your FoundIt account with Google Authenticator.", content);
  }

  async function startEnrollment() {
    try {
      const mfa = client().auth.mfa;
      const { data: list, error: listError } = await mfa.listFactors();
      if (listError) throw listError;
      // Remove abandoned, never-verified setups so a fresh QR can be issued.
      for (const f of (list.all || []).filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await mfa.enroll({ factorType: "totp", friendlyName: `FoundIt web ${crypto.randomUUID().slice(0, 6)}`, issuer: "FoundIt" });
      if (error) throw error;
      fi.enrollment = { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
      draw();
    } catch (e) {
      const box = document.getElementById("fiEnrollStatus");
      if (box) {
        box.innerHTML = `<p class="form-error">${escapeHTML(friendly(e))}</p><button class="btn" type="button" data-fi="retry-enroll">${icon("rotate-cw")} Try again</button>`;
        refreshIcons();
      }
    }
  }

  // ---------- 2FA verify (login step 2) ----------
  function verifyView() {
    return twoFactorCard("lock", "Two-step verification",
      `Open Google Authenticator and enter the 6-digit code for FoundIt (${escapeHTML(maskEmail(myEmail()))}).`,
      `${otpForm("verify", "Verify")}<p class="form-help" style="text-align:center">Codes change every 30 seconds. Make sure your phone's time is set automatically.</p>`);
  }

  function twoFactorCard(ic, title, subtitle, content) {
    return `
      <div class="card fi-auth fi-center">
        <span class="fi-big-icon">${icon(ic)}</span>
        <h2>${escapeHTML(title)}</h2>
        <p class="muted">${subtitle}</p>
        ${content}
        <button class="btn btn-ghost" type="button" data-fi="logout-now">Cancel and log out</button>
      </div>`;
  }
  function otpForm(kind, label) {
    return `
      <form data-fi-form="otp" data-kind="${kind}" novalidate class="fi-otp">
        <label for="fiOtp" class="sr-only">6-digit code</label>
        <input id="fiOtp" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" pattern="\\d{6}">
        <p class="form-error" id="fiOtpErr" role="alert"></p>
        <button class="btn btn-primary" type="submit" style="width:100%">${label}</button>
      </form>`;
  }

  async function submitOtp(form) {
    const code = form.elements.code.value.trim();
    const err = V.otp(code);
    setError("fiOtpErr", err);
    if (err) return;
    setBusy(form, true);
    try {
      const mfa = client().auth.mfa;
      let factorId = fi.enrollment?.factorId;
      if (form.dataset.kind === "verify") {
        const { data, error } = await mfa.listFactors();
        if (error) throw error;
        factorId = (data.all || []).find((f) => f.factor_type === "totp" && f.status === "verified")?.id;
        if (!factorId) throw new Error("No authenticator is set up for this account");
      }
      const { error } = await mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      fi.enrollment = null; fi.codeAttempts = 0;
      await refreshStage();
      fi.view = "browse";
      draw();
      showToast(form.dataset.kind === "enroll" ? "Two-step verification is on." : "Signed in to FoundIt.");
    } catch (e) {
      fi.codeAttempts++;
      if (fi.codeAttempts >= MAX_CODE_ATTEMPTS) {
        showToast("Too many wrong codes. You've been logged out of FoundIt.", true);
        return logout();
      }
      setBusy(form, false);
      form.elements.code.value = "";
      form.elements.code.focus();
      setError("fiOtpErr", "Invalid or expired code. Check Google Authenticator and try again.");
    }
  }

  async function logout() {
    stopListening();
    try { await client().auth.signOut(); } catch { await client().auth.signOut({ scope: "local" }).catch(() => {}); }
    fi.stage = "logged_out"; fi.view = "browse"; fi.enrollment = null; fi.unread = 0; fi.codeAttempts = 0;
    if (isActive()) draw();
  }

  // ---------- Browse ----------
  function browseView() {
    return `
      <div class="finder-input">
        ${icon("search")}
        <label class="sr-only" for="fiSearch">Search lost and found items</label>
        <input id="fiSearch" type="search" placeholder="Search name, description, place" maxlength="60" value="${escapeHTML(fi.query)}" autocomplete="off">
      </div>
      <div class="chips" role="group" aria-label="Lost or found">
        ${[[null, "All"], ["LOST", "Lost"], ["FOUND", "Found"]].map(([v, label]) => `<button class="chip" type="button" aria-pressed="${fi.type === v}" data-fi="filter-type" data-value="${v || ""}">${label}</button>`).join("")}
      </div>
      <div class="chips" role="group" aria-label="Category">
        ${CATEGORIES.map((c) => `<button class="chip" type="button" aria-pressed="${fi.category === c}" data-fi="filter-cat" data-value="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("")}
      </div>
      <div id="fiList" class="section" aria-live="polite">${renderLoading(3)}</div>`;
  }

  let listToken = 0;
  async function loadList() {
    const token = ++listToken;
    const box = document.getElementById("fiList");
    if (!box) return;
    try {
      let q = client().from("items").select("*").order("created_at", { ascending: false });
      // Wildcards and quotes are dropped so user text is matched literally and can't change the filter.
      const text = fi.query.trim().slice(0, 60).replace(/[%_\\"]/g, "");
      if (text) {
        const p = `"%${text}%"`;
        q = q.or(`name.ilike.${p},description.ilike.${p},location.ilike.${p}`);
      }
      if (fi.type) q = q.eq("type", fi.type);
      if (fi.category) q = q.eq("category", fi.category);
      const { data, error } = await q;
      if (error) throw error;
      if (token !== listToken || !document.getElementById("fiList")) return;
      const filtered = fi.query.trim() || fi.type || fi.category;
      box.innerHTML = data.length
        ? `<div class="grid grid-auto">${data.map((item) => itemCard(item)).join("")}</div>`
        : renderEmptyState("No items found", filtered ? "Try a different search or clear the filters." : "Nothing has been reported yet. Use Report an item to post one.", "package-open");
    } catch (e) {
      if (token !== listToken) return;
      box.innerHTML = renderEmptyState("Couldn't load items", escapeHTML(friendly(e)), "alert-triangle",
        `<button class="btn btn-primary" type="button" data-fi="reload-list">${icon("rotate-cw")} Try again</button>`);
    }
    refreshIcons();
  }

  function itemCard(item, actions = "") {
    return `
      <article class="card fi-card">
        <button class="fi-card-main" type="button" data-fi="open" data-id="${escapeHTML(item.id)}" aria-label="Open ${escapeHTML(item.name)}">
          ${photo(item.image_url, "fi-thumb")}
          <span class="fi-card-text">
            <span class="badges">${typeBadge(item)}${item.category ? `<span class="badge">${escapeHTML(item.category)}</span>` : ""}</span>
            <strong class="fi-card-title">${escapeHTML(item.name)}</strong>
            <span class="muted fi-meta">${icon("map-pin")} ${escapeHTML(item.location || "—")}</span>
            <span class="muted fi-meta">${icon("calendar")} ${escapeHTML(formatDate(item.created_at, true))}</span>
          </span>
        </button>
        ${actions ? `<div class="row fi-card-actions">${actions}</div>` : ""}
      </article>`;
  }

  // ---------- Item detail + comments ----------
  async function getItem(id) {
    const { data, error } = await client().from("items").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function getComments(id) {
    const { data, error } = await client().from("comments").select("*").eq("item_id", id).order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function detailView(id) {
    const [item, comments] = await Promise.all([getItem(id), getComments(id)]);
    const back = `<button class="btn btn-sm btn-ghost" type="button" data-fi="view" data-view="${fi.backTo}">${icon("arrow-left")} Back</button>`;
    if (!item) return back + renderEmptyState("Item not available", "It may have been deleted.", "search-x");
    const mine = item.user_id === userId();
    const open = item.status !== "CLAIMED";
    const actions = mine
      ? `${open ? `<button class="btn btn-primary" type="button" data-fi="claimed" data-id="${escapeHTML(item.id)}">${icon("check-circle-2")} Mark as claimed</button>` : ""}
         <button class="btn" type="button" data-fi="edit" data-id="${escapeHTML(item.id)}">${icon("pencil")} Edit</button>
         <button class="btn btn-danger" type="button" data-fi="delete" data-id="${escapeHTML(item.id)}">${icon("trash-2")} Delete</button>`
      : open ? `<button class="btn btn-primary" type="button" data-fi="claim" data-id="${escapeHTML(item.id)}">${icon("hand")} This is mine — claim it</button>` : "";
    return `
      ${back}
      <div class="fi-detail">
        <div>${photo(item.image_url, "fi-photo")}</div>
        <div class="card">
          <div class="badges">${typeBadge(item)}</div>
          <h2 style="margin:10px 0 6px">${escapeHTML(item.name)}</h2>
          ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}
          <p class="fi-meta">${icon("map-pin")} ${escapeHTML(item.location || "—")}</p>
          <p class="fi-meta">${icon("tag")} ${escapeHTML(item.category || "—")}</p>
          <p class="fi-meta">${icon("calendar")} ${escapeHTML(formatDate(item.created_at, true))}</p>
          ${actions ? `<div class="row" style="margin-top:14px">${actions}</div>` : ""}
        </div>
      </div>
      ${item.contact_email ? contactCard(item) : ""}
      <section class="section">
        <h2>Comments (${comments.length})</h2>
        <div class="fi-comments">
          ${comments.length ? comments.map((c) => commentRow(c)).join("") : '<p class="muted">No comments yet.</p>'}
        </div>
        <form data-fi-form="comment" data-id="${escapeHTML(item.id)}" novalidate class="fi-comment-form">
          <label for="fiComment" class="sr-only">Write a comment</label>
          <textarea id="fiComment" name="text" maxlength="300" placeholder="Write a comment…" rows="2"></textarea>
          <button class="btn btn-primary" type="submit">${icon("send")} Send</button>
        </form>
        <p class="form-error" id="fiCommentErr" role="alert"></p>
      </section>`;
  }

  function contactCard(item) {
    const who = item.type === "LOST" ? "owner" : "finder";
    const email = String(item.contact_email);
    // Opens Gmail's compose window (the browser's default mail app may be Outlook).
    const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(`FoundIt: ${item.name}`)}`;
    return `
      <div class="card fi-contact">
        <h3>${icon("contact")} Contact the ${who}</h3>
        <p class="fi-meta">${icon("mail")} ${escapeHTML(email)}</p>
        ${item.contact_info ? `<p class="fi-meta">${icon("info")} ${escapeHTML(item.contact_info)}</p>` : ""}
        <a class="btn" href="${escapeHTML(mailto)}" target="_blank" rel="noopener noreferrer">${icon("send")} Email the ${who} in Gmail</a>
      </div>`;
  }

  function commentRow(c) {
    const own = c.user_id === userId();
    return `
      <div class="fi-comment ${c.is_claim ? "is-claim" : ""}">
        <div class="row">
          <strong>${own ? "You" : escapeHTML(c.user_name || "user")}</strong>
          ${c.is_claim ? '<span class="badge fi-badge-lost">CLAIM</span>' : ""}
          <span class="muted fi-small">${escapeHTML(formatDate(c.created_at, true))}</span>
          <span class="spacer"></span>
          ${own ? `<button class="btn btn-sm btn-ghost" type="button" data-fi="delete-comment" data-id="${escapeHTML(c.id)}" aria-label="Delete comment">${icon("trash-2")}</button>` : ""}
        </div>
        <p>${escapeHTML(c.text)}</p>
      </div>`;
  }

  async function addComment(itemId, text, isClaim) {
    const { error } = await client().from("comments").insert({ item_id: itemId, user_id: userId(), text: text.trim(), is_claim: isClaim });
    if (error) throw error;
    showToast(isClaim ? "Claim sent to the poster." : "Comment posted.");
    drawView();
  }

  function openClaimDialog(itemId) {
    showDialog("Claim this item", `
      <form data-fi-form="claim" data-id="${escapeHTML(itemId)}" novalidate>
        <div class="field"><label for="fiProof">Describe something only the owner would know</label>
          <textarea id="fiProof" name="proof" maxlength="250" rows="3"></textarea>
          <small class="form-error" id="fiProofErr" role="alert"></small></div>
        <div class="dialog-actions">
          <button class="btn" type="button" data-action="close-dialog">Cancel</button>
          <button class="btn btn-primary" type="submit">Send claim</button>
        </div>
      </form>`);
  }

  // ---------- Report / edit form ----------
  function postForm(item) {
    const editing = !!item;
    if (editing) { fi.formType = item.type; fi.formCategory = item.category || ""; fi.photo = null; }
    const t = fi.formType;
    const preview = fi.photo?.url || item?.image_url;
    // Pre-fill with the login email when it is already a CIIT address.
    const contactEmail = item?.contact_email ?? (myEmail().toLowerCase().endsWith(`@${CIIT_EMAIL_DOMAIN}`) ? myEmail() : "");
    return `
      ${editing ? `<button class="btn btn-sm btn-ghost" type="button" data-fi="cancel-edit">${icon("arrow-left")} Back</button>` : ""}
      <form class="card fi-form" data-fi-form="item" data-id="${editing ? escapeHTML(item.id) : ""}" data-old-image="${escapeHTML(item?.image_url || "")}" novalidate>
        <h2>${editing ? "Edit item" : "Report an item"}</h2>
        <div class="chips" role="group" aria-label="Lost or found">
          <button class="chip" type="button" aria-pressed="${t === "LOST"}" data-fi="form-type" data-value="LOST">I lost something</button>
          <button class="chip" type="button" aria-pressed="${t === "FOUND"}" data-fi="form-type" data-value="FOUND">I found something</button>
        </div>
        <div class="field" style="margin-top:16px">
          <label for="fiPhoto">Photo (optional)</label>
          <label class="fi-photo-pick" for="fiPhoto">
            ${preview ? `<img class="fi-photo" id="fiPreview" src="${escapeHTML(preview.startsWith("blob:") ? preview : safeUrl(preview))}" alt="Selected photo">` : `<span class="fi-photo fi-photo-empty" id="fiPreview">${icon("image-plus")}<span>Add a photo</span></span>`}
          </label>
          <input id="fiPhoto" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only">
          <small>${preview ? "Click the photo to change it." : "JPG, PNG or WebP. Large photos are shrunk before upload."}</small>
        </div>
        <div class="field"><label for="fiName">Item name *</label><input id="fiName" name="name" type="text" maxlength="60" value="${escapeHTML(item?.name || "")}"><small class="form-error" id="fiNameErr"></small></div>
        <div class="field"><label for="fiLocation" id="fiLocationLabel">${t === "LOST" ? "Where did you lose it? *" : "Where did you find it? *"}</label><input id="fiLocation" name="location" type="text" maxlength="80" value="${escapeHTML(item?.location || "")}"><small class="form-error" id="fiLocationErr"></small></div>
        <div class="field"><label for="fiDesc">Description (color, brand, marks)</label><textarea id="fiDesc" name="description" maxlength="500" rows="3">${escapeHTML(item?.description || "")}</textarea><small class="form-error" id="fiDescErr"></small></div>
        <div class="field">
          <span class="fi-label" id="fiCatLabel">Category *</span>
          <div class="chips" role="group" aria-labelledby="fiCatLabel">
            ${CATEGORIES.map((c) => `<button class="chip" type="button" aria-pressed="${fi.formCategory === c}" data-fi="form-cat" data-value="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("")}
          </div>
          <small class="form-error" id="fiCatErr"></small>
        </div>
        <h3 class="fi-form-sub">Your contact details</h3>
        <div class="fi-public-warning" role="note">${icon("triangle-alert")}<span>The contact information you enter here will be visible to everyone using FoundIt. Only share what you're comfortable making public.</span></div>
        <div class="field"><label for="fiContactEmail">CIIT email *</label><input id="fiContactEmail" name="contact_email" type="email" autocomplete="email" maxlength="254" value="${escapeHTML(contactEmail)}"><small>Must end in @${CIIT_EMAIL_DOMAIN}</small><small class="form-error" id="fiContactEmailErr"></small></div>
        <div class="field"><label for="fiContactInfo">Other contact info (optional)</label><textarea id="fiContactInfo" name="contact_info" maxlength="150" rows="2" placeholder="e.g. FB: Juan Dela Cruz">${escapeHTML(item?.contact_info || "")}</textarea><small class="form-error" id="fiContactInfoErr"></small></div>
        <p class="form-error" id="fiFormErr" role="alert"></p>
        <button class="btn btn-primary" type="submit" style="width:100%">${editing ? "Save changes" : "Post item"}</button>
      </form>`;
  }

  /** Shrinks the photo to max 1280 px, JPEG quality 80 (same as the app). */
  async function toJpeg(file, maxSize = 1280) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the selected image"))), "image/jpeg", 0.8));
  }

  async function onPhotoPicked(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("fiFormErr", "Choose a JPG, PNG or WebP image."); return; }
    try {
      const blob = await toJpeg(file);
      if (blob.size > 5 * 1024 * 1024) { setError("fiFormErr", "That photo is too large. Choose one under 5 MB."); return; }
      if (fi.photo?.url) URL.revokeObjectURL(fi.photo.url);
      fi.photo = { blob, url: URL.createObjectURL(blob) };
      const label = input.closest(".field").querySelector(".fi-photo-pick");
      label.innerHTML = `<img class="fi-photo" id="fiPreview" src="${escapeHTML(fi.photo.url)}" alt="Selected photo">`;
      setError("fiFormErr", "");
    } catch (e) {
      setError("fiFormErr", "Could not read the selected image.");
    }
  }

  function storagePath(url) {
    const marker = `/${BUCKET}/`;
    const at = String(url || "").indexOf(marker);
    return at === -1 ? "" : decodeURIComponent(url.slice(at + marker.length));
  }
  async function uploadPhoto(blob) {
    const path = `${userId()}/${crypto.randomUUID()}.jpg`;
    const storage = client().storage.from(BUCKET);
    const { error } = await storage.upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return storage.getPublicUrl(path).data.publicUrl;
  }
  async function deletePhoto(url) {
    const path = storagePath(url);
    if (path) await client().storage.from(BUCKET).remove([path]).catch(() => {});
  }

  async function hasOpenDuplicate(name, location, type, excludeId) {
    const like = (s) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    let q = client().from("items").select("id").eq("user_id", userId()).eq("status", "OPEN").eq("type", type)
      .ilike("name", like(name)).ilike("location", like(location)).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data, error } = await q;
    if (error) throw error;
    return data.length > 0;
  }

  async function submitItem(form) {
    const id = form.dataset.id || null;
    const name = form.elements.name.value.trim();
    const location = form.elements.location.value.trim();
    const description = form.elements.description.value.trim();
    const contactEmail = form.elements.contact_email.value.trim();
    const contactInfo = form.elements.contact_info.value.trim();
    const errs = {
      fiNameErr: V.name(name), fiLocationErr: V.location(location), fiDescErr: V.description(description),
      fiCatErr: CATEGORIES.includes(fi.formCategory) ? null : "Choose a category",
      fiContactEmailErr: V.ciitEmail(contactEmail), fiContactInfoErr: V.contactInfo(contactInfo)
    };
    Object.entries(errs).forEach(([k, v]) => setError(k, v));
    setError("fiFormErr", "");
    if (Object.values(errs).some(Boolean)) return;
    const reacher = fi.formType === "LOST" ? "whoever finds your item" : "the owner";
    if (!(await confirmDialog("Share your contact info?",
      `Your CIIT email${contactInfo ? " and other contact info" : ""} will be visible to everyone using FoundIt so ${reacher} can reach you.`,
      id ? "Save changes" : "Post item"))) return;

    setBusy(form, true);
    let uploaded = null;
    try {
      if (await hasOpenDuplicate(name, location, fi.formType, id)) {
        setBusy(form, false);
        setError("fiFormErr", `You already have an open post for "${name}" at ${location}.`);
        return;
      }
      if (fi.photo) uploaded = await uploadPhoto(fi.photo.blob);
      const row = { name, description, category: fi.formCategory, location, type: fi.formType, contact_email: contactEmail, contact_info: contactInfo || null };
      if (id) {
        if (uploaded) row.image_url = uploaded;
        const { error } = await client().from("items").update(row).eq("id", id);
        if (error) throw error;
        if (uploaded) await deletePhoto(form.dataset.oldImage);
        showToast("Changes saved.");
      } else {
        const { error } = await client().from("items").insert({ ...row, user_id: userId(), image_url: uploaded });
        if (error) throw error;
        showToast("Item posted.");
      }
      fi.photo = null;
      go("mine");
    } catch (e) {
      if (uploaded) await deletePhoto(uploaded); // don't leave an orphaned photo behind
      setBusy(form, false);
      setError("fiFormErr", friendly(e));
    }
  }

  // ---------- My reports ----------
  async function myItems() {
    const { data, error } = await client().from("items").select("*").eq("user_id", userId()).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function mineView() {
    const items = await myItems();
    if (!items.length) {
      return renderEmptyState("No reports yet", "Items you report as lost or found will appear here.", "file-plus",
        `<button class="btn btn-primary" type="button" data-fi="view" data-view="post" style="margin-top:12px">${icon("plus-circle")} Report an item</button>`);
    }
    return `<div class="grid grid-auto">${items.map((item) => itemCard(item, `
      <button class="btn btn-sm" type="button" data-fi="edit" data-id="${escapeHTML(item.id)}">${icon("pencil")} Edit</button>
      ${item.status !== "CLAIMED" ? `<button class="btn btn-sm" type="button" data-fi="claimed" data-id="${escapeHTML(item.id)}">${icon("check-circle-2")} Mark claimed</button>` : ""}
      <button class="btn btn-sm btn-danger" type="button" data-fi="delete" data-id="${escapeHTML(item.id)}">${icon("trash-2")} Delete</button>`)).join("")}</div>`;
  }

  async function markClaimed(id) {
    const item = await getItem(id);
    if (!item) return;
    if (!(await confirmDialog(`Mark "${item.name}" as claimed?`, "Others will see this item has been returned to its owner.", "Mark claimed"))) return;
    const { error } = await client().from("items").update({ status: "CLAIMED" }).eq("id", id);
    if (error) throw error;
    showToast(item.type === "FOUND" ? "Marked as returned. Check Rewards for your points." : "Marked as claimed.");
    drawView();
  }

  async function deleteItem(id) {
    const item = await getItem(id);
    if (!item) return;
    if (!(await confirmDialog(`Delete "${item.name}"?`, "This permanently removes the post, its photo and comments.", "Delete", true))) return;
    const { error } = await client().from("items").delete().eq("id", id);
    if (error) throw error;
    await deletePhoto(item.image_url);
    showToast("Post deleted.");
    if (fi.view === "detail") go(fi.backTo); else drawView();
  }

  // ---------- Account ----------
  async function accountView() {
    const [items] = await Promise.all([myItems(), loadRewards().catch(() => null)]);
    const open = items.filter((i) => i.status === "OPEN").length;
    const r = fi.rewards;
    const rewardLine = !r ? "Earn points by returning found items"
      : r.ticket && !r.ticket.redeemed_at && r.ticket.term_name === r.term?.name ? "You won this term's reward ticket!"
      : !r.term ? "No active term"
      : `${r.my_points} pts this term${r.my_rank ? ` · Rank #${r.my_rank}` : ""}`;
    return `
      <div class="grid grid-2">
        <div class="card fi-account-row">${icon("circle-user-round")}<div><strong>${escapeHTML(maskEmail(myEmail()))}</strong><p class="muted">Signed in to FoundIt</p></div></div>
        <div class="card fi-account-row">${icon("shield-check")}<div><strong>Two-step verification</strong><p class="muted">On — Google Authenticator</p></div></div>
        <div class="card fi-account-row">${icon("clipboard-list")}<div><strong>My reports</strong><p class="muted">${items.length} total, ${open} open</p></div></div>
        <button class="card fi-account-row fi-link-card" type="button" data-fi="view" data-view="rewards">${icon("trophy")}<div><strong>Points &amp; rewards</strong><p class="muted">${escapeHTML(rewardLine)}</p></div>${icon("chevron-right")}</button>
      </div>
      <div class="row" style="margin-top:20px">
        <button class="btn btn-danger" type="button" data-fi="logout">${icon("log-out")} Log out of FoundIt</button>
        <span class="muted fi-small">This only signs you out of FoundIt. Your GlitchWayve login stays as it is.</span>
      </div>`;
  }

  // ---------- Points & rewards ----------
  // All rules (what counts as a point, one winner per term, ticket expiry, single use)
  // are enforced by FoundIt's database functions, not here.
  async function loadRewards() {
    const { data, error } = await client().rpc("my_reward_status");
    if (error) throw error;
    fi.rewards = data;
    return data;
  }

  const dateLong = (v) => formatDate(v, false);
  const dateTime = (v) => formatDate(v, true);

  async function rewardsView() {
    const s = await loadRewards();
    const back = `<button class="btn btn-sm btn-ghost" type="button" data-fi="view" data-view="account">${icon("arrow-left")} Account</button>`;
    const term = s.term;
    let termCard;
    if (!term) {
      termCard = `<div class="card"><strong>No active term</strong><p class="muted">Points start counting when the school opens the next term.</p></div>`;
    } else {
      const note = !s.ranking_closed
        ? `Points count until ${dateTime(term.reward_at)}. The top student then gets a reward ticket, valid until ${dateLong(term.ends_at)}.`
        : s.winner_chosen && s.ticket?.term_name !== term.name ? "Ranking closed. This term's reward ticket has been given out."
        : s.winner_chosen ? "Ranking closed. You won this term's reward!"
        : "Ranking closed. Nobody earned a point this term.";
      termCard = `
        <div class="card fi-points">
          <p class="eyebrow">${icon("calendar")} ${escapeHTML(term.name)}</p>
          <p class="fi-points-num"><strong>${Number(s.my_points) || 0}</strong> <span>${s.my_points === 1 ? "point" : "points"} this term</span></p>
          <p class="muted">${s.my_rank ? `Rank #${Number(s.my_rank)}` : "Not ranked yet"}</p>
          <hr>
          <p>${escapeHTML(note)}</p>
        </div>`;
    }
    const board = s.leaderboard || [];
    const leaderboard = term ? `
      <div class="card">
        <h3 style="margin-top:0">Top finders this term</h3>
        ${board.length ? `<ol class="fi-board">${board.map((e) => `
          <li class="${e.is_me ? "fi-me" : ""}"><span class="fi-rank">#${Number(e.rank)}</span><span class="fi-board-name">${escapeHTML(e.name)}${e.is_me ? " (you)" : ""}</span><span>${Number(e.points)} pt${e.points === 1 ? "" : "s"}</span></li>`).join("")}</ol>`
          : '<p class="muted">No successful returns yet. Be the first!</p>'}
      </div>` : "";
    return `
      ${back}
      <div class="fi-rewards">
        ${s.ticket ? ticketCard(s.ticket) : ""}
        ${termCard}
        <div class="card">
          <h3 style="margin-top:0">How to earn points</h3>
          <ul class="fi-steps">
            <li>Post an item you <strong>found</strong>.</li>
            <li>The owner taps “This is mine — claim it” on your post.</li>
            <li>After you hand it back, mark the post as claimed: <strong>+1 point</strong>.</li>
          </ul>
          <p class="muted fi-small">Points reset to 0 every term. Only one student wins each term, and the ticket can be used once.</p>
        </div>
        ${leaderboard}
        ${s.is_staff ? staffRedeemCard() : ""}
      </div>`;
  }

  function ticketCard(t) {
    // Display only: the server is what actually refuses expired or used tickets.
    const expired = new Date(t.expires_at) <= new Date();
    const active = !t.redeemed_at && !expired;
    const label = t.redeemed_at ? `Used on ${dateTime(t.redeemed_at)}`
      : expired ? `Expired on ${dateLong(t.expires_at)}`
      : `Valid until ${dateTime(t.expires_at)}`;
    return `
      <div class="card fi-ticket ${active ? "fi-ticket-active" : ""}">
        ${icon("trophy")}
        <strong>Top Finder reward ticket</strong>
        <span>${escapeHTML(t.term_name)} · ${Number(t.points)} successful returns</span>
        <span class="fi-ticket-code">${escapeHTML(t.code)}</span>
        <span class="fi-ticket-status ${expired && !t.redeemed_at ? "fi-expired" : ""}">${escapeHTML(label)}</span>
        ${active ? '<p class="fi-small">Show this code at the Student Admin office to claim your school reward. It can only be used once.</p>' : ""}
      </div>`;
  }

  /** Shown only to accounts listed in reward_staff (checked again by the server). */
  function staffRedeemCard() {
    const r = fi.lastRedeemed;
    return `
      <div class="card">
        <h3 style="margin-top:0" class="row">${icon("shield-check")} Student Admin: redeem a ticket</h3>
        <form data-fi-form="redeem" novalidate>
          <div class="field"><label for="fiTicketCode">Ticket code (e.g. FI-1A2B-3C4D)</label>
            <input id="fiTicketCode" name="code" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false" class="fi-ticket-input">
            <small class="form-error" id="fiRedeemErr" role="alert"></small></div>
          <button class="btn btn-primary" type="submit">${icon("ticket-check")} Validate &amp; mark as used</button>
        </form>
        ${r ? `<div class="fi-redeemed"><strong>Valid — reward released</strong><span>${escapeHTML(r.code)} · ${escapeHTML(r.student)} · ${escapeHTML(r.term_name)} · ${Number(r.points)} returns</span></div>` : ""}
      </div>`;
  }

  async function submitRedeem(form) {
    const code = form.elements.code.value.trim().toUpperCase();
    if (code.length < 6) return setError("fiRedeemErr", "Enter the full ticket code.");
    setError("fiRedeemErr", "");
    setBusy(form, true);
    fi.lastRedeemed = null;
    try {
      const { data, error } = await client().rpc("redeem_reward_ticket", { p_code: code });
      if (error) throw error;
      fi.lastRedeemed = data;
      showToast("Ticket redeemed.");
      drawView();
    } catch (e) {
      setBusy(form, false);
      setError("fiRedeemErr", friendly(e));
    }
  }

  // =========================================================
  // EVENTS (own listeners; FoundIt elements use data-fi, not data-action)
  // =========================================================
  async function onClick(event) {
    const t = event.target.closest("[data-fi]");
    if (!t) return;
    const { fi: action, id, value } = t.dataset;
    try {
      switch (action) {
        case "confirm-yes": case "confirm-no": {
          const resolve = fi.confirmResolve; fi.confirmResolve = null;
          closeDialog(); resolve?.(action === "confirm-yes"); return;
        }
        case "retry": return render();
        case "retry-enroll": fi.enrollment = null; return draw();
        case "auth-mode": fi.registering = t.dataset.mode === "register"; return draw();
        case "forgot": fi.forgot = true; fi.resetSent = false; fi.resetEmail = document.getElementById("fiEmail")?.value.trim() || ""; return draw();
        case "forgot-back": fi.forgot = false; fi.resetSent = false; return draw();
        case "reset-change-email": fi.resetSent = false; return draw();
        case "reset-resend": setError("fiResetErr", ""); return sendResetCode(fi.resetEmail, t.closest("form"));
        case "logout-now": return logout();
        case "logout": if (await confirmDialog("Log out of FoundIt?", "You'll need your password and an authenticator code to sign in again.", "Log out", true)) return logout(); return;
        case "view": return go(t.dataset.view);
        case "bell": fi.unread = 0; fi.query = ""; fi.type = null; fi.category = null; return go("browse");
        case "filter-type": fi.type = value || null; return drawView();
        case "filter-cat": fi.category = fi.category === value ? null : value; return drawView();
        case "reload-list": return loadList();
        case "open": return go("detail", { detailId: id });
        case "edit": return go("edit", { detailId: id });
        case "cancel-edit": return go(fi.backTo);
        case "claimed": return await markClaimed(id);
        case "delete": return await deleteItem(id);
        case "claim": return openClaimDialog(id);
        case "delete-comment": {
          if (!(await confirmDialog("Delete comment?", "This cannot be undone.", "Delete", true))) return;
          const { error } = await client().from("comments").delete().eq("id", id);
          if (error) throw error;
          showToast("Comment deleted.");
          return drawView();
        }
        case "form-type": {
          fi.formType = value;
          t.parentElement.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === t)));
          const label = document.getElementById("fiLocationLabel");
          if (label) label.textContent = value === "LOST" ? "Where did you lose it? *" : "Where did you find it? *";
          return;
        }
        case "form-cat":
          fi.formCategory = value;
          t.parentElement.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === t)));
          return setError("fiCatErr", "");
      }
    } catch (e) {
      showToast(friendly(e), true);
    }
  }

  async function onSubmit(event) {
    const form = event.target.closest?.("form[data-fi-form]");
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.fiForm;
    if (kind === "auth") return submitAuth(form);
    if (kind === "otp") return submitOtp(form);
    if (kind === "reset-send") return submitResetSend(form);
    if (kind === "reset") return submitReset(form);
    if (kind === "item") return submitItem(form);
    if (kind === "redeem") return submitRedeem(form);
    if (kind === "comment" || kind === "claim") {
      const isClaim = kind === "claim";
      const raw = isClaim ? form.elements.proof.value : form.elements.text.value;
      const errId = isClaim ? "fiProofErr" : "fiCommentErr";
      const err = V.comment(raw);
      setError(errId, err);
      if (err) return;
      setBusy(form, true);
      try {
        if (isClaim) closeDialog();
        await addComment(form.dataset.id, isClaim ? `CLAIM: ${raw.trim()}` : raw, isClaim);
      } catch (e) {
        if (isClaim) showToast(friendly(e), true);
        else { setBusy(form, false); setError(errId, friendly(e)); }
      }
    }
  }

  let searchTimer;
  function onInput(event) {
    if (event.target.id === "fiTicketCode") {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
      return setError("fiRedeemErr", "");
    }
    if (event.target.id !== "fiSearch") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { fi.query = event.target.value.slice(0, 60); loadList(); }, 300);
  }
  function onChange(event) {
    if (event.target.id === "fiPhoto") onPhotoPicked(event.target);
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);

  window.FoundIt = {
    render,
    /** Called when the user signs out of GlitchWayve, so a shared computer isn't left signed in to FoundIt. */
    async signOut() { if (fi.client) await logout(); }
  };
})();
