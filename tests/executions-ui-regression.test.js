import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecution, executionDataset, snapshotCase, validateCaseNature, commitCaseChange, validateOutdoorContext } from '../src/executions.js';

const fixture = () => ({ id: 'case', name: 'Original', sensorId: 'SCHOOL', sensorLabel: 'Escola', environment: 'escola', offsetMinutes: -180, nominalIntervalSeconds: 60, synthetic: false, units: { CO2: { unit: 'ppm', confirmed: true } }, sources: [{ id: 'source', hash: 'hash', bytes: new Uint8Array([1]) }], observations: [{ id: 'o', value: 600, flags: [] }], issues: [], decisions: [], hasInputs: true });
test('ARQ-03: execução guarda contexto e decisão imutáveis por revisão', async () => {
  const dataset = fixture(), run = createExecution(dataset, { parameter: 'CO2' });
  assert.equal(snapshotCase(dataset), run.datasetSnapshot);
  let changed;
  await commitCaseChange(dataset, next => { next.name = 'Atual'; next.nominalIntervalSeconds = 300; next.observations[0].value = 700; next.decisions.push({ reason: 'nova' }); }, async () => ({}), next => { changed = next; });
  const old = executionDataset(changed, run);
  assert.equal(old.name, 'Original'); assert.equal(old.nominalIntervalSeconds, 60);
  assert.equal(old.observations[0].value, 600); assert.equal(old.decisions.length, 0);
  assert.deepEqual(old.sources[0].bytes, dataset.sources[0].bytes);
});
test('UI-01: falha do cálculo não modifica contexto nem decisões', async () => {
  const dataset = fixture(); let committed = false;
  await assert.rejects(commitCaseChange(dataset, next => { next.name = 'Rejeitado'; next.decisions.push({ reason: 'teste' }); }, async () => { throw new Error('falha controlada'); }, () => { committed = true; }), /falha controlada/);
  assert.equal(dataset.name, 'Original'); assert.equal(dataset.decisions.length, 0); assert.equal(committed, false);
});
test('UI-01: compartilhável rejeita edição antes de mutar', async () => {
  const dataset = { ...fixture(), hasInputs: false }; let mutated = false;
  await assert.rejects(commitCaseChange(dataset, () => { mutated = true; }, async () => ({}), () => {}), /Recupere as entradas/);
  assert.equal(mutated, false);
});
test('CALC-04: natureza sintética deve coincidir com o destino', () => {
  assert.throws(() => validateCaseNature(fixture(), true), /não podem ser combinados/);
  assert.throws(() => validateCaseNature({ ...fixture(), synthetic: true }, false), /não podem ser combinados/);
  assert.doesNotThrow(() => validateCaseNature(fixture(), false));
});
test('CALC-02/05: contexto externo tem domínio, unidade e fonte próprios', () => {
  assert.throws(() => validateOutdoorContext({ value: -1, unit: 'ppm', source: 'teste' }), /não negativo/);
  assert.throws(() => validateOutdoorContext({ value: 400, unit: 'ppm', source: '' }), /fonte/);
  assert.throws(() => validateOutdoorContext({ value: 400, unit: 'índice', source: 'teste' }), /unidade/);
  assert.equal(validateOutdoorContext({ value: 400, unit: 'ppm', source: 'Externo em 01/10' }).value, 400);
});
test('Legado sem snapshot é explicitamente identificado', () => {
  assert.equal(executionDataset(fixture(), { id: 'old' }).legacyContext, true);
});
