#!/usr/bin/env node
// Alle Tests ausführen:  node tests/run.js
// Optional: BASE_URL=https://deine-vorschau.vercel.app node tests/run.js
const { spawnSync } = require('child_process');
const path = require('path');
const env = { ...process.env };
if (env.HTTPS_PROXY && !env.NODE_USE_ENV_PROXY) env.NODE_USE_ENV_PROXY = '1'; // Node-fetch soll den Proxy nutzen
const r = spawnSync(process.execPath, ['--test', `--test-reporter=${path.join(__dirname, 'reporter.js')}`,
  ...require('fs').readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f))],
  { stdio: 'inherit', env });
process.exit(r.status ?? 1);
