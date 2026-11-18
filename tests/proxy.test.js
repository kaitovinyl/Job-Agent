const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/ba-jobs.js');

// Simuliert: fetch zur BA wird gemockt, es geht kein Netzwerkverkehr raus.
async function call(query, method = 'GET', fetchImpl) {
  let upstream = null;
  const orig = global.fetch;
  global.fetch = fetchImpl || (async (u) => { upstream = String(u); return { status: 200, text: async () => '{"ok":1}' }; });
  const out = {};
  const res = { status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; }, setHeader() {} };
  try { await handler({ method, query }, res); } finally { global.fetch = orig; }
  return { code: out.code, body: out.body, upstream };
}
const qs = u => new URL(u).searchParams;

test('[simuliert] Proxy: zeitarbeit=false/true wird an die BA durchgereicht', async () => {
  for (const v of ['false', 'true']) {
    const r = await call({ was: 'a', zeitarbeit: v });
    assert.equal(r.code, 200);
    assert.equal(qs(r.upstream).get('zeitarbeit'), v);
  }
});

test('[simuliert] Proxy: zeitarbeit wird normalisiert (FALSE -> false), leer wird weggelassen', async () => {
  assert.equal(qs((await call({ zeitarbeit: 'FALSE' })).upstream).get('zeitarbeit'), 'false');
  assert.equal(qs((await call({ zeitarbeit: '' })).upstream).has('zeitarbeit'), false);
});

test('[simuliert] Proxy: ungültiges zeitarbeit -> 400, kein BA-Aufruf', async () => {
  for (const v of ['1', 'yes', 'null', ['true', 'false'], 'true;x']) {
    const r = await call({ zeitarbeit: v });
    assert.equal(r.code, 400, JSON.stringify(v));
    assert.equal(r.upstream, null);
  }
});

test('[simuliert] Proxy: nicht erlaubte Parameter werden nicht weitergegeben', async () => {
  const r = await call({ was: 'a', angebotsart: '4', evil: 'x' });
  assert.equal(qs(r.upstream).has('angebotsart'), false);
  assert.equal(qs(r.upstream).has('evil'), false);
});

test('[simuliert] Proxy: Standard size=25, Zahlenbereiche und Längen werden geprüft', async () => {
  assert.equal(qs((await call({ was: 'a' })).upstream).get('size'), '25');
  assert.equal((await call({ umkreis: '999' })).code, 400);
  assert.equal((await call({ size: '0' })).code, 400);
  assert.equal((await call({ was: 'x'.repeat(201) })).code, 400);
});

test('[simuliert] Proxy: nur GET erlaubt', async () => {
  assert.equal((await call({}, 'POST')).code, 405);
});

test('[simuliert] Proxy: BA nicht erreichbar -> 502, Timeout -> 504', async () => {
  assert.equal((await call({}, 'GET', async () => { throw new Error('boom'); })).code, 502);
  assert.equal((await call({}, 'GET', async () => { const e = new Error('t'); e.name = 'AbortError'; throw e; })).code, 504);
});
