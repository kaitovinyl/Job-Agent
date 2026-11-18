const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, fixture } = require('./load-app');

const app = loadApp();
const jobs = fixture().ergebnisliste.map(app.mapBAJobToLocalFormat);

test('[lokal] Mapping: Grundfelder aus echter BA-Beispielantwort', () => {
  assert.equal(jobs.length, 3);
  const j = jobs[1];
  assert.equal(j.title, 'Industriemechaniker (m/w/d)');
  assert.equal(j.company, 'Randstad Deutschland');
  assert.equal(j.location, 'München');
  assert.equal(j.distanceKm, 7);
  assert.equal(j.id, 'ba-11119-4950990322-S');
  assert.equal(j.source, 'Bundesagentur für Arbeit');
});

test('[lokal] Mapping: vertragsdauer UNBEFRISTET -> permanent, KEINE_ANGABE -> unknown', () => {
  assert.equal(jobs[0].contractType, 'permanent');
  assert.equal(jobs[2].contractType, 'unknown');
});

test('[simuliert] Mapping: vertragsdauer BEFRISTET -> fixed_term (Wert kommt in Beispieldatei nicht vor)', () => {
  const raw = { ...fixture().ergebnisliste[0], vertragsdauer: 'BEFRISTET' };
  assert.equal(app.mapBAJobToLocalFormat(raw, 0).contractType, 'fixed_term');
});

test('[lokal] Mapping: Zeitarbeit-Regex ist nur Heuristik (tempIsHeuristic) und kennzeichnet bekannte Agenturen', () => {
  assert.equal(jobs[0].isTemporaryWork, true);   // Walter-Fach-Kraft
  assert.equal(jobs[1].isTemporaryWork, true);   // Randstad
  assert.equal(jobs[2].isTemporaryWork, false);  // Younivers
  assert.ok(jobs.every(j => j.tempIsHeuristic === true));
});

test('[lokal] Mapping: Schicht/Nacht aus arbeitszeitSchichtNachtWochenende (true/false/fehlend)', () => {
  assert.equal(jobs[0].shiftWork, 'required');
  assert.equal(jobs[1].shiftWork, 'not_required');
  assert.equal(jobs[2].shiftWork, 'unknown');
});

test('[lokal] Mapping: Stellenart ARBEIT ist keine Ausbildung/Praktikum', () => {
  assert.ok(jobs.every(j => j.isTrainingOrInternship === false));
});

test('[lokal] Mapping: Facetten der Beispielantwort sind konsistent (false+true = Gesamt, 1+2+3 = Gesamt)', () => {
  const f = fixture();
  const sum = o => Object.values(o.counts).reduce((a, b) => a + b, 0);
  assert.equal(sum(f.facetten.zeitarbeit), f.maxErgebnisse);
  assert.equal(sum(f.facetten.befristung), f.maxErgebnisse);
});

// Bekannte Lücken (Schritt C/D noch nicht umgesetzt) – werden als OFFEN gemeldet, nicht als Fehler.
test('[lokal] Mapping: Teilzeit aus arbeitszeitTeilzeit* erkennen', { todo: 'Schritt D' }, () => {
  const raw = { ...fixture().ergebnisliste[1], arbeitszeitVollzeit: false, arbeitszeitTeilzeitVormittag: true };
  assert.deepEqual(app.mapBAJobToLocalFormat(raw, 0).employmentTypes, ['part_time']);
});

test('[lokal] Mapping: externeURL (Groß-URL) wird als Link verwendet', { todo: 'Schritt D' }, () => {
  assert.equal(jobs[1].sourceUrl, 'https://jobboard.compleet.com/?externalId=4950990322');
});
