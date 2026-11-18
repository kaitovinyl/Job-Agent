const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, fixture } = require('./load-app');

const app = loadApp();
const { state, DEFAULTS } = app;
const baJobs = () => fixture().ergebnisliste.map(app.mapBAJobToLocalFormat);

function run(jobs, overrides = {}) {
  Object.assign(state, DEFAULTS, { query: '', location: '' }, overrides);
  app.setActive(jobs);
  return app.filterJobs();
}
// Schicht/Nacht-Filter ausschalten, damit nur der getestete Filter wirkt
const open = { showShift: true, showNight: true, showTravel: true, showOnCall: true };
const make = (extra) => ({ ...fixture().ergebnisliste[1], ...extra });
const map = (extra) => app.mapBAJobToLocalFormat(make(extra), 0);

test('[lokal] Zeitarbeit ausblenden: Namens-Heuristik blendet BA-Jobs NICHT mehr aus', () => {
  const r = run(baJobs(), { ...open, hideTemp: true });
  assert.equal(r.length, 3);
});

test('[lokal] Zeitarbeit ausblenden: Testjobs mit echtem Zeitarbeits-Flag werden weiterhin ausgeblendet', () => {
  const temp = app.JOBS.filter(j => j.isTemporaryWork);
  assert.ok(temp.length > 0);
  const r = run(app.JOBS, { ...open, hideTemp: true });
  temp.forEach(j => assert.ok(!r.includes(j)));
});

test('[lokal] Zeitarbeit: Tag "Zeitarbeit (vermutet)" bei BA-Heuristik, "Zeitarbeit" bei Testjobs', () => {
  const texts = j => app.buildTags(j).map(t => t.text);
  assert.ok(texts(baJobs()[1]).includes('Zeitarbeit (vermutet)'));
  assert.ok(texts(app.JOBS.find(j => j.isTemporaryWork)).includes('Zeitarbeit'));
});

test('[lokal] Personalvermittlung und Ausbildung blenden weiterhin aus', () => {
  const rec = map({ firma: 'Hays AG' }), tr = map({ stellenangebotsart: 'AUSBILDUNG' });
  assert.equal(run([rec], { ...open, hideRecruiter: true }).length, 0);
  assert.equal(run([tr], { ...open, hideTraining: true }).length, 0);
  assert.equal(run([rec, tr], { ...open }).length, 2);
});

test('[lokal] Befristung: "Nur befristet" zeigt nur BEFRISTET', () => {
  const js = ['UNBEFRISTET', 'BEFRISTET', 'KEINE_ANGABE'].map(v => map({ vertragsdauer: v }));
  const r = run(js, { ...open, contract: 'fixed_term' });
  assert.deepEqual(r.map(j => j.contractType), ['fixed_term']);
});

test('[lokal] Befristung: "Nur unbefristet" zeigt UNBEFRISTET', () => {
  const js = ['UNBEFRISTET', 'BEFRISTET'].map(v => map({ vertragsdauer: v }));
  assert.deepEqual(run(js, { ...open, contract: 'permanent' }).map(j => j.contractType), ['permanent']);
});

test('[lokal] Befristung: "Nur unbefristet" lässt KEINE_ANGABE sichtbar (Entscheidung C)', { todo: 'Schritt C' }, () => {
  const js = ['UNBEFRISTET', 'BEFRISTET', 'KEINE_ANGABE'].map(v => map({ vertragsdauer: v }));
  const r = run(js, { ...open, contract: 'permanent' });
  assert.deepEqual(r.map(j => j.contractType).sort(), ['permanent', 'unknown']);
});

test('[lokal] Vollzeit/Teilzeit-Filter', () => {
  const ft = map({}), pt = app.mapBAJobToLocalFormat({ ...make({}), arbeitszeitVollzeit: false }, 0);
  pt.employmentTypes = ['part_time']; // Zielzustand eines reinen Teilzeitjobs
  assert.deepEqual(run([ft, pt], { ...open, partTime: false }).map(j => j.employmentTypes[0]), ['full_time']);
  assert.deepEqual(run([ft, pt], { ...open, fullTime: false }).map(j => j.employmentTypes[0]), ['part_time']);
});

test('[lokal] Teilzeit-Job aus BA-Daten erscheint bei "nur Vollzeit" nicht', { todo: 'Schritt D' }, () => {
  const pt = map({ arbeitszeitVollzeit: false, arbeitszeitTeilzeitVormittag: true });
  assert.equal(run([pt], { ...open, partTime: false }).length, 0);
});

test('[lokal] Radius: Treffer jenseits des Radius werden ausgeblendet (Ort gesetzt)', () => {
  const near = map({ entfernung: 5 }), far = map({ entfernung: 40 });
  assert.equal(run([near, far], { ...open, location: 'München', radius: 10 }).length, 1);
});

test('[lokal] Ortsfilter: BA-Umkreistreffer aus Nachbarort (z. B. Gilching bei Suche München) bleibt sichtbar', { todo: 'Schritt D' }, () => {
  const gil = map({ stellenlokationen: [{ adresse: { ort: 'Gilching' } }], entfernung: 15 });
  assert.equal(run([gil], { ...open, location: 'München', radius: 25 }).length, 1);
});

test('[lokal] Schicht-/Nachtarbeit: required wird standardmäßig ausgeblendet, unknown bleibt sichtbar', () => {
  const r = run(baJobs(), {});
  assert.deepEqual(r.map(j => j.shiftWork).sort(), ['not_required', 'unknown']);
});
