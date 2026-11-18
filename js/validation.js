(function() {
  "use strict";
  const NAME_RE = /^[A-Za-z][A-Za-z .]*$/;
  const TICKET_NAME_MIN = 3;
  const TICKET_NAME_MAX = 16;
  function joinName(...parts) {
    return parts.map(p => String(p || "").trim().replace(/\s+/g, " ")).filter(Boolean).join(" ");
  }
  function normalizeMobile(value) {
    let digits = String(value || "").replace(/[\s\-().]/g, "");
    if (digits.startsWith("+91")) digits = digits.slice(3); else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2); else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
  }
  function isIndianMobile(value) {
    return /^[6-9]\d{9}$/.test(normalizeMobile(value));
  }
  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value || "").trim());
  }
  function todayIST() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date);
    return parts;
  }
  function isValidISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const d = new Date(value + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  const rules = {
    firstName(v) {
      const s = String(v || "").trim();
      if (!s) return "Please enter the first name.";
      if (!NAME_RE.test(s)) return "Use English letters, spaces or dots only.";
      return "";
    },
    optionalName(v) {
      const s = String(v || "").trim();
      if (s && !NAME_RE.test(s)) return "Use English letters, spaces or dots only.";
      return "";
    },
    ticketName(full) {
      if (full.length < TICKET_NAME_MIN) return `Name on ticket must be at least ${TICKET_NAME_MIN} characters.`;
      if (full.length > TICKET_NAME_MAX) {
        return `Name on ticket is ${full.length} characters — IRCTC allows ${TICKET_NAME_MAX}. Shorten the middle name to an initial.`;
      }
      return "";
    },
    mobile(v) {
      if (!String(v || "").trim()) return "Please enter a mobile number.";
      if (!isIndianMobile(v)) return "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
      return "";
    },
    whatsapp(v) {
      if (!String(v || "").trim()) return "Please enter a WhatsApp number (it can be the same as your mobile).";
      if (!isIndianMobile(v)) return "Enter a valid 10-digit Indian mobile number.";
      return "";
    },
    email(v) {
      if (!String(v || "").trim()) return "Please enter your email address.";
      if (!isEmail(v)) return "Enter a valid email address, like name@example.com.";
      return "";
    },
    city(v) {
      const s = String(v || "").trim();
      if (!s) return "Please enter your city.";
      if (!/^[\p{L}][\p{L}\p{M}\s.'-]*$/u.test(s)) return "Use letters only for the city.";
      return "";
    },
    station(v, label) {
      const s = String(v || "").trim();
      if (!s) return `Please choose the ${label} station from the list.`;
      return "";
    },
    journeyDate(v) {
      if (!v) return "Please choose a journey date.";
      if (!isValidISODate(v)) return "Enter a valid date.";
      if (v < todayIST()) return "Journey date can't be in the past.";
      return "";
    },
    returnDate(v, journeyDate) {
      if (!v) return "Please choose a return date for a round trip.";
      if (!isValidISODate(v)) return "Enter a valid date.";
      if (journeyDate && v < journeyDate) return "Return date can't be earlier than the journey date.";
      return "";
    },
    preferredTrain(v) {
      return String(v || "").trim() ? "" : "Enter a train name or number, or write Any.";
    },
    preferredDeparture(v) {
      return v ? "" : "Please choose a departure time (Any time is fine).";
    },
    quota(v) {
      return v ? "" : "Please choose a quota.";
    },
    yesNo(v) {
      return v ? "" : "Please choose Yes or No.";
    },
    specialInstructions(v) {
      return String(v || "").trim() ? "" : "Add any instructions, or write None.";
    },
    travelClass(v) {
      return v ? "" : "Please choose a travel class.";
    },
    quotaOther(v) {
      return String(v || "").trim() ? "" : "Please tell us which quota.";
    },
    passengerAge(v) {
      const s = String(v ?? "").trim();
      if (!s) return "Enter age.";
      if (!/^\d{1,3}$/.test(s)) return "Whole years only.";
      const n = Number(s);
      if (n < 1 || n > 125) return "Age must be 1–125.";
      return "";
    },
    passengerGender(v) {
      return v ? "" : "Choose gender.";
    },
    passengerBerth(v) {
      return v ? "" : "Choose a berth (No preference is fine).";
    }
  };
  window.Validation = {
    rules: rules,
    joinName: joinName,
    TICKET_NAME_MAX: TICKET_NAME_MAX,
    normalizeMobile: normalizeMobile,
    isIndianMobile: isIndianMobile,
    isEmail: isEmail,
    todayIST: todayIST,
    isValidISODate: isValidISODate
  };
})();