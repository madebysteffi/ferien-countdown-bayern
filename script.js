const holidays = [
  {
    name: "Herbstferien 🍂",
    lastSchoolDay: "2026-10-30",
    officialStart: "2026-11-02",
    officialEnd: "2026-11-06",
    breakStart: "2026-10-31",
    breakEnd: "2026-11-08",
    schoolStart: "2026-09-15"
  },

  {
    name: "Weihnachtsferien 🎄",
    lastSchoolDay: "2026-12-23",
    officialStart: "2026-12-24",
    officialEnd: "2027-01-08",
    breakStart: "2026-12-24",
    breakEnd: "2027-01-10",
    schoolStart: "2026-11-09"
  },

  {
    name: "Frühjahrsferien ❄️",
    lastSchoolDay: "2027-02-05",
    officialStart: "2027-02-08",
    officialEnd: "2027-02-12",
    breakStart: "2027-02-06",
    breakEnd: "2027-02-14",
    schoolStart: "2027-01-11"
  },

  {
    name: "Osterferien 🐰",
    lastSchoolDay: "2027-03-19",
    officialStart: "2027-03-22",
    officialEnd: "2027-04-02",
    breakStart: "2027-03-20",
    breakEnd: "2027-04-04",
    schoolStart: "2027-02-15"
  },

  {
    name: "Pfingstferien 🌸",
    lastSchoolDay: "2027-05-14",
    officialStart: "2027-05-18",
    officialEnd: "2027-05-28",
    breakStart: "2027-05-15",
    breakEnd: "2027-05-30",
    schoolStart: "2027-04-05"
  },

  {
    name: "Sommerferien ☀️",
    lastSchoolDay: "2027-07-30",
    officialStart: "2027-08-02",
    officialEnd: "2027-09-13",
    breakStart: "2027-07-31",
    breakEnd: "2027-09-13",
    schoolStart: "2027-05-31"
  }
];


/* ------------------------------
   DATUMSFUNKTIONEN
------------------------------ */

const DAY = 86400000;


function utcValue(dateString) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return Date.UTC(
    year,
    month - 1,
    day
  );
}


function dateObject(dateString) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}


function shortDate(dateString) {
  return dateObject(dateString)
    .toLocaleDateString(
      "de-DE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );
}


function dateRange(start, end) {
  return `${shortDate(start)} – ${shortDate(end)}`;
}


/* ------------------------------
   HEUTIGES DATUM IN BAYERN
------------------------------ */

const berlinFormatter =
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );


const todayString =
  berlinFormatter.format(
    new Date()
  );


const todayUTC =
  utcValue(todayString);


/* ------------------------------
   HTML-ELEMENTE
------------------------------ */

const daysElement =
  document.getElementById("days");

const holidayElement =
  document.getElementById("holiday");

const dateElement =
  document.getElementById("date");

const officialElement =
  document.getElementById("officialDate");

const progressBar =
  document.getElementById("progressBar");

const progressLabel =
  document.getElementById("progressLabel");

const introElement =
  document.getElementById("countdownIntro");

const dayWordElement =
  document.getElementById("dayWord");

const nextHolidayElement =
  document.getElementById("nextHoliday");

const nextDateElement =
  document.getElementById("nextDate");


/* ------------------------------
   SIND GERADE FERIEN?
------------------------------ */

const currentHoliday =
  holidays.find(
    holiday =>
      todayUTC >= utcValue(holiday.breakStart) &&
      todayUTC <= utcValue(holiday.breakEnd)
  );


/* ------------------------------
   NÄCHSTE FERIEN FINDEN
------------------------------ */

let nextHoliday = null;


if (!currentHoliday) {

  nextHoliday =
    holidays.find(
      holiday =>
        utcValue(holiday.lastSchoolDay) >= todayUTC
    );

}


/* ------------------------------
   FALL 1: ES SIND FERIEN
------------------------------ */

if (currentHoliday) {

  introElement.textContent =
    "Endlich";

  daysElement.textContent =
    "🎉";

  daysElement.style.fontSize =
    "80px";

  daysElement.style.letterSpacing =
    "0";

  dayWordElement.textContent =
    "FERIEN";

  holidayElement.textContent =
    currentHoliday.name;

  dateElement.textContent =
    dateRange(
      currentHoliday.breakStart,
      currentHoliday.breakEnd
    );

  officialElement.textContent =
    "Offizielle Ferientage: " +
    dateRange(
      currentHoliday.officialStart,
      currentHoliday.officialEnd
    );

  progressBar.style.width =
    "100%";

  progressLabel.textContent =
    "100 %";
}


/* ------------------------------
   FALL 2: COUNTDOWN LÄUFT
------------------------------ */

else if (nextHoliday) {

  const lastSchoolDayUTC =
    utcValue(
      nextHoliday.lastSchoolDay
    );


 const daysRemaining =
  Math.max(
    0,
    (
      lastSchoolDayUTC -
      todayUTC
    ) / DAY
  );


if (daysRemaining === 0) {

  introElement.textContent =
    "";

  daysElement.textContent =
    "Heute";

  daysElement.style.fontSize =
    "64px";

  daysElement.style.letterSpacing =
    "-2px";

  dayWordElement.textContent =
    "ist der letzte Schultag! 🎉";

}

else {

  introElement.textContent =
    "Noch";

  daysElement.textContent =
    daysRemaining;

  daysElement.style.fontSize =
    "";

  daysElement.style.letterSpacing =
    "";

  dayWordElement.textContent =
    daysRemaining === 1
      ? "Tag"
      : "Tage";

}


  holidayElement.textContent =
    nextHoliday.name;


  dateElement.textContent =
    dateRange(
      nextHoliday.breakStart,
      nextHoliday.breakEnd
    );


  officialElement.textContent =
    "Offiziell: " +
    dateRange(
      nextHoliday.officialStart,
      nextHoliday.officialEnd
    ) +
    " · angrenzende Wochenenden inklusive";


  /* Fortschrittsbalken */

  const schoolStartUTC =
    utcValue(
      nextHoliday.schoolStart
    );


  const totalSchoolTime =
    lastSchoolDayUTC -
    schoolStartUTC;


  const elapsedSchoolTime =
    todayUTC -
    schoolStartUTC;


  let percentage =
    totalSchoolTime > 0
      ? (
          elapsedSchoolTime /
          totalSchoolTime
        ) * 100
      : 0;


  percentage =
    Math.round(
      Math.max(
        0,
        Math.min(
          100,
          percentage
        )
      )
    );


  progressBar.style.width =
    percentage + "%";


  progressLabel.textContent =
    percentage + " %";
}


/* ------------------------------
   FERIEN DANACH
------------------------------ */

let referenceHoliday =
  currentHoliday || nextHoliday;


if (referenceHoliday) {

  const index =
    holidays.indexOf(
      referenceHoliday
    );


  const holidayAfter =
    holidays[index + 1];


  if (holidayAfter) {

    nextHolidayElement.textContent =
      holidayAfter.name;


    nextDateElement.textContent =
      dateRange(
        holidayAfter.breakStart,
        holidayAfter.breakEnd
      );

  }

  else {

    nextHolidayElement.textContent =
      "Weitere Ferien folgen";

    nextDateElement.textContent =
      "";

  }
}
