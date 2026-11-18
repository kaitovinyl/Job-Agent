// ECHTE Live-Tests gegen das Vercel-Deployment (läuft über Proxy -> BA, kein Mock).
// Basis-URL: Umgebungsvariable BASE_URL, sonst die Vorschau-URL unten.
// Ist die Seite nicht erreichbar oder durch Vercel-Login geschützt, gilt NICHT TESTBAR.
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.BASE_URL ||
  'https://job-agent-git-claude-job-agent-takeover-cjx7sj-kaito-cab8.vercel.app').replace(/\/$/, '');
const AGENCY = /(personal|zeitarbeit|leiharbeit|arbeitnehmerüberlassung|randstad|adecco|manpower|walter-fach-kraft|trenkwalder|dis ag)/i;

// Ergebnisse werden einmal geladen; Fehler -> alle Tests als NICHT TESTBAR
let data = null, problem = null;
async function load() {
  const variants = { ohne: '', falsch: '&zeitarbeit=false', wahr: '&zeitarbeit=true' };
  const out = {};
  for (const [k, extra] of Object.entries(variants)) {
    const url = `${BASE}/api/ba-jobs?was=Industriemechaniker&wo=M%C3%BCnchen&umkreis=25&size=25${extra}`;
    let r;
    try { r = await fetch(url, { redirect: 'manual' }); }
    catch (e) { return { problem: `Verbindung fehlgeschlagen (${e.cause?.code || e.message})` }; }
    const text = await r.text();
    if (r.status >= 300 && r.status < 400) return { problem: `HTTP ${r.status} – Deployment durch Vercel Authentication geschützt (${text.split('\n')[0]})` };
    let json = null; try { json = JSON.parse(text); } catch { /* kein JSON */ }
    out[k] = { status: r.status, json, url };
  }
  return { out };
}
const ready = load().then(r => { data = r.out; problem = r.problem; });
const guard = async () => { await ready; return problem ? `NICHT TESTBAR: ${problem}` : false; };

test('[live] Alle drei Aufrufe liefern HTTP 200 und JSON mit ergebnisliste', async t => {
  const skip = await guard(); if (skip) return t.skip(skip);
  for (const [k, v] of Object.entries(data)) {
    assert.equal(v.status, 200, `${k}: ${v.url}`);
    assert.ok(Array.isArray(v.json?.ergebnisliste), `${k}: keine ergebnisliste`);
  }
});

test('[live] zeitarbeit=false liefert weniger Treffer als ohne Filter; true weniger als ohne', async t => {
  const skip = await guard(); if (skip) return t.skip(skip);
  const n = k => data[k].json.maxErgebnisse;
  t.diagnostic(`maxErgebnisse: ohne=${n('ohne')}, false=${n('falsch')}, true=${n('wahr')}`);
  assert.ok(n('falsch') < n('ohne'), 'false nicht kleiner als ohne -> Parameter wirkt nicht');
  assert.ok(n('wahr') < n('ohne'), 'true nicht kleiner als ohne -> Parameter wirkt nicht');
});

test('[live] zeitarbeit: false + true ergibt Gesamtzahl (Toleranz 3 wegen laufender Änderungen)', async t => {
  const skip = await guard(); if (skip) return t.skip(skip);
  const n = k => data[k].json.maxErgebnisse;
  assert.ok(Math.abs(n('falsch') + n('wahr') - n('ohne')) <= 3, `${n('falsch')} + ${n('wahr')} != ${n('ohne')}`);
});

test('[live] Arbeitgeber plausibel: Agentur-Namen sind bei true bei true häufiger als bei false', async t => {
  const skip = await guard(); if (skip) return t.skip(skip);
  const firms = k => data[k].json.ergebnisliste.map(j => j.firma || '');
  const share = a => a.filter(x => AGENCY.test(x)).length / Math.max(a.length, 1);
  const f = firms('falsch'), w = firms('wahr');
  t.diagnostic(`erste Arbeitgeber false: ${f.slice(0, 5).join(' | ')}`);
  t.diagnostic(`erste Arbeitgeber true:  ${w.slice(0, 5).join(' | ')}`);
  // Hinweis: Einzelne Agentur-Namen in der false-Liste sind erlaubt (BA setzt das Flag pro Anzeige,
  // z. B. Direktvermittlung einer Agentur). Geprüft wird nur die Richtung (Namens-Regex ist ein grobes Maß).
  assert.ok(w.some(x => AGENCY.test(x)), 'true-Liste enthält keine erkennbare Zeitarbeitsfirma');
  t.diagnostic(`Anteil Agentur-Namen: false=${share(f)} true=${share(w)}`);
  assert.ok(share(f) < share(w), `Anteil Agentur-Namen false=${share(f)} true=${share(w)}`);
});

test('[live] Ungültiger Parameter wird vom Proxy mit 400 abgelehnt', async t => {
  const skip = await guard(); if (skip) return t.skip(skip);
  const r = await fetch(`${BASE}/api/ba-jobs?was=x&zeitarbeit=maybe`, { redirect: 'manual' });
  assert.equal(r.status, 400);
});
