import test from 'node:test';
import assert from 'node:assert/strict';
import { IseqTrace, formatIseqReport } from '../src/iseq-diagnostics.js';

test('diagnóstico usa vocabulário fechado e não conserva credenciais, datas, IDs ou respostas', () => {
  let time = 0; const trace = new IseqTrace('login', () => time);
  const privateFields = { username: 'SEGREDO-USER', password: 'SEGREDO-PASS', token: 'SEGREDO-TOKEN', message: 'SEGREDO-MESSAGE', url: 'SEGREDO-URL', tasks: [{ id: 'SEGREDO-TASK' }], rows: [{ CO2: 'SEGREDO-ROW' }], date: 'SEGREDO-DATE' };
  trace.observe({ ...privateFields, type: 'stage', stage: 'health', state: 'start' });
  time = 12; trace.observe({ ...privateFields, type: 'request', stage: 'health', durationMs: 12, decodeMs: 2, status: 200, responseBytes: 30, outcome: 'success' });
  trace.observe({ ...privateFields, type: 'stage', stage: 'health', state: 'end', outcome: 'success', durationMs: 12 });
  trace.observe({ ...privateFields, type: 'tasks', total: 9, completed: 3, cached: 3, downloads: 6, workers: 2 });
  trace.observe({ type: 'stage', stage: 'SEGREDO-STAGE', state: 'start' });
  trace.observe({ type: 'download', rows: 288, pages: 1, id: 'SEGREDO-ID' });
  const report = trace.finish('success'), serialized = JSON.stringify(report), text = formatIseqReport(report);
  assert.ok(!serialized.includes('SEGREDO')); assert.ok(!text.includes('SEGREDO'));
  assert.equal(report.phases.length, 1); assert.equal(report.phases[0].requests, 1); assert.equal(report.phases[0].responseBytes, 30);
  assert.equal(report.transfer.rows, 288); assert.match(text, /Reutilizadas: 3/); assert.match(text, /Consultas novas: 6/);
});

test('cancelamento encerra etapa ativa e eventos tardios não reescrevem o diagnóstico', () => {
  let time = 0; const trace = new IseqTrace('login', () => time);
  trace.observe({ type: 'stage', stage: 'health', state: 'start' });
  time = 90; const saved = trace.finish('cancelled');
  assert.equal(saved.phases[0].durationMs, 90); assert.equal(saved.phases[0].outcome, 'cancelled');
  time = 400; trace.observe({ type: 'stage', stage: 'login', state: 'start' });
  trace.observe({ type: 'request', stage: 'health', durationMs: 400, status: 200 });
  assert.deepEqual(trace.snapshot(), saved);
});

test('snapshot é independente, valores inválidos são rejeitados e não viram texto do diagnóstico', () => {
  const trace = new IseqTrace('history', () => 0);
  trace.observe({ type: 'tasks', total: 9, cached: 2, downloads: 'SEGREDO', workers: NaN });
  trace.observe({ type: 'request', stage: 'history', durationMs: Infinity, responseBytes: -1, status: 'SEGREDO', decodeMs: NaN });
  const changed = trace.snapshot(); changed.tasks.cached = 100; changed.phases[0].status = 'SEGREDO';
  const result = trace.finish('error');
  assert.deepEqual(result.tasks, { total: 9, cached: 2 }); assert.equal(result.phases[0].status, null);
  assert.ok(!formatIseqReport(result).includes('SEGREDO'));
});
