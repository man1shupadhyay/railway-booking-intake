(function() {
  "use strict";
  const ARP_DAYS = 60;
  const GENERAL_OPEN = "08:00";
  const TATKAL_AC_OPEN = "10:00";
  const TATKAL_NON_AC_OPEN = "11:00";
  const NON_AC_CLASSES = [ "SL", "2S", "FS" ];
  const IST_OFFSET_MIN = 330;
  function nowIST(date = new Date) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23"
    }).formatToParts(date).map(x => [ x.type, x.value ]));
    return {
      date: `${p.year}-${p.month}-${p.day}`,
      time: `${p.hour}:${p.minute}:${p.second}`,
      weekday: p.weekday,
      seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)
    };
  }
  function addDays(iso, days) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function pretty(iso, withWeekday = false) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...withWeekday ? {
        weekday: "short"
      } : {}
    }).format(new Date(iso + "T00:00:00Z"));
  }
  function time12(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return `${(h + 11) % 12 + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  function istInstant(iso, hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(Date.parse(iso + "T00:00:00Z") + (h * 60 + m - IST_OFFSET_MIN) * 6e4);
  }
  const isNonAc = cls => NON_AC_CLASSES.includes(String(cls || "").toUpperCase());
  function windowsFor(journeyDate, travelClass) {
    const generalDate = addDays(journeyDate, -ARP_DAYS);
    const tatkalDate = addDays(journeyDate, -1);
    const tatkalTime = travelClass ? isNonAc(travelClass) ? TATKAL_NON_AC_OPEN : TATKAL_AC_OPEN : null;
    return {
      general: {
        date: generalDate,
        time: GENERAL_OPEN,
        at: istInstant(generalDate, GENERAL_OPEN)
      },
      tatkal: {
        date: tatkalDate,
        time: tatkalTime,
        at: tatkalTime ? istInstant(tatkalDate, tatkalTime) : null
      }
    };
  }
  function latestOpenJourneyDate(now = nowIST()) {
    const opened = now.seconds >= 8 * 3600 ? now.date : addDays(now.date, -1);
    return addDays(opened, ARP_DAYS);
  }
  window.BookingRules = {
    ARP_DAYS: ARP_DAYS,
    GENERAL_OPEN: GENERAL_OPEN,
    TATKAL_AC_OPEN: TATKAL_AC_OPEN,
    TATKAL_NON_AC_OPEN: TATKAL_NON_AC_OPEN,
    nowIST: nowIST,
    addDays: addDays,
    pretty: pretty,
    time12: time12,
    istInstant: istInstant,
    isNonAc: isNonAc,
    windowsFor: windowsFor,
    latestOpenJourneyDate: latestOpenJourneyDate
  };
})();