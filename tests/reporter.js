// Mini-Reporter: fasst Testergebnisse als Tabelle PASS / FAIL / NICHT TESTBAR / OFFEN zusammen,
// getrennt nach Art: [lokal], [simuliert], [live].
module.exports = async function* (source) {
  const rows = [];
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const d = ev.data;
    if (d.nesting > 0 || /\.test\.js$/.test(d.name)) continue; // nur einzelne Tests
    const kind = (d.name.match(/^\[(\w+)\]/) || [, 'sonstige'])[1];
    let status;
    if (d.skip) status = 'NICHT TESTBAR';
    else if (d.todo) status = ev.type === 'test:fail' ? 'OFFEN' : 'OFFEN-ERLEDIGT';
    else status = ev.type === 'test:pass' ? 'PASS' : 'FAIL';
    const err = ev.type === 'test:fail' && !d.todo ? (d.details?.error?.cause?.message || d.details?.error?.message || '') : '';
    const note = d.skip && typeof d.skip === 'string' ? d.skip : (d.todo && typeof d.todo === 'string' ? d.todo : '');
    rows.push({ kind, name: d.name.replace(/^\[\w+\]\s*/, ''), status, note, err });
  }
  const order = ['lokal', 'simuliert', 'live'];
  rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  let out = '\n';
  for (const r of rows) {
    out += `${r.status.padEnd(14)} ${('[' + r.kind + ']').padEnd(12)} ${r.name}${r.note ? '  (' + r.note + ')' : ''}\n`;
    if (r.err) out += `${' '.repeat(28)}-> ${r.err.split('\n')[0]}\n`;
  }
  out += '\nZusammenfassung (Art: PASS / FAIL / NICHT TESTBAR / OFFEN)\n';
  for (const k of order) {
    const rs = rows.filter(r => r.kind === k); if (!rs.length) continue;
    const c = s => rs.filter(r => r.status === s || (s === 'OFFEN' && r.status === 'OFFEN-ERLEDIGT')).length;
    out += `  ${k.padEnd(10)} ${c('PASS')} / ${c('FAIL')} / ${c('NICHT TESTBAR')} / ${c('OFFEN')}\n`;
  }
  const fails = rows.filter(r => r.status === 'FAIL').length;
  out += fails ? `\nERGEBNIS: FEHLER (${fails} Test(s) fehlgeschlagen)\n` : '\nERGEBNIS: OK (keine fehlgeschlagenen Tests)\n';
  yield out;
};
