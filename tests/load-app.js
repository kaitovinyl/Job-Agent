// Lädt das Inline-Skript aus index.html in eine Node-vm (ohne Browser) und gibt
// die internen Funktionen/Zustände für Tests zurück. Die App selbst wird nicht verändert.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function stubElement() {
  const el = {
    value: '', checked: false, innerHTML: '', textContent: '', className: '', hidden: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, setAttribute() {}, scrollIntoView() {}, focus() {}, closest: () => null,
    querySelector: () => stubElement(), querySelectorAll: () => [],
  };
  return el;
}

function loadApp({ fetchImpl } = {}) {
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const code = scripts.find(s => s.includes('function mapBAJobToLocalFormat'));
  if (!code) throw new Error('Haupt-Skript in index.html nicht gefunden');

  const els = {};
  const document = {
    getElementById: id => (els[id] ||= stubElement()),
    querySelector: () => stubElement(),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const ctx = {
    document, window: { addEventListener() {} }, navigator: {}, console: { log() {}, warn() {}, error() {} },
    URLSearchParams, AbortController, setTimeout, clearTimeout, Promise,
    alert: () => {}, fetch: fetchImpl || (async () => { throw new Error('fetch nicht gemockt'); }),
  };
  vm.createContext(ctx);
  vm.runInContext(code + `
;globalThis.__app = { state, DEFAULTS, JOBS, filterJobs, mapBAJobToLocalFormat, buildTags, fetchBAJobs,
  setActive(j) { activeJobs = j; } };`, ctx);
  return ctx.__app;
}

const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ba-sample.json'), 'utf8'));

module.exports = { loadApp, fixture };
