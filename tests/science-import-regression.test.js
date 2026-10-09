import test from 'node:test';
import assert from 'node:assert/strict';
import { utils, write } from 'xlsx';
import { readInput, validateSelectedSheet } from '../src/importer.js';
import { normalizeRows, analyze, stats, parseTimestamp, convertCo2, localIso } from '../src/core.js';

// Artificial fixtures and arithmetic/unit gabaritos, never environmental rules.
const origin = Date.UTC(2026, 9, 1, 3);
const context = { sensorId: 'SCHOOL', offsetMinutes: -180, units: { CO2: { unit: 'ppm', confirmed: true } } };
const config = { parameter: 'CO2', window: 'hour', start: origin, end: origin + 3600000 };
const rule = { id: 'fixture', source: 'Critério artificial de regressão, sem valor normativo', parameter: 'CO2', unit: 'ppm', threshold: 200, minCoverage: 1, measurementConfirmed: true, requiresOutdoor: true, scope: 'escola', window: 'hour' };
const observation = (minute, value, unit = 'ppm') => ({ id: `fixture-${minute}`, sensorId: 'SCHOOL', timestamp: origin + minute * 60000, parameter: 'CO2', value, unit, included: true, unitConfirmed: true, flags: [] });
const dataset = (values, unit = 'ppm') => ({ id: 'school-case', sensorId: 'SCHOOL', environment: 'escola', synthetic: true, offsetMinutes: -180, nominalIntervalSeconds: 60, units: { CO2: { unit, confirmed: true } }, observations: values.map((value, minute) => observation(minute, value, unit)) });
function workbookFile(sheets, date1904 = false) {
  const workbook = utils.book_new();
  for (const [name, contents] of Object.entries(sheets)) utils.book_append_sheet(workbook, Array.isArray(contents) ? utils.aoa_to_sheet(contents) : contents, name);
  workbook.Workbook = { WBProps: { date1904 } };
  return new File([write(workbook, { type: 'array', bookType: 'xlsx' })], 'regressao-sintetica.xlsx');
}
async function normalizedFile(file, targetContext = context) {
  const input = await readInput(file);
  const sheet = validateSelectedSheet(input.sheets.find(item => item.name === input.selectedSheet));
  return { input, sheet, normalized: normalizeRows(sheet.rows, sheet.mapping, targetContext, 'fixture-source') };
}
function assertFiniteDeep(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `Não finito: ${value}`);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteDeep);
}

test('ARQ-01: CSV preserva decimal brasileiro do arquivo até a média', async () => {
  const csv = 'data_local;CO2\r\n2026-10-01 00:00;"600,5"\r\n2026-10-01 00:01;"700,5"\r\n';
  const { sheet, normalized } = await normalizedFile(new File([csv], 'br.csv'));
  assert.equal(sheet.rows[0].CO2, '600,5');
  assert.deepEqual(normalized.observations.map(item => item.originalValue), ['600,5', '700,5']);
  assert.deepEqual(normalized.observations.map(item => item.value), [600.5, 700.5]);
  assert.equal(analyze({ ...dataset([]), observations: normalized.observations }, config).summary.mean, 650.5);
});
test('ARQ-01: CSV conserva dd/MM e originalTime sem interpretar como MM/dd', async () => {
  const { normalized } = await normalizedFile(new File(['data_local;CO2\r\n01/10/2026 00:00;600\r\n02/10/2026 00:00;700\r\n'], 'datas.csv'));
  assert.deepEqual(normalized.observations.map(item => localIso(item.timestamp, -180)), ['2026-10-01T00:00:00', '2026-10-02T00:00:00']);
  assert.equal(normalized.observations[0].originalTime, '01/10/2026 00:00');
});
test('ARQ-01: CSV com aspas, delimitador dentro do campo e fórmula preserva texto', async () => {
  const { sheet, normalized } = await normalizedFile(new File(['data_local;CO2;nota\r\n2026-10-01 00:00;=600+1;"texto;com;delimitador"\r\n'], 'formula.csv'));
  assert.equal(sheet.rows[0].nota, 'texto;com;delimitador');
  assert.equal(normalized.observations.length, 0);
  assert.equal(normalized.issues[0].detail, '=600+1');
});
test('ARQ-01: CSV internacional continua preservando números ISO', async () => {
  const { normalized } = await normalizedFile(new File(['data_local,CO2\n2026-10-01 00:00,600.5\n2026-10-01 00:01,700.5\n'], 'iso.csv'));
  assert.equal(stats(normalized.observations.map(item => item.value)).mean, 650.5);
  assert.equal(normalized.observations[0].timestamp, origin);
});

test('ARQ-02: Excel 1904 mantém serial e calendário e chega ao gabarito UTC-3', async () => {
  // Independent calendar arithmetic: 44834 days since 01/01/1904.
  const serial = (Date.UTC(2026, 9, 1) - Date.UTC(1904, 0, 1)) / 86400000;
  assert.equal(serial, 44834);
  const { input, sheet, normalized } = await normalizedFile(workbookFile({ 'Dados brutos': [['data_local', 'CO2'], [serial, 600]] }, true));
  assert.equal(input.date1904, true);
  assert.equal(sheet.date1904, true);
  assert.equal(normalized.observations[0].timestamp, origin);
  assert.equal(normalized.observations[0].originalSerial, 44834);
  assert.equal(normalized.observations[0].originalDateSystem, '1904');
  // The epoch of the workbook is source metadata, not an unrelated case default.
  assert.equal(normalizeRows(sheet.rows, sheet.mapping, { ...context, date1904: false }, 'fixture').observations[0].timestamp, origin);
});
test('ARQ-02: Excel 1900 moderno continua correto e não aceita o dia fictício', () => {
  assert.equal(parseTimestamp(46296, -180, { date1904: false }), origin);
  assert.equal(parseTimestamp(1, 0), Date.UTC(1900, 0, 1));
  assert.equal(parseTimestamp(60, 0), null);
  assert.equal(parseTimestamp(0, 0, { date1904: true }), Date.UTC(1904, 0, 1));
});
test('ARQ-02: hora fracionária de serial 1904 mantém minutos e segundos', () => {
  assert.equal(parseTimestamp(44834 + 1 / 24 + 1 / 1440 + 1 / 86400, -180, { date1904: true }), origin + 3661000);
});

test('ARQ-07: aba preferida vazia não bloqueia a aba histórica utilizável', async () => {
  const input = await readInput(workbookFile({ 'Dados brutos': [['data_local', 'CO2']], Historico: [['data_local', 'CO2'], ['2026-10-01 00:00', 600]] }));
  assert.equal(input.selectedSheet, 'Historico');
  assert.equal(input.sheets.length, 2);
  assert.throws(() => validateSelectedSheet(input.sheets[0]), /não contém linhas/);
  assert.doesNotThrow(() => validateSelectedSheet(input.sheets[1]));
});
test('ARQ-07: resumo com sensores misturados não bloqueia a aba do sensor escolhido', async () => {
  const input = await readInput(workbookFile({ 'Dados brutos': [['data_local', 'sensor_id', 'CO2'], ['2026-10-01 00:00', 'SCHOOL', 600]], Resumo: [['data_local', 'sensor_id', 'CO2'], ['2026-10-01 00:00', 'SCHOOL', 600], ['2026-10-01 00:00', 'HOSPITAL', 900]] }));
  assert.equal(input.selectedSheet, 'Dados brutos');
  assert.equal(input.sheets[0].originalSensorId, 'SCHOOL');
  assert.throws(() => validateSelectedSheet(input.sheets[1]), /vários sensores/);
});
test('ARQ-07: cabeçalhos duplicados ficam como erro da respectiva aba', async () => {
  const input = await readInput(workbookFile({ Duplicada: [['data_local', 'CO2', 'CO2'], ['2026-10-01 00:00', 600, 700]], Historico: [['data_local', 'CO2'], ['2026-10-01 00:00', 600]] }));
  assert.equal(input.selectedSheet, 'Historico');
  assert.throws(() => validateSelectedSheet(input.sheets[0]), /cabeçalhos duplicados/);
});
test('ARQ-07: planilha com todas abas inválidas dá erro fundamentado', async () => {
  await assert.rejects(() => readInput(workbookFile({ Vazia: [['data_local', 'CO2']] })), /Nenhuma aba utilizável.*não contém linhas/);
});
test('marca sintética global continua presente mesmo numa aba não importável', async () => {
  const invalidSummary = utils.aoa_to_sheet([['DADOS INTEGRALMENTE SINTÉTICOS']]);
  invalidSummary['!ref'] = 'A1:A250002';
  const input = await readInput(workbookFile({ 'Resumo extenso': invalidSummary, Historico: [['data_local', 'CO2'], ['2026-10-01 00:00', 600]] }));
  assert.equal(input.synthetic, true);
  assert.equal(input.selectedSheet, 'Historico');
  assert.throws(() => validateSelectedSheet(input.sheets[0]), /250 mil linhas/);
});
test('origem de linha real é mantida quando os cabeçalhos começam após a primeira linha', async () => {
  const sheet = utils.aoa_to_sheet([['data_local', 'CO2'], ['2026-10-01 00:00', 600]], { origin: 'A4' });
  sheet['!ref'] = 'A4:B5';
  const { normalized } = await normalizedFile(workbookFile({ Historico: sheet }));
  assert.equal(normalized.observations[0].rowNumber, 5);
});

test('CALC-01: ppm externo é convertido para ppb antes da subtração', () => {
  const result = analyze(dataset(Array(60).fill(600000), 'ppb'), { ...config, outdoor: { value: 400, unit: 'ppm', source: 'Fixture externa' } }, { ...rule, unit: 'ppb', threshold: 200000 });
  assert.equal(result.bins[0].comparedValue, 200000);
  assert.equal(result.bins[0].comparison, 'ate_referencia');
});
test('CALC-01: contexto legado ppm não é subtraído como se fosse ppb', () => {
  const result = analyze(dataset(Array(60).fill(600000), 'ppb'), { ...config, outdoorCo2: 400 }, { ...rule, unit: 'ppb', threshold: 200000 });
  assert.equal(result.bins[0].comparedValue, 200000);
});
test('CALC-01: ppb/ppm/percentual são convertidos explicitamente ou bloqueados', () => {
  assert.equal(convertCo2(400000, 'ppb', 'ppm'), 400);
  assert.equal(convertCo2(.04, '%', 'ppm'), 400);
  assert.equal(convertCo2(400, 'ppm', '%'), .04);
  assert.equal(convertCo2(400, 'mg/m³', 'ppm'), null);
  const result = analyze(dataset(Array(60).fill(600)), { ...config, outdoor: { value: 400, unit: 'mg/m³', source: 'Fixture' } }, rule);
  assert.equal(result.bins[0].eligibility, 'contexto_pendente');
  assert.equal(result.bins[0].comparison, null);
});
test('CALC-02: contexto externo negativo e valores não finitos impedem comparação', () => {
  for (const value of [-200, Infinity, NaN]) {
    const result = analyze(dataset(Array(60).fill(600)), { ...config, outdoor: { value, unit: 'ppm', source: 'Fixture externa' } }, rule);
    assert.equal(result.bins[0].eligibility, 'contexto_pendente');
    assert.equal(result.bins[0].comparison, null);
  }
  assert.equal(analyze(dataset(Array(60).fill(600)), { ...config, outdoorCo2: -200 }, rule).bins[0].eligibility, 'contexto_pendente');
});
test('CALC-02: origem externa é exigida e concentração externa zero é válida', () => {
  const input = dataset(Array(60).fill(600));
  assert.equal(analyze(input, { ...config, outdoor: { value: 400, unit: 'ppm', source: '' } }, rule).bins[0].eligibility, 'contexto_pendente');
  const zero = analyze(input, { ...config, outdoor: { value: 0, unit: 'ppm', source: 'Fixture controlada' } }, rule).bins[0];
  assert.equal(zero.eligibility, 'admissivel');
  assert.equal(zero.comparedValue, 600);
});
test('CALC-03: identificador do arquivo é preservado e divergência bloqueia antes da normalização', async () => {
  const input = await readInput(workbookFile({ 'Dados brutos': [['data_local', 'sensor_id', 'CO2'], ['2026-10-01 00:00', 'HOSPITAL', 900]] }));
  const sheet = input.sheets[0];
  assert.equal(sheet.originalSensorId, 'HOSPITAL');
  assert.throws(() => normalizeRows(sheet.rows, sheet.mapping, context, 'fixture'), /HOSPITAL.*SCHOOL/);
  const normalized = normalizeRows(sheet.rows, sheet.mapping, { ...context, sensorId: 'HOSPITAL' }, 'fixture');
  assert.equal(normalized.observations[0].originalSensorId, 'HOSPITAL');
  assert.equal(normalized.observations[0].sensorId, 'HOSPITAL');
});
test('CALC-03: núcleo também bloqueia IDs misturados sem depender do importador', () => {
  const rows = [{ date: '2026-10-01 00:00', id: 'SCHOOL', CO2: 600 }, { date: '2026-10-01 00:01', id: 'HOSPITAL', CO2: 900 }];
  assert.throws(() => normalizeRows(rows, { format: 'wide', date: 'date', sensor: 'id', columns: { CO2: 'CO2' } }, context, 'fixture'), /vários sensores/);
});
test('CALC-03: análise rejeita caso com sensor divergente mesmo em chamada independente', () => {
  const input = dataset([600]);
  input.observations[0].sensorId = 'HOSPITAL';
  assert.throws(() => analyze(input, config), /outro sensor/);
});

test('CALC-06: repetição de finitos extremos não produz Infinity ou null estatístico', () => {
  const result = stats([1e308, 1e308]);
  assert.equal(result.mean, 1e308);
  assert.equal(result.sd, 0);
  assertFiniteDeep(result);
});
test('CALC-06: extremos com sinais opostos preservam média, quantis e desvio finitos', () => {
  const result = stats([-1e308, 1e308]);
  assert.equal(result.mean, 0);
  assert.equal(result.median, 0);
  assert.equal(result.sd, 1e308);
  assert.ok(Math.abs(result.p95 / 1e308 - .9) < 1e-14);
  assertFiniteDeep(result);
});
test('CALC-06: análise, perfil e histograma conservam extremos e contagem', () => {
  for (const values of [[1e308, 1e308], [-1e308, 1e308], [-Number.MAX_VALUE, Number.MAX_VALUE]]) {
    const input = dataset([]);
    input.units = { Temp: { unit: '°C', confirmed: true } };
    input.observations = values.map((value, minute) => ({ ...observation(minute, value), parameter: 'Temp', unit: '°C' }));
    const result = analyze(input, { ...config, parameter: 'Temp' });
    assertFiniteDeep(result);
    assert.equal(result.histogram.reduce((sum, item) => sum + item.n, 0), values.length);
    assert.equal(result.profile.reduce((sum, item) => sum + item.n, 0), values.length);
    assert.equal(result.profile[0].mean, result.summary.mean);
  }
});
