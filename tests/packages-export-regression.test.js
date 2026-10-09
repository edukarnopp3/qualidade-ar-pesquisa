import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { read, utils } from 'xlsx';
import { analyze, normalizeRows, sha256 } from '../src/core.js';
import { createExecution, cloneCase } from '../src/executions.js';
import { createPackage, openPackage, PACKAGE_LIMITS } from '../src/packages.js';
import { exportWorkbook, exportPdf, pdfChartGeometry } from '../src/exports.js';

async function source(index = 0) {
  const bytes = new TextEncoder().encode(`Origem integralmente sintética ${index}`), hash = await sha256(bytes);
  return { id: hash.slice(0, 16), hash, bytes, size: bytes.byteLength, rows: 2, name: `sintetico-${index}.csv`, origin: 'synthetic' };
}
async function fixture() {
  const input = await source(), units = { CO2: { unit: 'ppm', confirmed: true } };
  const normalized = normalizeRows([{ data_local: '2026-10-01 00:00', CO2: 500 }, { data_local: '2026-10-01 00:01', CO2: 700 }], { format: 'wide', date: 'data_local', columns: { CO2: 'CO2' } }, { sensorId: 'SYNTHETIC-CONTROL', offsetMinutes: -180, units }, input.id);
  const dataset = { id: 'synthetic-case', name: 'Controle histórico sintético', sensorId: 'SYNTHETIC-CONTROL', sensorLabel: 'Exemplo', environment: 'escola', synthetic: true, offsetMinutes: -180, nominalIntervalSeconds: 60, units, sources: [input], observations: normalized.observations, issues: [], decisions: [], hasInputs: true, createdAt: '2026-10-08T00:00:00Z' };
  const analysis = analyze(dataset, { parameter: 'CO2', window: 'hour', start: Date.UTC(2026, 9, 1, 3), end: Date.UTC(2026, 9, 1, 4) });
  return { dataset, run: createExecution(dataset, analysis) };
}
async function rewrite(blob, path, mutate) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const item = JSON.parse(await zip.file(path).async('string')), next = mutate(item) || item;
  const json = JSON.stringify(next), manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  zip.file(path, json); manifest.files[path] = await sha256(json); zip.file('manifest.json', JSON.stringify(manifest));
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'sintetico-alterado.aircase');
}

test('ARQ-03: Excel, PDF e pacote usam o snapshot da execução antiga após alterar o caso', async () => {
  const { dataset, run } = await fixture(), changed = cloneCase(dataset);
  changed.name = 'Nome atual diferente'; changed.environment = 'hospital'; changed.nominalIntervalSeconds = 300;
  changed.units.CO2.confirmed = false; changed.observations[0].included = false;
  changed.decisions.push({ observationId: changed.observations[0].id, include: false, reason: 'Decisão posterior', at: '2026-10-08T01:00:00Z' });
  changed.sources.push(await source(2));
  const wb = read(await exportWorkbook(changed, run).arrayBuffer(), { type: 'array' });
  const method = utils.sheet_to_json(wb.Sheets.Metodo)[0];
  assert.equal(method.frequencia_nominal_segundos, 60); assert.equal(method.ambiente, 'escola');
  assert.equal(utils.sheet_to_json(wb.Sheets.Arquivos).length, 1);
  assert.equal(utils.sheet_to_json(wb.Sheets.Resultados)[0].media, (500 + 700) / 2);
  const pdf = new TextDecoder().decode(await exportPdf(changed, run).arrayBuffer());
  assert.ok(pdf.includes('Controle hist')); assert.ok(!pdf.includes('Nome atual diferente'));
  const reopened = await openPackage(new File([await createPackage(changed, run, [run], true)], 'historico.aircase'));
  assert.equal(reopened.dataset.name, dataset.name); assert.equal(reopened.dataset.nominalIntervalSeconds, 60);
  assert.equal(reopened.dataset.units.CO2.confirmed, true); assert.equal(reopened.dataset.observations[0].included, true);
  assert.equal(reopened.dataset.decisions.length, 0); assert.equal(reopened.dataset.sources.length, 1);
  assert.deepEqual(reopened.run, run); assert.equal(reopened.manifest.executionContext, 'frozen');
});

test('ARQ-03: histórico com entradas externas ao pacote guarda só resultado, explicitamente', async () => {
  const { dataset, run } = await fixture(), changed = cloneCase(dataset); changed.sources.push(await source(10));
  const next = createExecution(changed, analyze(changed, run.analysis.config));
  const reopened = await openPackage(new File([await createPackage(changed, run, [run, next], true)], 'historico.aircase'));
  assert.equal(reopened.history[0].reproductionStatus, 'snapshot');
  assert.equal(reopened.history[1].datasetSnapshot.hasInputs, false);
  assert.equal(reopened.history[1].datasetSnapshot.sources.length, 2);
  assert.equal(reopened.history[1].datasetSnapshot.observations.length, 0);
  assert.equal(reopened.history[1].reproductionStatus, 'results-only');
  assert.deepEqual(reopened.history[1].analysis, next.analysis);
});

test('ARQ-03: execução legada abre e exporta com limitação explícita de contexto histórico', async () => {
  const { dataset, run } = await fixture(); delete run.datasetSnapshot; delete run.reproductionStatus; delete run.sensorId;
  const reopened = await openPackage(new File([await createPackage(dataset, run, [run], true)], 'legado.aircase'));
  assert.deepEqual(reopened.run, run); assert.equal(reopened.manifest.executionContext, 'legacy-context-unavailable');
  const wb = read(await exportWorkbook(dataset, run).arrayBuffer(), { type: 'array' });
  assert.match(utils.sheet_to_json(wb.Sheets.Metodo)[0].contexto_execucao, /legada.*contexto congelado/);
});

test('ARQ-04: compartilhável remove leituras, decisões, ocorrências e contextos privados de caso, execução e histórico', async () => {
  const { dataset: original } = await fixture(), dataset = cloneCase(original);
  dataset.notes = 'PRIVADO-NOTA'; dataset.outdoorContext = { value: 432, unit: 'ppm', source: 'PRIVADO-EXTERNO' };
  dataset.decisions = [{ at: '2026-10-08T00:00:00Z', observationId: dataset.observations[0].id, reason: 'PRIVADO-DECISAO leu 500 ppm', include: true }];
  dataset.issues = [{ sourceId: dataset.sources[0].id, rowNumber: 3, code: 'valor_invalido', detail: 'PRIVADO-REJEICAO' }];
  dataset.sources[0].mapping = { raw: 'PRIVADO-MAPPING' }; dataset.sources[0].context = { password: 'PRIVADO-CONTEXT' };
  const analysis = analyze(dataset, { ...fixtureConfig(), outdoorCo2: 432, outdoorContext: dataset.outdoorContext });
  analysis.bins[0].rawValues = ['PRIVADO-BIN']; analysis.quality.raw = 'PRIVADO-QUALIDADE';
  const run = createExecution(dataset, analysis);
  const blob = await createPackage(dataset, run, [run], false), zip = await JSZip.loadAsync(await blob.arrayBuffer());
  for (const path of ['case.json', 'execution.json', 'history.json']) assert.ok(!(await zip.file(path).async('string')).includes('PRIVADO-'), path);
  const reopened = await openPackage(new File([blob], 'compartilhavel.aircase'));
  for (const context of [reopened.dataset, reopened.run.datasetSnapshot, reopened.history[0].datasetSnapshot]) {
    assert.equal(context.hasInputs, false); assert.deepEqual(context.observations, []); assert.deepEqual(context.issues, []); assert.deepEqual(context.decisions, []);
    assert.equal(context.sources[0].bytes, undefined); assert.equal(context.sources[0].mapping, undefined); assert.equal(context.outdoorContext, undefined);
  }
  assert.equal(reopened.run.analysis.config.outdoorCo2, undefined); assert.equal(reopened.run.analysis.summary.mean, 600);
});
const fixtureConfig = () => ({ parameter: 'CO2', window: 'hour', start: Date.UTC(2026, 9, 1, 3), end: Date.UTC(2026, 9, 1, 4) });

test('ARQ-05: JSON com hashes coerentes ainda é recusado quando tipos, IDs, fontes, números ou histórico contradizem o esquema', async () => {
  const { dataset, run } = await fixture(), blob = await createPackage(dataset, run, [run], true);
  const cases = [
    ['case.json', item => { item.id = 'outro-caso'; }],
    ['execution.json', item => { item.sensorId = 'OTHER-SENSOR'; }],
    ['execution.json', item => { item.analysis.bins = { invalid: true }; }],
    ['execution.json', item => { item.analysis.bins[0].mean = '600'; }],
    ['execution.json', item => { item.analysis.parameter = 'OTHER'; }],
    ['execution.json', item => { item.analysis.config.start = null; }],
    ['execution.json', item => { item.createdAt = 'não é data'; }],
    ['execution.json', item => { item.analysis.profile[0].hour = 30; }],
    ['case.json', item => { item.observations[0].sourceId = 'missing-source'; }],
    ['case.json', item => { item.observations[0].included = 'yes'; }],
    ['case.json', item => { item.sources.push({ ...item.sources[0] }); }],
    ['history.json', item => { item[0].datasetId = 'outro-caso'; }],
    ['history.json', item => { while (item.length < PACKAGE_LIMITS.history + 1) item.push({ ...item[0], id: `run-${item.length}` }); }],
  ];
  for (const [path, mutate] of cases) await assert.rejects(() => rewrite(blob, path, mutate).then(openPackage), /esquema esperado/, path);
  await assert.rejects(() => rewrite(blob, 'case.json', item => { item.observations[0].value = Number.POSITIVE_INFINITY; }).then(openPackage), /esquema esperado/);
});

test('ARQ-05: pacote compartilhável que contém observações é rejeitado antes de chegar à interface', async () => {
  const { dataset, run } = await fixture(), blob = await createPackage(dataset, run, [run], false);
  await assert.rejects(() => rewrite(blob, 'case.json', item => { item.observations = dataset.observations; }).then(openPackage), /compartilhável contém dados individuais/);
});

test('ARQ-05: uma leitura ou série constante continua salvável e reabrível em ambas as modalidades', async () => {
  for (const count of [1, 2]) {
    const { dataset: original } = await fixture(), dataset = cloneCase(original);
    dataset.observations = dataset.observations.slice(0, count).map(observation => ({ ...observation, value: 600 }));
    const run = createExecution(dataset, analyze(dataset, fixtureConfig()));
    assert.deepEqual(run.analysis.histogram, [{ lower: 600, upper: 600, n: count }]);
    for (const complete of [true, false]) {
      const blob = await createPackage(dataset, run, [run], complete);
      const reopened = await openPackage(new File([blob], `constante-${count}.aircase`));
      assert.equal(reopened.run.analysis.summary.mean, 600);
      assert.deepEqual(reopened.run.analysis.histogram, run.analysis.histogram);
      await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.analysis.histogram[0].lower = 700; item.analysis.histogram[0].upper = 700; }).then(openPackage), /intervalo da distribuição/);
    }
  }
});

test('ARQ-05: médias decimais com arredondamento reabrem e contradições materiais continuam recusadas', async () => {
  for (const value of [500.1, 0.1]) {
    const { dataset: original } = await fixture(), dataset = cloneCase(original);
    const rows = Array.from({ length: 3 }, (_, index) => ({ data_local: `2026-10-01 00:0${index}`, CO2: value }));
    const normalized = normalizeRows(rows, { format: 'wide', date: 'data_local', columns: { CO2: 'CO2' } }, { sensorId: dataset.sensorId, offsetMinutes: dataset.offsetMinutes, units: dataset.units }, dataset.sources[0].id);
    dataset.observations = normalized.observations; dataset.sources[0].rows = rows.length;
    const run = createExecution(dataset, analyze(dataset, fixtureConfig()));
    assert.equal(run.analysis.summary.n, 3);
    assert.ok(run.analysis.summary.mean > run.analysis.summary.max); // Ordinary IEEE-754 summation drift.
    for (const complete of [true, false]) {
      const blob = await createPackage(dataset, run, [run], complete);
      const reopened = await openPackage(new File([blob], `decimal-${value}.aircase`));
      assert.deepEqual(reopened.run.analysis.summary, run.analysis.summary);
      await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.analysis.summary.mean = value + 1; }).then(openPackage), /resumo contraditório/);
      await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.analysis.bins[0].mean = value + 1; }).then(openPackage), /janela contraditório/);
    }
  }
});

test('ARQ-05: perfil exige distribuição válida, conservando compatibilidade do legado sem ambos', async () => {
  const { dataset, run } = await fixture(), blob = await createPackage(dataset, run, [run], true);
  await assert.rejects(() => rewrite(blob, 'execution.json', item => { delete item.analysis.histogram; }).then(openPackage), /distribuição ausente para o perfil/);
  await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.analysis.histogram = {}; }).then(openPackage), /esquema esperado: distribuição/);
  await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.analysis.histogram[0].n++; }).then(openPackage), /total da distribuição/);
  const legacy = await openPackage(await rewrite(blob, 'execution.json', item => { delete item.analysis.profile; delete item.analysis.histogram; }));
  assert.equal(legacy.run.analysis.profile, undefined); assert.equal(legacy.run.analysis.histogram, undefined);
  assert.equal(legacy.run.analysis.summary.mean, 600);
});

test('ARQ-05: fuso legado deve ser inteiro no domínio e snapshot exige o mesmo fuso', async () => {
  const { dataset, run } = await fixture(); delete run.datasetSnapshot; delete run.reproductionStatus; delete run.sensorId;
  const blob = await createPackage(dataset, run, [run], true);
  for (const offset of [1e308, -841, 841, 0.5]) {
    await assert.rejects(() => rewrite(blob, 'execution.json', item => { item.offsetMinutes = offset; }).then(openPackage), /fuso da execução/);
  }
  for (const offset of [-840, 840]) {
    const reopened = await openPackage(await rewrite(blob, 'execution.json', item => { item.offsetMinutes = offset; }));
    assert.equal(reopened.run.offsetMinutes, offset);
  }
  const frozen = await fixture(), frozenBlob = await createPackage(frozen.dataset, frozen.run, [frozen.run], true);
  await assert.rejects(() => rewrite(frozenBlob, 'execution.json', item => { item.offsetMinutes = 0; }).then(openPackage), /contexto arquivado da execução/);
});

test('ARQ-06: 148 fontes e o limite de 1000 fontes podem ser criados e reabertos pelo mesmo contrato', async () => {
  for (const count of [148, PACKAGE_LIMITS.sources]) {
    const { dataset: original } = await fixture(), dataset = cloneCase(original);
    const oldSource = dataset.sources[0].id; dataset.sources = await Promise.all(Array.from({ length: count }, (_, index) => source(index)));
    assert.equal(dataset.sources[0].id, oldSource);
    const run = createExecution(dataset, analyze(dataset, fixtureConfig()));
    const blob = await createPackage(dataset, run, [run], true);
    const reopened = await openPackage(new File([blob], `${count}-fontes.aircase`));
    assert.equal(reopened.dataset.sources.length, count); assert.equal(Object.keys(reopened.manifest.files).length, count + 3);
    assert.equal(await sha256(reopened.dataset.sources.at(-1).bytes), dataset.sources.at(-1).hash);
  }
});

test('ARQ-06: geração e abertura rejeitam fontes excedentes e tamanhos originais divergentes', async () => {
  const { dataset, run } = await fixture();
  const changed = cloneCase(dataset); changed.sources[0].size++;
  delete run.datasetSnapshot;
  await assert.rejects(() => createPackage(changed, run, [run], true), /originais desta execução/);
  const blob = await createPackage(dataset, run, [run], true);
  await assert.rejects(() => rewrite(blob, 'case.json', item => { item.sources[0].size++; }).then(openPackage), /tamanho.*incompatível/);
  await assert.rejects(() => openPackage({ size: PACKAGE_LIMITS.archiveBytes + 1 }), /80 MB/);
  changed.sources = Array.from({ length: PACKAGE_LIMITS.sources + 1 }, (_, index) => ({ ...dataset.sources[0], id: `synthetic-${index}` }));
  await assert.rejects(() => createPackage(changed, run, [], false), /esquema esperado: fontes/);
});

test('ARQ-03: pacote não repete bases brutas para cada recorte do histórico', async () => {
  const { dataset, run } = await fixture();
  const history = Array.from({ length: 30 }, () => createExecution(dataset, analyze(dataset, run.analysis.config)));
  history[0] = run;
  const blob = await createPackage(dataset, run, history, true);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const stored = JSON.parse(await zip.file('history.json').async('string'));
  assert.ok(stored.every(entry => entry.datasetSnapshot.observations.length === 0));
  assert.ok(stored.every(entry => entry.reproductionStatus === 'results-only'));
  const reopened = await openPackage(new File([blob], 'history.aircase'));
  assert.deepEqual(reopened.history[0], run);
  assert.equal(reopened.run.datasetSnapshot.observations.length, 2);
});

test('ARQ-08: PDF desenha uma janela e pontos isolados sem unir através de lacunas', async () => {
  const { dataset, run } = await fixture(), geometry = pdfChartGeometry(run.analysis.bins);
  assert.equal(geometry.points.length, 1); assert.equal(geometry.segments.length, 0);
  assert.ok(geometry.min < 600 && geometry.max > 600); assert.equal(geometry.points[0].x, 32 + 158 / 2);
  const isolated = pdfChartGeometry([{ mean: 500 }, { mean: null }, { mean: 700 }, { mean: 700 }]);
  assert.equal(isolated.points.length, 3); assert.equal(isolated.segments.length, 1);
  assert.equal(isolated.segments[0].from.index, 2); assert.equal(isolated.segments[0].to.index, 3);
  assert.ok(isolated.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const extreme = pdfChartGeometry([{ mean: -1e308 }, { mean: 1e308 }]);
  assert.ok(Number.isFinite(extreme.min) && Number.isFinite(extreme.max));
  assert.ok(extreme.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const pdf = new TextDecoder().decode(await exportPdf(dataset, run).arrayBuffer());
  assert.ok(pdf.startsWith('%PDF-')); assert.ok(pdf.includes(' c\n')); // Bézier marker emitted by jsPDF.circle.
});
