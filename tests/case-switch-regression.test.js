import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { analyze } from '../src/core.js';
import { createExecution } from '../src/executions.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('async function setActive(id) {');
const finish = main.indexOf('async function updateCase(', start);
assert.ok(start >= 0 && finish > start);
const switchSource = main.slice(start, finish);
const origin = Date.UTC(2026, 9, 1, 3);
const config = { parameter: 'CO2', start: origin, end: origin + 3600000, window: 'hour', ruleId: '' };
const fixture = (id, sensorId, environment, value) => ({
  id, name: id, sensorId, sensorLabel: sensorId, environment, offsetMinutes: -180,
  nominalIntervalSeconds: 60, synthetic: true, units: { CO2: { unit: 'ppm', confirmed: true } },
  sources: [], issues: [], decisions: [], hasInputs: true,
  observations: [{ id: `${id}-o`, sourceId: 'fixture', rowNumber: 2, sensorId, timestamp: origin, parameter: 'CO2', value, unit: 'ppm', included: true, unitConfirmed: true, flags: [] }],
});

function harness(calculate) {
  const school = fixture('school', 'SCHOOL', 'escola', 600);
  const hospital = fixture('hospital', 'HOSPITAL', 'hospital', 900);
  hospital.outdoorContext = { value: 400, unit: 'ppm', source: 'Fixture externa artificial' };
  const original = createExecution(school, analyze(school, config));
  const state = { cases: [school, hospital], activeId: school.id, config, run: original, history: [original], qualityPage: 2, filterError: 'Erro anterior', archived: true };
  const remembered = [];
  const context = {
    state, requestId: 0, calculate,
    defaultConfig: dataset => ({ ...config, outdoor: dataset.outdoorContext || null }),
    rememberInputs: dataset => remembered.push(dataset.id), toast() {},
    recordRun(dataset, nextConfig, analysis) {
      state.config = nextConfig; state.run = createExecution(dataset, analysis);
      state.history.push(state.run); state.archived = false;
    },
  };
  vm.createContext(context); vm.runInContext(switchSource, context);
  return { context, state, original, school, hospital, remembered };
}

test('troca de caso com falha do cálculo preserva caso, configuração e execução selecionados', async () => {
  const h = harness(async () => { throw new Error('Falha controlada do worker'); });
  const before = { ...h.state, history: [...h.state.history] };
  await assert.rejects(h.context.setActive('hospital'), /Falha controlada/);
  assert.deepEqual(h.state, before); assert.deepEqual(h.remembered, []);
  assert.equal(h.state.run.analysis.summary.mean, 600);
});

test('troca de caso válida confirma contexto e nova execução após o cálculo', async () => {
  const h = harness(async (dataset, nextConfig) => analyze(dataset, nextConfig));
  assert.equal(await h.context.setActive('hospital'), true);
  assert.equal(h.state.activeId, 'hospital'); assert.equal(h.state.run.datasetId, 'hospital');
  assert.equal(h.state.run.analysis.summary.mean, 900);
  assert.equal(h.state.config.outdoor.value, 400);
  assert.equal(h.state.run.datasetSnapshot.environment, 'hospital');
  assert.equal(h.state.history[0], h.original); assert.equal(h.state.history.length, 2);
  assert.equal(h.state.archived, false); assert.equal(h.state.qualityPage, 0); assert.equal(h.state.filterError, '');
  assert.deepEqual(h.remembered, ['hospital']);
});

test('resposta de troca invalidada pelo requestId não substitui o estado selecionado', async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }));
  const before = { ...h.state, history: [...h.state.history] };
  const switching = h.context.setActive('hospital');
  h.context.requestId++;
  resolve(analyze(h.hospital, { ...config, outdoor: h.hospital.outdoorContext }));
  assert.equal(await switching, false);
  assert.deepEqual(h.state, before); assert.deepEqual(h.remembered, []);
});

test('troca para caso compartilhável conserva resultados arquivados sem calcular', async () => {
  const h = harness(async () => { throw new Error('Não deve calcular sem entradas'); });
  const saved = createExecution(h.hospital, analyze(h.hospital, config));
  h.hospital.observations = []; h.hospital.hasInputs = false; h.state.history.push(saved);
  assert.equal(await h.context.setActive('hospital'), true);
  assert.equal(h.state.activeId, 'hospital'); assert.equal(h.state.run, saved);
  assert.equal(h.state.config, saved.analysis.config); assert.equal(h.state.archived, true);
  assert.equal(h.state.history.length, 2); assert.deepEqual(h.remembered, []);
});
