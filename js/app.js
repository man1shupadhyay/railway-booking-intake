(function() {
  "use strict";
  const CONFIG = {
    maxPassengers: 6,
    contact: {
      name: "the booking desk",
      email: "",
      phone: ""
    },
    submitEndpoint: "",
    retentionText: "Your request is stored privately by the booking desk, visible only to its staff, and kept only as long " + "as needed to process the booking and meet legal obligations. This website itself keeps nothing.",
    autoDownload: "combined"
  };
  const {rules: rules, joinName: joinName, TICKET_NAME_MAX: TICKET_NAME_MAX, normalizeMobile: normalizeMobile, todayIST: todayIST} = window.Validation;
  const Csv = window.CsvGenerator;
  const SubmissionService = {
    get online() {
      return Boolean(CONFIG.submitEndpoint);
    },
    async submit(request) {
      if (!this.online) {
        await new Promise(r => setTimeout(r, 600));
        return {
          ok: true,
          requestId: request.requestId,
          submittedAt: request.submittedAt,
          local: true
        };
      }
      const controller = new AbortController;
      const timer = setTimeout(() => controller.abort(), 3e4);
      let res;
      try {
        res = await fetch(CONFIG.submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            ...request,
            website: $("#website").value
          }),
          signal: controller.signal,
          redirect: "follow"
        });
      } catch (_) {
        throw new Error("We couldn't reach the booking desk. Check your connection and try again.");
      } finally {
        clearTimeout(timer);
      }
      let data = null;
      try {
        data = await res.json();
      } catch (_) {}
      if (!res.ok || !data || !data.ok) {
        throw new Error(data && data.error || "The booking desk couldn't save your request. Please try again.");
      }
      return data;
    }
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const form = $("#booking-form");
  const submitBtn = $("#submitBtn");
  const passengerList = $("#passengerList");
  const addPassengerBtn = $("#addPassenger");
  const passengerTpl = $("#passengerTemplate");
  const successView = $("#successView");
  let isSubmitting = false;
  let lastRequest = null;
  let lastCsv = null;
  let passengerSeq = 0;
  function refreshIcons() {
    try {
      window.lucide && window.lucide.createIcons();
    } catch (_) {}
  }
  const TOAST_ICONS = {
    success: "circle-check",
    error: "circle-alert",
    warning: "triangle-alert",
    info: "info"
  };
  function toast(message, type = "info", ms = 4500) {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = `<i data-lucide="${TOAST_ICONS[type]}"></i><div></div>`;
    el.lastElementChild.textContent = message;
    $("#toasts").appendChild(el);
    refreshIcons();
    setTimeout(() => el.remove(), ms);
  }
  function setError(input, message) {
    const field = input.closest(".field") || input.closest(".check");
    if (input._combo) input = input._combo.input;
    const errorEl = field && field.querySelector(".field__error");
    if (field) field.classList.toggle("is-invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (errorEl) {
      errorEl.textContent = message || "";
      if (errorEl.id) input.setAttribute("aria-describedby", errorEl.id);
    }
    return !message;
  }
  const value = id => ($("#" + id).value || "").trim();
  const radio = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || "";
  const isRoundTrip = () => radio("journeyType") === "Round Trip";
  const fieldValidators = {
    firstName: () => rules.firstName(value("firstName")),
    middleName: () => rules.optionalName(value("middleName")),
    lastName: () => rules.optionalName(value("lastName")),
    mobile: () => rules.mobile(value("mobile")),
    whatsapp: () => rules.whatsapp(value("whatsapp")),
    email: () => rules.email(value("email")),
    city: () => rules.city(value("city")),
    origin: () => rules.station(value("origin"), "origin"),
    destination: () => {
      const err = rules.station(value("destination"), "destination");
      if (err) return err;
      if (value("destination").toUpperCase() === value("origin").toUpperCase()) return "Destination must be different from origin.";
      return "";
    },
    journeyDate: () => rules.journeyDate(value("journeyDate")),
    returnDate: () => isRoundTrip() ? rules.returnDate(value("returnDate"), value("journeyDate")) : "",
    preferredTrain: () => rules.preferredTrain(value("preferredTrain")),
    preferredDeparture: () => rules.preferredDeparture(value("preferredDeparture")),
    travelClass: () => rules.travelClass(value("travelClass")),
    quota: () => rules.quota(radio("quota")) || ([ "Tatkal", "Premium Tatkal" ].includes(radio("quota")) && $$("[data-passenger]").length > 4 ? "Tatkal allows up to 4 passengers per ticket. Remove extra passengers or choose General." : ""),
    alternativeTrain: () => rules.yesNo(radio("alternativeTrain")),
    alternativeDate: () => rules.yesNo(radio("alternativeDate")),
    specialInstructions: () => rules.specialInstructions(value("specialInstructions")),
    quotaOther: () => radio("quota") === "Other" ? rules.quotaOther(value("quotaOther")) : "",
    coachType: () => radio("coachType") ? "" : "Please choose AC or Non-AC."
  };
  function validateField(id) {
    const fn = fieldValidators[id];
    if (!fn) return true;
    return setError($("#" + id), fn());
  }
  const PASSENGER_RULES = {
    first: rules.firstName,
    middle: rules.optionalName,
    last: rules.optionalName,
    age: rules.passengerAge,
    gender: rules.passengerGender,
    berth: rules.passengerBerth
  };
  const NAME_PARTS = [ "first", "middle", "last" ];
  function ticketNameOf(card) {
    return joinName(...NAME_PARTS.map(f => card.querySelector(`[data-field="${f}"]`).value)).toUpperCase();
  }
  function updateTicketName(card) {
    const full = ticketNameOf(card);
    const el = card.querySelector("[data-ticket-name]");
    el.classList.toggle("is-over", full.length > TICKET_NAME_MAX);
    el.innerHTML = full ? `Name on ticket: <strong></strong> · ${full.length}/${TICKET_NAME_MAX}` : `Name on ticket appears here · 0/${TICKET_NAME_MAX}`;
    if (full) el.querySelector("strong").textContent = full;
  }
  function validatePassengerInput(input) {
    const rule = PASSENGER_RULES[input.dataset.field];
    if (!rule) return true;
    let message = rule(input.value);
    const card = input.closest("[data-passenger]");
    if (!message && NAME_PARTS.includes(input.dataset.field)) {
      const first = card.querySelector('[data-field="first"]');
      const partsOk = NAME_PARTS.every(f => !PASSENGER_RULES[f](card.querySelector(`[data-field="${f}"]`).value));
      if (partsOk && first.value.trim()) setError(first, rules.ticketName(ticketNameOf(card)));
      if (input === first) return !first.closest(".is-invalid");
    }
    return setError(input, message);
  }
  function validateDeclarations() {
    const boxes = $$("#section-declaration .check input");
    let ok = true;
    boxes.forEach(b => {
      b.closest(".check").classList.toggle("is-invalid", !b.checked);
      b.setAttribute("aria-invalid", b.checked ? "false" : "true");
      if (!b.checked) ok = false;
    });
    $("#declarations-error").textContent = ok ? "" : "Please tick all three boxes to continue.";
    return ok;
  }
  function validateAll() {
    let firstInvalid = null;
    const note = (ok, el) => {
      if (!ok && !firstInvalid) firstInvalid = el;
    };
    Object.keys(fieldValidators).forEach(id => note(validateField(id), $("#" + id)));
    $$("[data-passenger] [data-field]").forEach(input => note(validatePassengerInput(input), input));
    note(validateDeclarations(), $("#declAccurate"));
    return firstInvalid;
  }
  const SECTION_FIELDS = {
    customer: [ "firstName", "middleName", "lastName", "mobile", "whatsapp", "email", "city" ],
    journey: [ "origin", "destination", "journeyDate", "returnDate", "preferredTrain", "preferredDeparture", "quota", "quotaOther", "coachType", "travelClass" ],
    preferences: [ "alternativeTrain", "alternativeDate", "specialInstructions" ]
  };
  function sectionComplete(name) {
    if (SECTION_FIELDS[name]) return SECTION_FIELDS[name].every(id => !fieldValidators[id]());
    if (name === "passengers") {
      return $$("[data-passenger] [data-field]").every(i => !PASSENGER_RULES[i.dataset.field] || !PASSENGER_RULES[i.dataset.field](i.value)) && passengerCards().every(card => !rules.ticketName(ticketNameOf(card)));
    }
    if (name === "declaration") return $$("#section-declaration .check input").every(b => b.checked);
    return false;
  }
  function sectionCounts(name) {
    const ok = fn => !fn();
    if (name === "customer") {
      const ids = [ "firstName", "mobile", "whatsapp", "email", "city" ];
      return [ ids.filter(id => ok(fieldValidators[id])).length, ids.length ];
    }
    if (name === "journey" || name === "preferences") {
      const ids = SECTION_FIELDS[name].filter(id => ![ "middleName", "lastName" ].includes(id) && !(id === "returnDate" && !isRoundTrip()) && !(id === "quotaOther" && radio("quota") !== "Other"));
      return [ ids.filter(id => ok(fieldValidators[id])).length, ids.length ];
    }
    if (name === "passengers") {
      const inputs = $$('[data-passenger] [data-field="first"], [data-passenger] [data-field="age"], ' + '[data-passenger] [data-field="gender"], [data-passenger] [data-field="berth"]');
      return [ inputs.filter(i => !PASSENGER_RULES[i.dataset.field](i.value)).length, inputs.length ];
    }
    const boxes = $$("#section-declaration .check input");
    return [ boxes.filter(b => b.checked).length, boxes.length ];
  }
  function updateProgress() {
    const steps = $$(".stepper__step");
    let done = 0;
    steps.forEach(step => {
      const complete = sectionComplete(step.dataset.step);
      step.classList.toggle("is-done", complete);
      const pill = $(`[data-section="${step.dataset.step}"] .section-status`);
      if (pill) {
        const [filled, total] = sectionCounts(step.dataset.step);
        pill.textContent = complete ? "Complete" : filled === 0 ? "Not started" : `${filled} of ${total} done`;
        pill.classList.toggle("is-complete", complete);
        pill.classList.toggle("is-partial", !complete && filled > 0);
        pill.title = complete ? "All required details in this section are filled in" : `${total - filled} required detail${total - filled === 1 ? "" : "s"} still to fill in`;
      }
      if (complete) done += 1;
    });
    const pct = Math.round(done / steps.length * 100);
    $(".stepper__fill").style.width = pct + "%";
    $(".stepper__bar").setAttribute("aria-valuenow", String(pct));
  }
  function watchActiveSection() {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const name = entry.target.dataset.section;
        $$(".stepper__step").forEach(s => s.classList.toggle("is-active", s.dataset.step === name));
      });
    }, {
      rootMargin: "-40% 0px -55% 0px"
    });
    $$("[data-section]").forEach(s => observer.observe(s));
  }
  function setupSections() {
    $$("[data-section]").forEach((card, i) => {
      const head = card.querySelector(".card__head");
      const body = document.createElement("div");
      body.className = "card__body";
      body.id = `${card.id}-body`;
      const inner = document.createElement("div");
      inner.className = "card__inner";
      while (head.nextSibling) inner.appendChild(head.nextSibling);
      body.appendChild(inner);
      card.appendChild(body);
      const status = document.createElement("span");
      status.className = "section-status";
      status.dataset.status = "";
      const chevron = document.createElement("span");
      chevron.className = "card__chevron";
      chevron.innerHTML = '<i data-lucide="chevron-down"></i>';
      head.append(status, chevron);
      head.setAttribute("role", "button");
      head.tabIndex = 0;
      head.setAttribute("aria-controls", body.id);
      head.addEventListener("click", e => {
        if (e.target.closest("button, a, input, select, textarea")) return;
        setSectionOpen(card, card.classList.contains("is-collapsed"));
      });
      head.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSectionOpen(card, card.classList.contains("is-collapsed"));
        }
      });
      setSectionOpen(card, i === 0, false);
    });
    $("#expandAll").addEventListener("click", () => $$("[data-section]").forEach(c => setSectionOpen(c, true)));
    $("#collapseAll").addEventListener("click", () => $$("[data-section]").forEach(c => setSectionOpen(c, false)));
    $$(".stepper__step").forEach(a => a.addEventListener("click", () => setSectionOpen($(`[data-section="${a.dataset.step}"]`), true)));
  }
  function setSectionOpen(card, open, animate = true) {
    if (!card) return;
    if (!animate) card.classList.add("no-anim");
    card.classList.toggle("is-collapsed", !open);
    card.querySelector(".card__head").setAttribute("aria-expanded", String(open));
    card.querySelector(".card__body").inert = !open;
    if (!animate) requestAnimationFrame(() => card.classList.remove("no-anim"));
  }
  function passengerCards() {
    return $$("[data-passenger]", passengerList);
  }
  function renumberPassengers() {
    const cards = passengerCards();
    cards.forEach((card, i) => {
      card.querySelector("[data-index]").textContent = String(i + 1);
      card.querySelector("[data-remove]").setAttribute("aria-label", `Remove passenger ${i + 1}`);
      card.querySelector("[data-remove]").hidden = cards.length === 1;
    });
    $("#passengerCount").textContent = `${cards.length} of ${CONFIG.maxPassengers}`;
    addPassengerBtn.disabled = cards.length >= CONFIG.maxPassengers;
    addPassengerBtn.title = addPassengerBtn.disabled ? `Maximum ${CONFIG.maxPassengers} passengers per request` : "";
  }
  function addPassenger(focus = true) {
    if (passengerCards().length >= CONFIG.maxPassengers) {
      toast(`You can add up to ${CONFIG.maxPassengers} passengers in one request.`, "warning");
      return;
    }
    const node = passengerTpl.content.firstElementChild.cloneNode(true);
    passengerSeq += 1;
    $$(".field", node).forEach(field => {
      const input = field.querySelector("[data-field]");
      const label = field.querySelector("label");
      const error = field.querySelector(".field__error");
      const id = `p${passengerSeq}-${input.dataset.field}`;
      input.id = id;
      input.name = id;
      label.htmlFor = id;
      if (error) error.id = id + "-error";
    });
    passengerList.appendChild(node);
    window.Combobox.enhanceAll(node);
    renumberPassengers();
    refreshIcons();
    updateProgress();
    updateTicketName(node);
    if (focus) node.querySelector('[data-field="first"]').focus();
  }
  function removePassenger(card) {
    if (passengerCards().length <= 1) return;
    card.remove();
    renumberPassengers();
    updateProgress();
    toast("Passenger removed.", "info", 2500);
  }
  function setupStations() {
    const make = (id, extra) => new window.Combobox({
      input: $(`#${id}-input`),
      native: $(`#${id}`),
      limit: 50,
      ...extra
    });
    const origin = make("origin", {
      emptyText: "No station matches — try the station code"
    });
    const destination = make("destination", {
      emptyText: "No station matches — try the station code"
    });
    const city = make("city", {
      allowCustom: true,
      emptyText: "Keep typing — any city is accepted"
    });
    [ origin, destination, city ].forEach(c => c.setLoading(true));
    let stations = [];
    const searchStations = query => {
      const q = query.trim().toUpperCase();
      if (!q) return stations.filter(s => s.rank).sort((a, b) => a.rank - b.rank);
      const scored = [];
      for (const s of stations) {
        let score = -1;
        if (s.code === q) score = 0; else if (s.code.startsWith(q)) score = 1; else if (s.name.startsWith(q)) score = 2; else if (s.words.some(w => w.startsWith(q))) score = 3; else if (s.name.includes(q) || s.cityU.includes(q)) score = 4;
        if (score >= 0) scored.push([ score, s ]);
      }
      scored.sort((a, b) => a[0] - b[0] || (a[1].rank || 999) - (b[1].rank || 999) || a[1].name.localeCompare(b[1].name));
      return scored.map(x => x[1]);
    };
    fetch("assets/stations.json").then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then(rows => {
      stations = rows.map(([code, name, state, cityName, rank]) => ({
        value: `${name} (${code})`,
        label: `${name} (${code})`,
        detail: state,
        code: code,
        name: name,
        words: name.split(/[\s.\-/]+/),
        cityU: (cityName || "").toUpperCase(),
        rank: rank
      }));
      origin.customSearch = destination.customSearch = searchStations;
      origin.setOptions(stations);
      destination.setOptions(stations);
      const names = new Set(window.MAJOR_CITIES || []);
      rows.forEach(r => (r[3] || "").split("/").map(c => c.trim()).filter(Boolean).forEach(c => names.add(c)));
      city.setOptions(Array.from(names).sort().map(c => ({
        value: c,
        label: c
      })));
      document.documentElement.dataset.stations = "ready";
    }).catch(() => {
      [ origin, destination ].forEach(c => {
        c.allowCustom = true;
        c.emptyText = "Station list unavailable — type the station";
      });
      [ origin, destination ].forEach(c => c.setOptions([]));
      city.setOptions((window.MAJOR_CITIES || []).map(c => ({
        value: c,
        label: c
      })));
      toast("Couldn't load the station list. You can still type station names.", "warning");
      document.documentElement.dataset.stations = "failed";
    });
  }
  function syncJourneyType() {
    const round = isRoundTrip();
    $("#returnDateField").hidden = !round;
    $("#returnDate").required = round;
    if (!round) {
      $("#returnDate").value = "";
      setError($("#returnDate"), "");
    }
    updateProgress();
  }
  function syncQuota() {
    const other = radio("quota") === "Other";
    $("#quotaOtherField").hidden = !other;
    $("#quotaOther").required = other;
    if (!other) {
      $("#quotaOther").value = "";
      setError($("#quotaOther"), "");
    }
    const hint = {
      Tatkal: "Tatkal opens one day before the journey (AC 10:00 AM, Non-AC 11:00 AM IST), has extra charges and allows up to 4 passengers.",
      "Premium Tatkal": "Premium Tatkal opens with Tatkal, uses dynamic fares and allows up to 4 passengers.",
      Ladies: "Ladies quota is for women travelling alone or with children under 12.",
      Other: "Other quotas are subject to eligibility and availability."
    }[radio("quota")] || (radio("quota") === "General" ? "General booking opens 60 days before the journey at 8:00 AM IST." : "Choose how the ticket should be booked.");
    $("#quotaHint").textContent = hint;
  }
  const COACH_CLASSES = {
    AC: [ "1A", "2A", "3A", "3E", "CC" ],
    "Non-AC": [ "SL", "2S" ]
  };
  let allClassOptions = null;
  function syncCoach(fromUser) {
    const select = $("#travelClass");
    const combo = select._combo;
    if (!combo) return;
    if (!allClassOptions) allClassOptions = combo.options.slice();
    const allowed = COACH_CLASSES[radio("coachType")];
    combo.setOptions(allowed ? allClassOptions.filter(o => allowed.includes(o.value)) : allClassOptions);
    if (allowed && select.value && !allowed.includes(select.value)) {
      select.value = "";
      combo.sync();
      if (fromUser) select.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    updateProgress();
  }
  function syncCoachFromClass() {
    const cls = value("travelClass");
    if (!cls) return;
    const coach = Object.keys(COACH_CLASSES).find(k => COACH_CLASSES[k].includes(cls));
    if (coach && radio("coachType") !== coach) {
      form.querySelector(`input[name="coachType"][value="${coach}"]`).checked = true;
      setError($("#coachType"), "");
      syncCoach(false);
    }
  }
  function syncDateLimits() {
    const today = todayIST();
    $("#journeyDate").min = today;
    $("#returnDate").min = value("journeyDate") || today;
  }
  function makeRequestId() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
    return `RBR-${todayIST().replace(/-/g, "")}-${suffix}`;
  }
  function timestampIST(date = new Date) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map(x => [ x.type, x.value ]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} IST`;
  }
  function collectRequest() {
    const quota = radio("quota") === "Other" ? `Other: ${value("quotaOther")}` : radio("quota");
    return {
      requestId: makeRequestId(),
      submittedAt: timestampIST(),
      customer: {
        firstName: joinName(value("firstName")),
        middleName: joinName(value("middleName")),
        lastName: joinName(value("lastName")),
        fullName: joinName(value("firstName"), value("middleName"), value("lastName")),
        mobile: normalizeMobile(value("mobile")),
        whatsapp: value("whatsapp") ? normalizeMobile(value("whatsapp")) : "",
        email: value("email").toLowerCase(),
        city: value("city")
      },
      journey: {
        origin: value("origin").toUpperCase(),
        destination: value("destination").toUpperCase(),
        journeyType: radio("journeyType"),
        journeyDate: value("journeyDate"),
        returnDate: isRoundTrip() ? value("returnDate") : "",
        preferredTrain: value("preferredTrain"),
        preferredDeparture: value("preferredDeparture")
      },
      passengers: passengerCards().map(card => ({
        first: joinName(card.querySelector('[data-field="first"]').value),
        middle: joinName(card.querySelector('[data-field="middle"]').value),
        last: joinName(card.querySelector('[data-field="last"]').value),
        name: ticketNameOf(card),
        age: Number(card.querySelector('[data-field="age"]').value),
        gender: card.querySelector('[data-field="gender"]').value,
        berth: card.querySelector('[data-field="berth"]').value
      })),
      preferences: {
        travelClass: value("travelClass"),
        quota: quota,
        alternativeTrain: radio("alternativeTrain"),
        alternativeDate: radio("alternativeDate"),
        specialInstructions: $("#specialInstructions").value.trim()
      }
    };
  }
  function fingerprint(req) {
    const {requestId: requestId, submittedAt: submittedAt, ...content} = req;
    return JSON.stringify(content);
  }
  const CLASS_NAMES = {
    "1A": "1A – First AC",
    "2A": "2A – Second AC",
    "3A": "3A – Third AC",
    "3E": "3E – AC Economy",
    SL: "SL – Sleeper",
    CC: "CC – Chair Car",
    "2S": "2S – Second Sitting"
  };
  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  function renderSummary(req) {
    const rowsHtml = pairs => pairs.filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
    const passengers = req.passengers.map((p, i) => `<tr><td class="num">${i + 1}</td><td>${esc(p.name)}</td><td class="num">${p.age}</td><td>${esc(p.gender)}</td><td>${esc(p.berth)}</td></tr>`).join("");
    $("#summary").innerHTML = `\n      <div class="summary__block"><h3>Customer</h3><dl>${rowsHtml([ [ "Name", req.customer.fullName ], [ "Mobile", "+91 " + req.customer.mobile ], [ "WhatsApp", req.customer.whatsapp && "+91 " + req.customer.whatsapp ], [ "Email", req.customer.email ], [ "City", req.customer.city ] ])}</dl></div>\n      <div class="summary__block"><h3>Journey</h3><dl>${rowsHtml([ [ "From", req.journey.origin ], [ "To", req.journey.destination ], [ "Journey type", req.journey.journeyType ], [ "Journey date", formatDate(req.journey.journeyDate) ], [ "Return date", formatDate(req.journey.returnDate) ], [ "Preferred train", req.journey.preferredTrain ], [ "Preferred departure", req.journey.preferredDeparture ] ])}</dl></div>\n      <div class="summary__block"><h3>Passengers (${req.passengers.length})</h3>\n        <table><thead><tr><th class="num">#</th><th>Name</th><th class="num">Age</th><th>Gender</th><th>Berth</th></tr></thead>\n        <tbody>${passengers}</tbody></table></div>\n      <div class="summary__block"><h3>Preferences</h3><dl>${rowsHtml([ [ "Class", CLASS_NAMES[req.preferences.travelClass] || req.preferences.travelClass ], [ "Quota", req.preferences.quota ], [ "Alternative train OK", req.preferences.alternativeTrain ], [ "Alternative date OK", req.preferences.alternativeDate ], [ "Special instructions", req.preferences.specialInstructions ] ])}</dl></div>`;
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }
  function showSuccess(req, sent) {
    $("#successNotice").innerHTML = sent ? "<strong>Request received — this is not a ticket yet.</strong> The booking desk has your request and will " + "contact you. Quote the reference number above. A CSV copy has been downloaded for your records." : "<strong>This is a request, not a ticket.</strong> Your details have been saved as a CSV file on this " + "device and have <strong>not</strong> been sent anywhere. Please send the file to the booking desk and " + "quote your reference number.";
    $("#successId").textContent = req.requestId;
    $("#successTime").textContent = `Created ${req.submittedAt}`;
    renderSummary(req);
    form.hidden = true;
    $(".stepper").hidden = true;
    successView.hidden = false;
    refreshIcons();
    window.scrollTo({
      top: 0
    });
    successView.focus({
      preventScroll: true
    });
  }
  function downloadCsv(kind) {
    if (!lastCsv || !lastRequest) return;
    Csv.download(lastCsv[kind], Csv.fileName(kind, lastRequest.requestId));
  }
  async function onSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const firstInvalid = validateAll();
    updateProgress();
    if (firstInvalid) {
      $$("[data-section]").forEach(card => {
        if (card.querySelector(".is-invalid")) setSectionOpen(card, true, false);
      });
      toast("Please fix the highlighted fields.", "error");
      firstInvalid.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      const target = firstInvalid._combo ? firstInvalid._combo.input : firstInvalid.tagName === "FIELDSET" ? firstInvalid.querySelector("input") : firstInvalid;
      target.focus({
        preventScroll: true
      });
      return;
    }
    const request = collectRequest();
    const print = fingerprint(request);
    let previous = null;
    try {
      previous = JSON.parse(sessionStorage.getItem("rbr:last") || "null");
    } catch (_) {}
    if (previous && previous.fingerprint === print) {
      toast(`This exact request was already created as ${previous.requestId}. Change something or start a new request.`, "warning", 7e3);
      return;
    }
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    submitBtn.setAttribute("aria-busy", "true");
    try {
      const result = await SubmissionService.submit(request);
      request.clientRequestId = request.requestId;
      request.requestId = result.requestId;
      request.submittedAt = result.submittedAt || request.submittedAt;
      lastRequest = request;
      lastCsv = Csv.build(request);
      try {
        sessionStorage.setItem("rbr:last", JSON.stringify({
          fingerprint: print,
          requestId: request.requestId
        }));
      } catch (_) {}
      showSuccess(request, !result.local);
      if (CONFIG.autoDownload) downloadCsv(CONFIG.autoDownload);
      toast(result.local ? "Request created on this device. A CSV copy has been downloaded." : "Request sent to the booking desk. A CSV copy has been downloaded for you.", "success", 6e3);
    } catch (err) {
      toast(err.message || "Something went wrong. Please try again.", "error", 8e3);
      isSubmitting = false;
      submitBtn.disabled = false;
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.removeAttribute("aria-busy");
    }
  }
  function resetForm() {
    form.reset();
    [ "origin", "destination", "city" ].forEach(id => {
      $("#" + id).value = "";
    });
    window.Combobox.syncAll(form);
    passengerList.innerHTML = "";
    addPassenger(false);
    $$(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
    $$("[aria-invalid]").forEach(el => el.setAttribute("aria-invalid", "false"));
    $$(".field__error").forEach(el => {
      el.textContent = "";
    });
    $("#instructionsCount").textContent = "0";
    $$("[data-section]").forEach((c, i) => setSectionOpen(c, i === 0, false));
    syncJourneyType();
    syncQuota();
    syncCoach(false);
    syncDateLimits();
    updateProgress();
  }
  function startNewRequest() {
    resetForm();
    isSubmitting = false;
    submitBtn.disabled = false;
    lastRequest = null;
    lastCsv = null;
    successView.hidden = true;
    form.hidden = false;
    $(".stepper").hidden = false;
    window.scrollTo({
      top: 0
    });
    $("#firstName").focus();
  }
  function init() {
    $$("[data-max-passengers]").forEach(el => {
      el.textContent = String(CONFIG.maxPassengers);
    });
    const c = CONFIG.contact;
    const contactBits = [ c.email, c.phone ].filter(Boolean).join(" · ");
    $("[data-contact]").textContent = contactBits ? `For questions about your data or to ask for it to be deleted, contact ${c.name}: ${contactBits}.` : `For questions about your data or to ask for it to be deleted, contact ${c.name} that shared this form with you.`;
    $("[data-retention]").textContent = CONFIG.retentionText;
    setupSections();
    window.Combobox.enhanceAll(form);
    setupStations();
    addPassenger(false);
    syncJourneyType();
    syncQuota();
    syncCoach(false);
    syncDateLimits();
    form.addEventListener("focusout", e => {
      const t = e.target;
      const filled = t.value && t.value.trim() !== "";
      if (t.dataset && t.dataset.field) {
        if (filled || t.closest(".is-invalid")) validatePassengerInput(t);
      } else if (fieldValidators[t.id] && filled) validateField(t.id);
      updateProgress();
    });
    form.addEventListener("input", e => {
      const t = e.target;
      const invalid = t.closest(".is-invalid");
      if (invalid) {
        if (t.dataset && t.dataset.field) validatePassengerInput(t); else if (fieldValidators[t.id]) validateField(t.id);
      }
      if (t.id === "specialInstructions") $("#instructionsCount").textContent = String(t.value.length);
      if (t.dataset && NAME_PARTS.includes(t.dataset.field)) updateTicketName(t.closest("[data-passenger]"));
      updateProgress();
    });
    form.addEventListener("change", e => {
      const t = e.target;
      if (t._combo) {
        const typedButNotChosen = !t.value && t._combo.input.value.trim() && document.activeElement !== t._combo.input;
        if (t.value || typedButNotChosen || t.closest(".is-invalid")) {
          if (t.dataset.field) validatePassengerInput(t); else validateField(t.id);
        }
      }
      if (t.name === "journeyType") syncJourneyType();
      if (t.type === "radio" && fieldValidators[t.name]) validateField(t.name);
      if (t.name === "quota") syncQuota();
      if (t.name === "coachType") syncCoach(true);
      if (t.id === "travelClass") syncCoachFromClass();
      if (t.id === "journeyDate") {
        syncDateLimits();
        if (isRoundTrip() && value("returnDate")) validateField("returnDate");
      }
      if (t.type === "checkbox" && t.closest("#section-declaration") && t.checked) {
        t.closest(".check").classList.remove("is-invalid");
        if ($$("#section-declaration .check input").every(b => b.checked)) $("#declarations-error").textContent = "";
      }
      updateProgress();
    });
    addPassengerBtn.addEventListener("click", () => addPassenger(true));
    passengerList.addEventListener("click", e => {
      const btn = e.target.closest("[data-remove]");
      if (btn) removePassenger(btn.closest("[data-passenger]"));
    });
    form.addEventListener("submit", onSubmit);
    const dialog = $("#resetDialog");
    $("#resetForm").addEventListener("click", () => {
      if (typeof dialog.showModal === "function") dialog.showModal(); else if (window.confirm("Clear the form? Everything you've entered will be removed.")) resetForm();
    });
    $("#resetCancel").addEventListener("click", () => dialog.close());
    $("#resetConfirm").addEventListener("click", () => {
      dialog.close();
      resetForm();
      toast("Form cleared.", "info", 2500);
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
    $$("[data-download]").forEach(btn => btn.addEventListener("click", () => downloadCsv(btn.dataset.download)));
    $("#printSummary").addEventListener("click", () => window.print());
    $("#newRequest").addEventListener("click", startNewRequest);
    watchActiveSection();
    updateProgress();
    refreshIcons();
  }
  window.BookingApp = {
    CONFIG: CONFIG,
    SubmissionService: SubmissionService,
    timestampIST: timestampIST,
    makeRequestId: makeRequestId
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();