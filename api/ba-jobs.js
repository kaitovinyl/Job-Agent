// api/ba-jobs.js
// Vercel Serverless Function – Proxy für die BA-Jobsuche v6 API
// Löst das CORS-Problem: Browser ruft /api/ba-jobs auf (gleicher Origin),
// diese Funktion ruft serverseitig die BA-API auf (kein Browser-CORS).

const BA_API_BASE = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs';
const BA_API_KEY  = 'jobboerse-jobsuche';
const TIMEOUT_MS  = 8000;

// Erlaubte Parameter mit optionaler Validierung
const ALLOWED_PARAMS = {
  was:     { maxLen: 200 },
  wo:      { maxLen: 200 },
  umkreis: { numeric: true, min: 0, max: 200 },
  size:    { numeric: true, min: 1, max: 100 },
  page:    { numeric: true, min: 0, max: 999 },
};

module.exports = async function handler(req, res) {
  // Nur GET erlaubt
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Query-Parameter bereinigen und validieren
  const upstream = new URLSearchParams();

  for (const [key, rules] of Object.entries(ALLOWED_PARAMS)) {
    const raw = req.query[key];
    if (raw === undefined || raw === '') continue;

    const val = String(raw).trim();
    if (val.length === 0) continue;

    // Längenprüfung für Textfelder
    if (rules.maxLen && val.length > rules.maxLen) {
      return res.status(400).json({ error: `Parameter "${key}" zu lang.` });
    }

    // Zahlenprüfung
    if (rules.numeric) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < rules.min || n > rules.max) {
        return res.status(400).json({ error: `Parameter "${key}" außerhalb des erlaubten Bereichs (${rules.min}–${rules.max}).` });
      }
      upstream.set(key, String(Math.floor(n)));
    } else {
      upstream.set(key, val);
    }
  }

  // Standard-Seitengröße setzen falls nicht angegeben
  if (!upstream.has('size')) upstream.set('size', '25');

  const url = `${BA_API_BASE}?${upstream.toString()}`;

  // AbortController für Timeout
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let baRes;
  try {
    baRes = await fetch(url, {
      headers: {
        'X-API-Key': BA_API_KEY,
        'Accept':    'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'BA-API Timeout nach 8 Sekunden.' });
    }
    return res.status(502).json({ error: 'BA-API nicht erreichbar.', detail: err.message });
  } finally {
    clearTimeout(timeoutId);
  }

  // Antwort der BA-API weiterleiten
  const body = await baRes.text();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(baRes.status).send(body);
};
