# Tests

Alle Tests ausführen (Node 22, keine Installation nötig):

    node tests/run.js

Optional gegen ein anderes Deployment: `BASE_URL=https://... node tests/run.js`

Arten (Präfix im Testnamen):
- **[lokal]**: echte App-Funktionen (aus `index.html` geladen) mit Daten aus `fixtures/ba-sample.json`.
- **[simuliert]**: Proxy mit gemocktem BA-Aufruf; UI in Chromium (Playwright) mit nachgestellter BA-Antwort.
  Ohne Playwright: NICHT TESTBAR.
- **[live]**: echte Aufrufe gegen das Vercel-Deployment. Bei Login-Schutz/Netzfehler: NICHT TESTBAR.

Status: PASS, FAIL, NICHT TESTBAR, OFFEN (bekannte, noch nicht umgesetzte Punkte; `todo` im Test,
beim Umsetzen das `{ todo: ... }` entfernen).

`fixtures/ba-sample.json` ist eine auf 3 Stellen und 5 Facetten gekürzte BA-Antwort (Umlaute korrigiert).
