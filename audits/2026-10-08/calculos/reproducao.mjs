import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeRows, resolveDuplicates, analyze, stats, PARAMETERS, parameterKey } from '../../../src/core.js';
import { inferMapping } from '../../../src/mappings.js';

// Somente fixtures artificiais. Não executa rede, login nem modifica produção.
const main = await readFile(new URL('../../../src/main.js', import.meta.url), 'utf8');
const origin = Date.UTC(2026, 9, 1, 3);
const result = { head: '29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0', fixtures: 'artificiais; sem dados reais ou critérios normativos', findings: [], controls: [] };
const config = { parameter: 'CO2', start: origin, end: origin + 3600000, window: 'hour', outdoorCo2: null };
const rule = { id: 'controlled', name: 'Critério artificial de auditoria', parameter: 'CO2', unit: 'ppm', scope: 'escola', threshold: 700, window: 'hour', minCoverage: 1, measurementConfirmed: true, synthetic: false, source: 'Fixture artificial, sem valor normativo' };
const observation = (minute, value = 600, unit = 'ppm', id = `o-${minute}`) => ({ id, sourceId: 'fixture', rowNumber: minute + 2, sensorId: 'SCHOOL', timestamp: origin + minute * 60000, parameter: 'CO2', value, unit, originalUnit: unit, unitSource: 'file', unitConfirmed: true, included: true, flags: [] });
const dataset = (observations, changes = {}) => ({ id: 'school-case', sensorId: 'SCHOOL', name: 'Fixture escola', environment: 'escola', synthetic: false, offsetMinutes: -180, nominalIntervalSeconds: 60, units: { CO2: { unit: 'ppm', confirmed: true } }, observations, sources: [], issues: [], importedRows: 0, rejectedRows: 0, decisions: [], hasInputs: true, ...changes });
const fullHour = (value = 600, unit = 'ppm') => Array.from({ length: 60 }, (_, i) => observation(i, value, unit));
function record(id, expected, observed, details) { result.findings.push({ id, expected, observed, details }); }
function control(name, callback) { callback(); result.controls.push({ name, status: 'PASS' }); }

// CALC-01: A entrada da UI explicitamente usa ppm; a regra/dados podem usar ppb.
const ppbResult = analyze(dataset(fullHour(600000, 'ppb'), { units: { CO2: { unit: 'ppb', confirmed: true } } }), { ...config, outdoorCo2: 400 }, { ...rule, unit: 'ppb', threshold: 200000, requiresOutdoor: true });
assert.equal(ppbResult.bins[0].comparedValue, 599600);
assert.equal(ppbResult.bins[0].comparison, 'acima');
assert.notEqual(ppbResult.bins[0].comparedValue, 600000 - 400 * 1000);
record('CALC-01', { comparedValue: 200000, comparison: 'ate_referencia' }, { comparedValue: ppbResult.bins[0].comparedValue, comparison: ppbResult.bins[0].comparison, eligibility: ppbResult.bins[0].eligibility }, '600000 ppb internos menos 400 ppm externos; valor 200000 ppb e limiar artificial igual a 200000 ppb.');

// CALC-02: concentração externa negativa não é validada no núcleo.
const negative = analyze(dataset(fullHour()), { ...config, outdoorCo2: -200 }, { ...rule, requiresOutdoor: true });
assert.equal(negative.bins[0].eligibility, 'admissivel');
assert.equal(negative.bins[0].comparedValue, 800);
assert.equal(negative.bins[0].comparison, 'acima');
record('CALC-02', { eligibility: 'contexto externo invalido; impedir comparação' }, { eligibility: negative.bins[0].eligibility, comparedValue: negative.bins[0].comparedValue, comparison: negative.bins[0].comparison }, 'CO2 externo -200 ppm, interno 600 ppm, limiar artificial 700 ppm.');

function sourceFunction(start, end) { const begin = main.indexOf(start); const finish = main.indexOf(end, begin + start.length); assert.ok(begin >= 0 && finish > begin); return main.slice(begin, finish); }
// Executa os próprios handlers de produção com apenas renderização/worker simulados.
function harness(state, pending = null) {
  let captured;
  const context = { state, pending, PARAMETERS, parameterKey, inferMapping, crypto: globalThis.crypto, e: value => String(value ?? ''), n: value => String(value ?? ''), selectOptions: () => '', toast: () => {}, render: () => {}, compute: async () => {}, current: () => state.cases.find(c => c.id === state.activeId),
    dialog: (_title, _subtitle, body, _footer, submit) => { captured = { body, submit }; return { querySelector: () => ({ addEventListener() {} }) }; },
    execute: async (operation, payload) => { assert.equal(operation, 'normalize'); const normalized = normalizeRows(payload.rows, payload.mapping, payload.context, payload.sourceId); return { ...normalized, combined: resolveDuplicates([...(payload.previous || []), ...normalized.observations]) }; },
    setActive: async id => { state.activeId = id; },
  };
  vm.createContext(context);
  vm.runInContext(sourceFunction('function importDialog() {', 'function ruleDialog() {') + sourceFunction('function ruleDialog() {', 'function contextDialog() {'), context);
  return { context, captured: () => captured };
}
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, String(value)); return data; };
const commonForm = { target: 'school-case', name: 'Fixture escola', environment: 'escola', sensorId: 'SCHOOL', sensorLabel: 'Fixture escola', cadence: '60', offset: '-180', dateColumn: 'data_local', 'column-CO2': 'CO2', 'unit-CO2': 'ppm', unitsConfirmed: 'on' };
const sheetFor = rows => ({ name: 'Dados', headers: Object.keys(rows[0]), rows, mapping: inferMapping(Object.keys(rows[0])) });
const pendingFor = (rows, extra = {}) => ({ name: 'fixture.xlsx', size: 100, hash: '0'.repeat(64), bytes: new Uint8Array([1]), selectedSheet: 'Dados', sheets: [sheetFor(rows)], ...extra });

// CALC-03: ID único vindo do arquivo é descartado, inclusive ao adicionar a um caso.
const rawOtherSensor = [{ data_local: '2026-10-01 00:00', sensor_id: 'HOSPITAL', CO2: 900 }];
const school = dataset([observation(1, 600)]);
const importState = { cases: [school], activeId: school.id, rules: [], config: { ...config } };
const idHarness = harness(importState, pendingFor(rawOtherSensor));
idHarness.context.importDialog();
await idHarness.captured().submit(form(commonForm), { close() {} });
assert.equal(school.observations.length, 2);
assert.equal(school.observations.find(o => o.value === 900).sensorId, 'SCHOOL');
assert.equal(analyze(school, config).summary.mean, 750);
record('CALC-03', { action: 'bloquear divergência ou criar caso HOSPITAL', meanSchool: 600 }, { sensorOriginal: 'HOSPITAL', sensorNormalized: 'SCHOOL', meanSchool: 750, caseEnvironment: school.environment }, 'Handler real aceita a planilha com um único sensor HOSPITAL adicionada ao caso SCHOOL.');

// CALC-04: checkbox sintético ativo é ignorado ao selecionar caso real.
const realCase = dataset([observation(1, 600)]);
const syntheticState = { cases: [realCase], activeId: realCase.id, rules: [], config: { ...config } };
const syntheticHarness = harness(syntheticState, pendingFor([{ data_local: '2026-10-01 00:00', CO2: 900 }], { synthetic: true }));
syntheticHarness.context.importDialog();
assert.match(syntheticHarness.captured().body, /name="synthetic" checked/);
await syntheticHarness.captured().submit(form({ ...commonForm, synthetic: 'on' }), { close() {} });
assert.equal(realCase.synthetic, false);
assert.equal(realCase.sources.at(-1).synthetic, undefined);
assert.equal(realCase.observations.length, 2);
record('CALC-04', { action: 'impedir mistura ou marcar explicitamente dados mistos/sintéticos' }, { caseSynthetic: realCase.synthetic, sourceSynthetic: realCase.sources.at(-1).synthetic ?? 'campo ausente', observations: realCase.observations.length, meanShown: analyze(realCase, config).summary.mean }, 'Arquivo marcado sintético, checkbox ativo, destino caso real.');

// CALC-05: o contexto externo não pertence a uma regra/caso e se perde ao trocar caso.
const outdoorState = { cases: [dataset(fullHour()), dataset(fullHour(), { id: 'hospital-case', environment: 'hospital' })], activeId: 'school-case', history: [], rules: [], config: { ...config } };
const outdoorHarness = harness(outdoorState);
const referenceForm = outdoor => form({ name: `Fixture externa ${outdoor}`, parameter: 'CO2', unit: 'ppm', threshold: '150', coverage: '100', window: 'hour', scope: 'escola', source: 'Critério artificial de auditoria sem valor normativo', measurement: 'on', outdoor: 'on', outdoorValue: String(outdoor) });
outdoorHarness.context.ruleDialog();
assert.match(outdoorHarness.captured().body, /CO₂ externo documentado, ppm/);
await outdoorHarness.captured().submit(referenceForm(400), { close() {} });
const firstReference = outdoorState.rules[0];
assert.equal(outdoorState.config.outdoorCo2, 400);
assert.equal(firstReference.outdoorCo2, undefined);
const beforeAnotherRule = analyze(outdoorState.cases[0], outdoorState.config, firstReference).bins[0];
outdoorHarness.context.ruleDialog();
await outdoorHarness.captured().submit(referenceForm(500), { close() {} });
const afterAnotherRule = analyze(outdoorState.cases[0], outdoorState.config, firstReference).bins[0];
assert.equal(beforeAnotherRule.comparedValue, 200);
assert.equal(afterAnotherRule.comparedValue, 100);
assert.equal(beforeAnotherRule.comparison, 'acima');
assert.equal(afterAnotherRule.comparison, 'ate_referencia');
vm.runInContext(sourceFunction('async function setActive(id) {', 'const navigation ='), outdoorHarness.context);
await outdoorHarness.context.setActive('hospital-case');
await outdoorHarness.context.setActive('school-case');
assert.equal(outdoorState.config.outdoorCo2, null);
const afterSwitch = analyze(outdoorState.cases[0], outdoorState.config, firstReference).bins[0];
assert.equal(afterSwitch.eligibility, 'contexto_pendente');
record('CALC-05', { unchangedFirstReference: { comparedValue: 200, comparison: 'acima' }, externalAfterReturningToSchool: 400 }, { beforeAnotherRule: { comparedValue: beforeAnotherRule.comparedValue, comparison: beforeAnotherRule.comparison }, afterAnotherRule: { comparedValue: afterAnotherRule.comparedValue, comparison: afterAnotherRule.comparison }, externalAfterReturningToSchool: outdoorState.config.outdoorCo2, eligibilityAfterSwitch: afterSwitch.eligibility }, 'Handlers reais: cadastro A com externo400, cadastro B com externo500, aplicar regra A; alternar hospital e retornar escola.');
// O próprio handler do formulário também aceita o valor externo negativo.
outdoorHarness.context.ruleDialog();
const externalInput = outdoorHarness.captured().body.match(/<input[^>]*id="outdoor-co2"[^>]*>/)?.[0];
assert.ok(externalInput && !externalInput.includes('min='));
await outdoorHarness.captured().submit(referenceForm(-200), { close() {} });
assert.equal(outdoorState.config.outdoorCo2, -200);
result.findings.find(f => f.id === 'CALC-02').details += ' Confirmado também no handler real do formulário: sem min e sem rejeição do valor -200.';

// CALC-06: entradas finitas grandes podem gerar estatísticas não finitas.
const overflow = stats([1e308, 1e308]);
assert.equal(overflow.mean, Infinity);
assert.equal(overflow.sd, Infinity);
record('CALC-06', { mean: 1e308, sd: 0 }, { mean: 'Infinity', sd: 'Infinity', jsonExport: JSON.stringify(overflow) }, 'Robustez numérica de entradas artificiais extremas; não representa valores ambientais plausíveis.');

// Controles positivos sobre bases usuais, independentes dos testes existentes.
control('gabarito estatístico [10,20,30,40]', () => { const a = stats([10, 20, 30, 40]); assert.equal(a.mean, 25); assert.equal(a.median, 25); assert.equal(a.p95, 38.5); assert.equal(a.sd, Math.sqrt(125)); });
control('duplicatas idênticas conservadas e um único uso', () => { const a = resolveDuplicates([observation(0), observation(0, 600, 'ppm', 'second')]); assert.equal(a.length, 2); assert.equal(a.filter(o => o.included).length, 1); });
control('conflito exclui ambos; sensores distintos não conflitam', () => { assert.equal(resolveDuplicates([observation(0), observation(0, 900, 'ppm', 'second')]).filter(o => o.included).length, 0); assert.equal(resolveDuplicates([observation(0), { ...observation(0, 900, 'ppm', 'second'), sensorId: 'OTHER' }]).filter(o => o.included).length, 2); });
control('cobertura nominal 30 de60 e frequência observada60s', () => { const a = analyze(dataset(fullHour().slice(0, 30)), config, rule); assert.equal(a.quality.coverage, .5); assert.equal(a.quality.expected, 60); assert.equal(a.quality.occupied, 30); assert.equal(a.quality.observedInterval, 60); assert.equal(a.bins[0].eligibility, 'dados_insuficientes'); });
control('sobreamostragem de um slot não aumenta cobertura', () => { const a = analyze(dataset(Array.from({ length: 12 }, (_, i) => ({ ...observation(0, 600, 'ppm', `second-${i}`), timestamp: origin + i * 1000 }))), config); assert.equal(a.quality.coverage, 1 / 60); });
control('janela sem dados preserva lacuna e janelas parciais impedem comparação', () => { const a = analyze(dataset(fullHour()), { ...config, end: origin + 7200000 }, rule); assert.equal(a.bins[1].mean, null); assert.equal(a.bins[1].eligibility, 'sem_dados'); assert.equal(analyze(dataset(fullHour()), { ...config, start: origin + 60000 }, rule).bins[0].eligibility, 'janela_parcial'); });
control('unidades incompatíveis excluídas e condições pendentes impedem referência', () => { const a = analyze(dataset([observation(0, 600), observation(1, 900, 'ppb')]), config, rule); assert.equal(a.summary.mean, 600); assert.equal(a.quality.excluded, 1); assert.equal(a.bins[0].eligibility, 'unidade_pendente'); assert.equal(analyze(dataset(fullHour()), config, { ...rule, measurementConfirmed: false }).bins[0].eligibility, 'metodo_pendente'); assert.equal(analyze(dataset(fullHour()), config, { ...rule, scope: 'hospital' }).bins[0].eligibility, 'fora_escopo'); });
control('fração acima considera apenas janelas elegíveis', () => { const a = analyze(dataset([...fullHour(800), ...Array.from({ length: 10 }, (_, i) => observation(60 + i, 500))]), { ...config, end: origin + 7200000 }, rule); assert.equal(a.eligibility.eligible, 1); assert.equal(a.eligibility.above, 1); assert.equal(a.eligibility.fractionAbove, 1); });
control('perfil e histograma têm a mesma base e preservam contagem', () => { const a = analyze(dataset(fullHour()), config); assert.equal(a.profile.reduce((n, p) => n + p.n, 0), 60); assert.equal(a.histogram.reduce((n, h) => n + h.n, 0), 60); assert.equal(a.profile[0].mean, 600); });

await writeFile(new URL('./resultados.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ findingsConfirmed: result.findings.length, positiveControlsPassed: result.controls.length, file: 'output/auditoria-2026-10-08/calculos/resultados.json' }, null, 2));
