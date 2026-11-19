(function() {
  "use strict";
  const R = window.BookingRules;
  const $ = s => document.querySelector(s);
  if (!R || !$("#bookingPanel")) return;
  const pad = n => String(n).padStart(2, "0");
  const hms = secs => `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs % 3600 / 60))}:${pad(secs % 60)}`;
  function render() {
    const now = R.nowIST();
    $("#istTime").textContent = now.time;
    $("#istDate").textContent = R.pretty(now.date, true);
    const opensToday = now.seconds < 8 * 3600;
    const nextOpenDate = opensToday ? now.date : R.addDays(now.date, 1);
    const untilNext = Math.round((R.istInstant(nextOpenDate, R.GENERAL_OPEN) - Date.now()) / 1e3);
    $("#generalUpTo").textContent = R.pretty(R.latestOpenJourneyDate(now));
    $("#generalNext").textContent = R.pretty(R.addDays(nextOpenDate, R.ARP_DAYS));
    $("#generalCountdown").textContent = hms(Math.max(0, untilNext));
    const tatkalFor = R.addDays(now.date, 1);
    $("#tatkalFor").textContent = R.pretty(tatkalFor);
    const ac = now.seconds >= 10 * 3600, nonAc = now.seconds >= 11 * 3600;
    $("#tatkalAc").classList.toggle("is-open", ac);
    $("#tatkalNonAc").classList.toggle("is-open", nonAc);
    $("#tatkalAc").textContent = ac ? "Open" : "Soon";
    $("#tatkalNonAc").textContent = nonAc ? "Open" : "Soon";
  }
  function renderJourneyNote() {
    const note = $("#journeyWindow");
    const date = $("#journeyDate") && $("#journeyDate").value;
    if (!note) return;
    if (!date) {
      note.hidden = true;
      return;
    }
    const coach = (document.querySelector('input[name="coachType"]:checked') || {}).value || "";
    const cls = ($("#travelClass") ? $("#travelClass").value : "") || (coach === "Non-AC" ? "SL" : coach === "AC" ? "3A" : "");
    const w = R.windowsFor(date, cls);
    const generalOpen = Date.now() >= w.general.at.getTime();
    const tatkalText = cls ? `${R.pretty(w.tatkal.date)}, ${R.time12(w.tatkal.time)} (${R.isNonAc(cls) ? "non-AC" : "AC"})` : `${R.pretty(w.tatkal.date)} — 10:00 AM AC / 11:00 AM non-AC`;
    note.hidden = false;
    note.classList.toggle("is-future", !generalOpen);
    note.innerHTML = "";
    const line = (label, text) => {
      const row = document.createElement("span");
      const b = document.createElement("b");
      b.textContent = label;
      row.append(b, " " + text);
      note.appendChild(row);
    };
    line("General booking:", generalOpen ? `open now (opened ${R.pretty(w.general.date)}, 8:00 AM IST)` : `opens ${R.pretty(w.general.date, true)}, 8:00 AM IST — we'll book when it opens`);
    line("Tatkal:", `opens ${tatkalText} IST`);
  }
  render();
  renderJourneyNote();
  setInterval(render, 1e3);
  document.addEventListener("change", e => {
    if (e.target.id === "journeyDate" || e.target.id === "travelClass" || e.target.name === "quota" || e.target.name === "coachType") renderJourneyNote();
  });
  document.addEventListener("input", e => {
    if (e.target.id === "journeyDate") renderJourneyNote();
  });
})();