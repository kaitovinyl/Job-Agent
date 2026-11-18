// Simulierte Browser-Tests: echtes Chromium (Playwright) lädt index.html,
// die BA-Antwort (/api/ba-jobs) wird mit der Beispieldatei nachgestellt.
// Ohne Playwright werden die Tests als NICHT TESTBAR übersprungen.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { fixture } = require('./load-app');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* nicht installiert */ }
const skip = chromium ? false : 'Playwright nicht installiert';

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
const TOGGLE = k => `[data-toggle="${k}"] .toggle-switch`;

// Eine Sitzung = Server + Browser + Zähler der abgefangenen API-Anfragen
async function session(t) {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(HTML); });
  await new Promise(res => srv.listen(0, res));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const s = { reqs: [], mode: 'ok', dialogs: [], page };
  page.on('dialog', d => { s.dialogs.push(d.message()); d.dismiss(); });
  await page.route('**/api/ba-jobs*', route => {
    const u = new URL(route.request().url());
    s.reqs.push(u.searchParams);
    if (s.mode === 'fail') return route.fulfill({ status: 502, body: '{}' });
    // Simulation der BA: zeitarbeit=false entfernt die Agenturen der Beispieldatei
    const list = fixture().ergebnisliste.filter(j =>
      u.searchParams.get('zeitarbeit') !== 'false' || !/Randstad|Walter/.test(j.firma));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ergebnisliste: list }) });
  });
  t.after(async () => { await browser.close(); srv.close(); });
  await page.goto(`http://localhost:${srv.address().port}/`);
  s.text = () => page.evaluate(() => document.getElementById('results-section').innerText);
  s.search = async () => {
    await page.fill('#q', 'Industriemechaniker'); await page.fill('#loc', 'München');
    await page.click('#btn-search'); await page.waitForTimeout(1200);
  };
  s.toggle = async k => { await page.click(TOGGLE(k)); await page.waitForTimeout(1000); };
  // Schicht-/Nacht-Filter öffnen, damit alle 3 Beispieljobs sichtbar sind
  s.openConditions = async () => { for (const k of ['showShift', 'showNight']) await page.click(TOGGLE(k)); };
  s.checked = k => page.evaluate(id => document.getElementById(id).checked, 't-' + k);
  return s;
}

test('[simuliert] UI: Suche ohne Zeitarbeitsfilter sendet kein zeitarbeit, alle Jobs sichtbar', { skip }, async t => {
  const s = await session(t);
  await s.openConditions(); await s.search();
  assert.equal(s.reqs.length, 1);
  assert.equal(s.reqs[0].has('zeitarbeit'), false);
  const txt = await s.text();
  for (const f of ['Randstad', 'Walter-Fach-Kraft', 'Younivers']) assert.match(txt, new RegExp(f));
  assert.match(txt, /vermutet/);
});

test('[simuliert] UI: Schalter AN löst neue Anfrage mit zeitarbeit=false aus, AUS erneut ohne', { skip }, async t => {
  const s = await session(t);
  await s.openConditions(); await s.search();
  await s.toggle('hideTemp');
  assert.equal(s.reqs.length, 2);
  assert.equal(s.reqs[1].get('zeitarbeit'), 'false');
  assert.equal(s.reqs[1].get('was'), 'Industriemechaniker');
  let txt = await s.text();
  assert.doesNotMatch(txt, /Randstad|Walter-Fach-Kraft/);
  assert.match(txt, /Younivers/);
  await s.toggle('hideTemp');
  assert.equal(s.reqs.length, 3);
  assert.equal(s.reqs[2].has('zeitarbeit'), false);
  assert.match(await s.text(), /Randstad/);
});

test('[simuliert] UI: Schalter schon vor der Suche AN -> erste Anfrage enthält zeitarbeit=false', { skip }, async t => {
  const s = await session(t);
  await s.toggle('hideTemp'); // vor der Suche: noch keine Anfrage
  assert.equal(s.reqs.length, 0);
  await s.search();
  assert.equal(s.reqs.length, 1);
  assert.equal(s.reqs[0].get('zeitarbeit'), 'false');
});

test('[simuliert] UI: Neuabruf schlägt fehl -> alte Ergebnisse bleiben, Schalter springt zurück, Hinweis', { skip }, async t => {
  const s = await session(t);
  await s.openConditions(); await s.search();
  s.mode = 'fail';
  await s.toggle('hideTemp');
  assert.equal(s.reqs.length, 2);
  assert.equal(await s.checked('hideTemp'), false);
  assert.equal(s.dialogs.length, 1);
  assert.match(await s.text(), /Randstad/);
});

test('[simuliert] UI: Reset bei aktivem Schalter wiederholt die letzte Suche ohne zeitarbeit', { skip }, async t => {
  const s = await session(t);
  await s.openConditions(); await s.search();
  await s.toggle('hideTemp');
  await s.page.click('#btn-reset'); await s.page.waitForTimeout(1200);
  assert.equal(s.reqs.length, 3);
  assert.equal(s.reqs[2].has('zeitarbeit'), false);
  assert.equal(s.reqs[2].get('was'), 'Industriemechaniker');
  assert.equal(await s.checked('hideTemp'), false);
});

test('[simuliert] UI: Suche schlägt fehl -> Fallback auf Testdaten, Schalter löst keinen Neuabruf aus', { skip }, async t => {
  const s = await session(t);
  s.mode = 'fail';
  await s.search();
  assert.equal(s.reqs.length, 1);
  await s.toggle('hideTemp');
  assert.equal(s.reqs.length, 1);
});
