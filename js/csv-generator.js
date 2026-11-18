(function() {
  "use strict";
  const BOM = "\ufeff";
  const EOL = "\r\n";
  const REQUEST_COLUMNS = [ "RequestID", "SubmissionDate", "CustomerName", "Mobile", "WhatsApp", "Email", "Origin", "Destination", "JourneyDate", "ReturnDate", "JourneyType", "PreferredTrain", "TravelClass", "Quota", "PassengerCount", "AlternativeTrain", "AlternativeDate", "SpecialInstructions" ];
  const PASSENGER_COLUMNS = [ "RequestID", "PassengerName", "Age", "Gender", "BerthPreference" ];
  const COMBINED_COLUMNS = [ "RequestID", "SubmissionDate", "CustomerName", "CustomerFirstName", "CustomerMiddleName", "CustomerLastName", "Mobile", "WhatsApp", "Email", "City", "Origin", "Destination", "JourneyType", "JourneyDate", "ReturnDate", "PreferredTrain", "PreferredDeparture", "TravelClass", "Quota", "AlternativeTrain", "AlternativeDate", "SpecialInstructions", "PassengerCount", "PassengerNo", "PassengerName", "PassengerFirstName", "PassengerMiddleName", "PassengerLastName", "Age", "Gender", "BerthPreference" ];
  function escapeCell(value) {
    let s = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(columns, rows) {
    const lines = [ columns.map(escapeCell).join(",") ];
    for (const row of rows) lines.push(columns.map(c => escapeCell(row[c])).join(","));
    return lines.join(EOL) + EOL;
  }
  function requestRow(req) {
    return {
      RequestID: req.requestId,
      SubmissionDate: req.submittedAt,
      CustomerName: req.customer.fullName,
      CustomerFirstName: req.customer.firstName,
      CustomerMiddleName: req.customer.middleName,
      CustomerLastName: req.customer.lastName,
      Mobile: req.customer.mobile,
      WhatsApp: req.customer.whatsapp,
      Email: req.customer.email,
      City: req.customer.city,
      Origin: req.journey.origin,
      Destination: req.journey.destination,
      JourneyDate: req.journey.journeyDate,
      ReturnDate: req.journey.returnDate,
      JourneyType: req.journey.journeyType,
      PreferredTrain: req.journey.preferredTrain,
      PreferredDeparture: req.journey.preferredDeparture,
      TravelClass: req.preferences.travelClass,
      Quota: req.preferences.quota,
      PassengerCount: req.passengers.length,
      AlternativeTrain: req.preferences.alternativeTrain,
      AlternativeDate: req.preferences.alternativeDate,
      SpecialInstructions: req.preferences.specialInstructions
    };
  }
  function passengerRows(req) {
    return req.passengers.map(p => ({
      RequestID: req.requestId,
      PassengerName: p.name,
      Age: p.age,
      Gender: p.gender,
      BerthPreference: p.berth
    }));
  }
  function build(req) {
    const base = requestRow(req);
    return {
      requests: toCSV(REQUEST_COLUMNS, [ base ]),
      passengers: toCSV(PASSENGER_COLUMNS, passengerRows(req)),
      combined: toCSV(COMBINED_COLUMNS, req.passengers.map((p, i) => ({
        ...base,
        PassengerNo: i + 1,
        PassengerName: p.name,
        PassengerFirstName: p.first,
        PassengerMiddleName: p.middle,
        PassengerLastName: p.last,
        Age: p.age,
        Gender: p.gender,
        BerthPreference: p.berth
      })))
    };
  }
  function fileName(kind, requestId) {
    if (kind === "requests") return "BookingRequests.csv";
    if (kind === "passengers") return "Passengers.csv";
    return `BookingSummary_${requestId}.csv`;
  }
  function download(csvText, name) {
    const blob = new Blob([ BOM + csvText ], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  window.CsvGenerator = {
    REQUEST_COLUMNS: REQUEST_COLUMNS,
    PASSENGER_COLUMNS: PASSENGER_COLUMNS,
    COMBINED_COLUMNS: COMBINED_COLUMNS,
    escapeCell: escapeCell,
    toCSV: toCSV,
    build: build,
    fileName: fileName,
    download: download
  };
})();