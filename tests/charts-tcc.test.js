import test from 'node:test';
import assert from 'node:assert/strict';
import { read, utils } from 'xlsx';
import { analyze, normalizeRows, sha256 } from '../src/core.js';
import { createExecution } from '../src/executions.js';
import { rangeRuns, weekdayBoxes } from '../src/chart-data.js';
import { createPackage, openPackage } from '../src/packages.js';
import { exportWorkbook, pdfChartGeometry } from '../src/exports.js';

async function fixture() {
  const bytes = new TextEncoder().encode('Somente dados sintéticos para teste de gráficos'), hash = await sha256(bytes);
  const rows = [1, 3, 9].map((value, i) => ({ date: `2026-10-01 00:0${i}`, value }));
  rows.push({ date: '2026-10-02 00:00', value: 100 }, { date: '2026-10-05 00:00', value: 50 });
  const units = { 'PM2.5': { unit: 'µg/m³', confirmed: true } };
  const normalized = normalizeRows(rows, { format: 'wide', date: 'date', columns: { 'PM2.5': 'value' } }, { sensorId: 'SYNTHETIC', offsetMinutes: -180, units }, 'synthetic-source');
  const observations = normalized.observations;
  observations.push({ ...observations[0], id: 'excluded', value: 9000, included: false }, { ...observations[0], id: 'other-unit', unit: 'mg/m³', value: 8000 }, { ...observations[0], id: 'other-parameter', parameter: 'CO2', unit: 'ppm', value: 7000 });
  const dataset = { id: 'synthetic-case', name: 'Controle sintético de gráficos', sensorId: 'SYNTHETIC', sensorLabel: 'Sintético', environment: 'escola', synthetic: true, offsetMinutes: -180, nominalIntervalSeconds: 60, units, observations, issues: [], decisions: [], sources: [{ id: 'synthetic-source', hash, bytes, size: bytes.byteLength, rows: rows.length, name: 'sintetico.txt', origin: 'synthetic' }], hasInputs: true };
  const config = { parameter: 'PM2.5', window: 'day', start: Date.UTC(2026, 9, 1, 3), end: Date.UTC(2026, 9, 6, 3) };
  return { dataset, run: createExecution(dataset, analyze(dataset, config)) };
}

test('perfil e boxplot usam leituras incluídas e quartis de gabarito independente', async () => {
  const { run } = await fixture(), a = run.analysis;
  assert.deepEqual(a.profile[0], { hour: 0, n: 5, mean: 32.6, median: 9, min: 1, max: 100 });
  assert.deepEqual(a.profile[1], { hour: 1, n: 0, mean: null, median: null, min: null, max: null });
  assert.deepEqual(a.weekdays[3], { day: 3, n: 3, min: 1, q1: 2, median: 3, q3: 6, max: 9 });
  assert.equal(a.weekdays[0].min, 50); assert.equal(a.weekdays[4].max, 100);
  assert.deepEqual(weekdayBoxes(a.weekdays)[3], [1, 2, 3, 6, 9]);
  assert.deepEqual(weekdayBoxes(a.weekdays)[1], [null, null, null, null, null]);
  assert.equal(a.weekdays.reduce((sum, p) => sum + p.n, 0), a.summary.n);
});

test('hora e dia da semana respeitam o deslocamento local na virada de data UTC', async () => {
  const { dataset, run } = await fixture();
  dataset.observations = [{ ...dataset.observations[0], timestamp: Date.UTC(2026, 9, 2, 2, 30), value: 7 }];
  const a = analyze(dataset, run.analysis.config);
  assert.equal(a.profile[23].mean, 7); assert.equal(a.weekdays[3].median, 7);
  assert.equal(a.weekdays[4].n, 0);
});

test('faixa preserva valores negativos, lacunas e pontos isolados sem partir de zero', () => {
  const rows = [{ n: 2, min: -20, max: -10 }, { n: 1, min: -3, max: -3 }, { n: 0, min: null, max: null }, { n: 2, min: 5, max: 131 }];
  assert.deepEqual(rangeRuns(rows), [[{ index: 0, min: -20, max: -10 }, { index: 1, min: -3, max: -3 }], [{ index: 3, min: 5, max: 131 }]]);
  const geometry = pdfChartGeometry(rows.map(row => ({ ...row, mean: row.n ? row.min : null })));
  assert.ok(geometry.min <= -20 && geometry.max >= 131);
  assert.equal(geometry.rangeSegments.length, 1); assert.equal(geometry.ranges.length, 3);
  assert.ok(geometry.ranges.every(p => Number.isFinite(p.top) && p.top <= p.bottom));
});

test('Excel e pacotes completo/compartilhável conservam extremos, mediana e quartis', async () => {
  const { dataset, run } = await fixture();
  const wb = read(await exportWorkbook(dataset, run).arrayBuffer(), { type: 'array' });
  const profile = utils.sheet_to_json(wb.Sheets['Perfil horario']), weekdays = utils.sheet_to_json(wb.Sheets['Dias da semana']);
  assert.equal(profile[0].max, 100); assert.equal(profile[0].median, 9); assert.equal(weekdays[3].q3, 6);
  for (const complete of [true, false]) {
    const saved = await createPackage(dataset, run, [run], complete), opened = await openPackage(new File([saved], 'sintetico.aircase'));
    assert.deepEqual(opened.run.analysis.profile, run.analysis.profile);
    assert.deepEqual(opened.run.analysis.weekdays, run.analysis.weekdays);
    assert.deepEqual(opened.history[0].analysis.weekdays, run.analysis.weekdays);
    if (!complete) assert.deepEqual(opened.dataset.observations, []);
  }
});

test('pacote legado conserva somente a média arquivada; quartis contraditórios são recusados', async () => {
  const { dataset, run } = await fixture(), legacy = structuredClone(run);
  delete legacy.analysis.weekdays;
  legacy.analysis.profile = legacy.analysis.profile.map(({ hour, n, mean }) => ({ hour, n, mean }));
  legacy.analysis.versions.software = '0.1.4';
  const saved = await createPackage(dataset, legacy, [legacy], false), opened = await openPackage(new File([saved], 'legado.aircase'));
  assert.equal(opened.run.analysis.weekdays, undefined); assert.equal(opened.run.analysis.profile[0].min, undefined);
  run.analysis.weekdays[3].q1 = 999;
  await assert.rejects(createPackage(dataset, run, [run], false), /quartis/);
  run.analysis.weekdays[3].q1 = 2; run.analysis.profile[0].min = 101;
  await assert.rejects(createPackage(dataset, run, [run], false), /perfil/);
});
