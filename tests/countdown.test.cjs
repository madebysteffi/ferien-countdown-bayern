// Run with: node --test tests/countdown.test.cjs (no dependencies).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const script = readFileSync(join(__dirname, '../script.js'), 'utf8');

function render(instant) {
  const elements = {};
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
  }
  const context = vm.createContext({
    Date: Clock,
    document: { getElementById(id) {
      return elements[id] ||= { textContent: '', hidden: true, style: {} };
    } }
  });
  vm.runInContext(script, context);
  return { elements, evaluate: code => vm.runInContext(code, context) };
}

const periods = [
  ['2026-10-30', '2026-10-31', '2026-11-08', '2026-11-02', '2026-11-06'],
  ['2026-12-23', '2026-12-24', '2027-01-10', '2026-12-24', '2027-01-08'],
  ['2027-02-05', '2027-02-06', '2027-02-14', '2027-02-08', '2027-02-12'],
  ['2027-03-19', '2027-03-20', '2027-04-04', '2027-03-22', '2027-04-02'],
  ['2027-05-14', '2027-05-15', '2027-05-30', '2027-05-18', '2027-05-28'],
  ['2027-07-30', '2027-07-31', '2027-09-13', '2027-08-02', '2027-09-13']
];

// Official dates checked against https://www.km.bayern.de/termine/ferien-und-feiertage
// on 2026-10-15. Adjacent weekends are part of the app's existing break periods.
test('all six official holiday periods and final school days', () => {
  const app = render('2026-10-15T12:00:00Z');
  assert.deepEqual(JSON.parse(app.evaluate('JSON.stringify(holidays.map(h => [h.lastSchoolDay, h.breakStart, h.breakEnd, h.officialStart, h.officialEnd]))')), periods);
});

for (const [last, start, end] of periods) {
  test(`${last}: today excluded, final school day included, holiday boundaries hidden`, () => {
    const before = new Date(`${last}T12:00:00Z`);
    before.setUTCDate(before.getUTCDate() - 1);
    const app = render(before.toISOString());
    assert.equal(app.elements.days.textContent, 1);
    assert.equal(app.elements.countdownDetails.textContent, '≈ 0,1 Wochen · 1 Schultag');
    assert.equal(app.elements.countdownDetails.hidden, false);
    const final = render(`${last}T12:00:00Z`).elements;
    assert.equal(final.days.textContent, 'Heute');
    assert.equal(final.dayWord.textContent, 'ist der letzte Schultag! 🎉');
    assert.equal(final.countdownDetails.hidden, true);
    for (const date of [start, end]) {
      const holiday = render(`${date}T12:00:00Z`).elements;
      assert.equal(holiday.dayWord.textContent, 'FERIEN');
      assert.equal(holiday.countdownDetails.hidden, true);
    }
  });
}

test('German decimal, calendar weeks and weekdays at the current countdown', () => {
  const { elements } = render('2026-10-15T12:00:00Z');
  assert.equal(elements.days.textContent, 15);
  assert.equal(elements.countdownDetails.textContent, '≈ 2,1 Wochen · 11 Schultage');
});

test('weekends are excluded', () => {
  for (const date of ['2026-10-23', '2026-10-24', '2026-10-25']) {
    assert.equal(render(`${date}T12:00:00Z`).elements.countdownDetails.textContent, '≈ ' + ({'2026-10-23':'1,0', '2026-10-24':'0,9', '2026-10-25':'0,7'}[date]) + ' Wochen · 5 Schultage');
  }
});

test('weekday counts over every interval in the configured school year, including DST and year change', () => {
  const app = render('2026-10-15T12:00:00Z');
  const actual = JSON.parse(app.evaluate(`JSON.stringify(holidays.map(h => {
    const result = [];
    for (let d = utcValue(h.schoolStart); d <= utcValue(h.lastSchoolDay); d += DAY) {
      result.push([d, utcValue(h.lastSchoolDay), remainingSchoolDays(d, utcValue(h.lastSchoolDay))]);
    }
    return result;
  }).flat())`));
  for (const [start, end, count] of actual) {
    // Independent inclusive weekday formula from the Monday of each date's week.
    const weekdaysThrough = timestamp => {
      const day = Math.floor(timestamp / 86400000) + 3; // epoch Thursday
      return Math.floor(day / 7) * 5 + Math.min(day % 7 + 1, 5);
    };
    assert.equal(count, weekdaysThrough(end) - weekdaysThrough(start));
  }
});

test('Bavarian date applies across midnight and DST regardless of host timezone', () => {
  assert.equal(render('2026-10-29T23:30:00Z').elements.days.textContent, 'Heute');
  assert.equal(render('2026-10-30T23:30:00Z').elements.dayWord.textContent, 'FERIEN');
  assert.equal(render('2027-03-28T22:30:00Z').evaluate('todayString'), '2027-03-29');
  assert.equal(render('2026-10-25T23:30:00Z').evaluate('todayString'), '2026-10-26');
});
