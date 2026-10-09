import JSZip from 'jszip';
import { sha256, SOFTWARE_VERSION, PARAMETERS, ELIGIBILITY_LABELS } from './core.js';
import { executionDataset } from './executions.js';

// One contract for creation and opening. The fixed JSON components are additional
// to the source count, so a study with 148 small exports remains reopenable.
export const PACKAGE_LIMITS = Object.freeze({ archiveBytes: 80 * 1024 * 1024, expandedBytes: 160 * 1024 * 1024, manifestBytes: 256 * 1024, sources: 1000, observations: 1000000, issues: 1000000, decisions: 1000000, history: 30, bins: 20000 });
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^[a-zA-Z0-9-]{1,160}$/;
// Summation can move an ordinary mean a few ULPs beyond an observed endpoint.
// This relative bound also covers accumulation within the observation limit.
const STATS_RANGE_RELATIVE_TOLERANCE = 1e-9;
const pathAllowed = path => /^(case|execution|history)\.json$/.test(path) || /^inputs\/[a-zA-Z0-9-]{1,160}\.bin$/.test(path);
const fail = detail => { throw new Error(`O conteúdo do pacote não segue o esquema esperado: ${detail}.`); };
const object = (value, name) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name); };
const string = (value, name, required = false) => { if (typeof value !== 'string' || value.length > 1000000 || (required && !value.trim())) fail(name); };
const finite = (value, name, nullable = false) => { if (nullable && value === null) return; if (typeof value !== 'number' || !Number.isFinite(value)) fail(name); };
const integer = (value, name, nullable = false) => { if (nullable && value === null) return; finite(value, name); if (!Number.isSafeInteger(value) || value < 0) fail(name); };
const boolean = (value, name) => { if (typeof value !== 'boolean') fail(name); };
const list = (value, name, limit) => { if (!Array.isArray(value) || value.length > limit) fail(name); };
const date = (value, name) => { string(value, name, true); if (!Number.isFinite(Date.parse(value))) fail(name); };
const timestamp = (value, name) => { finite(value, name); if (Math.abs(value) > 8640000000000000) fail(name); };
const parameter = (value, name) => { if (!Object.hasOwn(PARAMETERS, value)) fail(name); };
const fraction = (value, name, nullable = false) => { if (nullable && value === null) return; finite(value, name); if (value < 0 || value > 1) fail(name); };
function jsonValues(value, depth = 0) {
  if (depth > 40) fail('estrutura excessivamente profunda');
  if (typeof value === 'number' && !Number.isFinite(value)) fail('número não finito');
  if (typeof value === 'string' && value.length > 1000000) fail('texto excessivo');
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('chave inesperada');
      jsonValues(child, depth + 1);
    }
  }
}
function validateStats(stats, name) {
  object(stats, name); integer(stats.n, `${name}.n`);
  for (const key of ['mean', 'median', 'min', 'max', 'p95', 'sd']) finite(stats[key], `${name}.${key}`, true);
  if (stats.n === 0 && ['mean', 'median', 'min', 'max', 'p95', 'sd'].some(key => stats[key] !== null)) fail(`${name} sem leituras`);
  if (stats.n > 0 && ['mean', 'median', 'min', 'max', 'p95', 'sd'].some(key => stats[key] === null)) fail(`${name} incompleto`);
  if (stats.min != null) {
    const tolerance = Math.max(Number.MIN_VALUE, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * STATS_RANGE_RELATIVE_TOLERANCE);
    const outside = value => value < stats.min - tolerance || value > stats.max + tolerance;
    if (stats.min > stats.max || outside(stats.mean) || outside(stats.median) || outside(stats.p95) || stats.sd < 0) fail(`${name} contraditório`);
  }
}
function validateDataset(dataset, shared = false) {
  object(dataset, 'caso');
  for (const key of ['id', 'name', 'sensorId', 'sensorLabel']) string(dataset[key], `caso.${key}`, true);
  if (!['escola', 'hospital', 'outro'].includes(dataset.environment)) fail('ambiente');
  boolean(dataset.synthetic, 'origem sintética');
  finite(dataset.offsetMinutes, 'fuso'); if (dataset.offsetMinutes < -840 || dataset.offsetMinutes > 840 || !Number.isInteger(dataset.offsetMinutes)) fail('fuso');
  if (dataset.nominalIntervalSeconds != null) { finite(dataset.nominalIntervalSeconds, 'frequência'); if (dataset.nominalIntervalSeconds <= 0) fail('frequência'); }
  if (dataset.hasInputs !== undefined) boolean(dataset.hasInputs, 'entradas disponíveis');
  object(dataset.units, 'unidades');
  for (const [key, item] of Object.entries(dataset.units)) { parameter(key, 'parâmetro da unidade'); object(item, 'unidade'); string(item.unit, 'unidade'); boolean(item.confirmed, 'unidade confirmada'); }
  list(dataset.sources, 'fontes', PACKAGE_LIMITS.sources);
  const sourceIds = new Set();
  for (const source of dataset.sources) {
    object(source, 'fonte'); if (!SOURCE_ID.test(source.id) || sourceIds.has(source.id)) fail('identificação da fonte'); sourceIds.add(source.id);
    string(source.name, 'nome da fonte', true); if (!HASH.test(source.hash)) fail('hash da fonte'); integer(source.size, 'tamanho da fonte');
    if (source.rows !== undefined) integer(source.rows, 'linhas da fonte');
    if (source.origin !== undefined) string(source.origin, 'origem da fonte');
    if (source.bytes !== undefined && !(source.bytes instanceof Uint8Array || source.bytes instanceof ArrayBuffer)) fail('bytes da fonte');
  }
  list(dataset.observations, 'observações', PACKAGE_LIMITS.observations);
  list(dataset.issues, 'ocorrências', PACKAGE_LIMITS.issues); list(dataset.decisions, 'decisões', PACKAGE_LIMITS.decisions);
  const observations = new Set();
  for (const observation of dataset.observations) {
    object(observation, 'observação'); string(observation.id, 'identificação da observação', true);
    if (observations.has(observation.id)) fail('observação duplicada'); observations.add(observation.id);
    if (!sourceIds.has(observation.sourceId) || observation.sensorId !== dataset.sensorId) fail('vínculo da observação ao sensor/fonte');
    integer(observation.rowNumber, 'linha'); if (!observation.rowNumber) fail('linha'); timestamp(observation.timestamp, 'data da observação');
    parameter(observation.parameter, 'parâmetro da observação'); finite(observation.value, 'valor da observação'); string(observation.unit, 'unidade da observação');
    boolean(observation.included, 'uso da observação'); boolean(observation.unitConfirmed, 'unidade da observação confirmada');
    list(observation.flags, 'sinalizações', 100); observation.flags.forEach(flag => string(flag, 'sinalização', true));
    if (observation.originalTime !== undefined) string(observation.originalTime, 'data original');
    if (observation.originalUnit != null) string(observation.originalUnit, 'unidade original');
    if (observation.unitSource !== undefined && !['file', 'context'].includes(observation.unitSource)) fail('origem da unidade');
    if (observation.manualDecision !== undefined) boolean(observation.manualDecision, 'revisão manual');
    if (observation.decision != null) string(observation.decision, 'decisão da observação');
  }
  for (const issue of dataset.issues) {
    object(issue, 'ocorrência'); if (!sourceIds.has(issue.sourceId)) fail('fonte da ocorrência'); integer(issue.rowNumber, 'linha da ocorrência'); string(issue.code, 'código da ocorrência', true); string(issue.detail, 'detalhe da ocorrência');
    if (issue.parameter != null) parameter(issue.parameter, 'parâmetro da ocorrência');
  }
  for (const decision of dataset.decisions) {
    object(decision, 'decisão'); if (decision.at !== undefined) date(decision.at, 'data da decisão');
    if (decision.observationId !== undefined && !observations.has(decision.observationId)) fail('vínculo da decisão à observação');
    if (decision.include !== undefined) boolean(decision.include, 'uso decidido');
    for (const key of ['reason', 'type', 'detail']) if (decision[key] !== undefined) string(decision[key], `decisão.${key}`);
  }
  if (shared && (dataset.observations.length || dataset.issues.length || dataset.decisions.length || dataset.hasInputs !== false || dataset.sources.some(source => source.bytes !== undefined))) fail('compartilhável contém dados individuais');
  if (dataset.createdAt !== undefined) date(dataset.createdAt, 'data do caso');
  return sourceIds;
}
function validateAnalysis(analysis) {
  object(analysis, 'análise'); parameter(analysis.parameter, 'parâmetro da análise'); string(analysis.unit, 'unidade da análise');
  object(analysis.config, 'configuração'); parameter(analysis.config.parameter, 'parâmetro da configuração');
  if (analysis.config.parameter !== analysis.parameter || !['hour', 'day'].includes(analysis.config.window)) fail('configuração da análise');
  timestamp(analysis.config.start, 'início'); timestamp(analysis.config.end, 'fim'); if (analysis.config.end <= analysis.config.start) fail('período');
  validateStats(analysis.summary, 'resumo'); list(analysis.bins, 'janelas', PACKAGE_LIMITS.bins);
  let previous = -Infinity;
  for (const bin of analysis.bins) {
    validateStats(bin, 'janela'); timestamp(bin.start, 'início da janela'); timestamp(bin.end, 'fim da janela'); string(bin.label, 'rótulo da janela', true);
    if (bin.start <= previous || bin.end <= bin.start || bin.end <= analysis.config.start || bin.start >= analysis.config.end) fail('ordem/período das janelas'); previous = bin.start;
    integer(bin.expected, 'slots esperados', true); integer(bin.occupied, 'slots ocupados', true); fraction(bin.coverage, 'cobertura da janela', true);
    for (const key of ['partial', 'unitMismatch', 'unitUnconfirmed']) if (bin[key] !== undefined) boolean(bin[key], `janela.${key}`);
    if (!Object.hasOwn(ELIGIBILITY_LABELS, bin.eligibility)) fail('elegibilidade'); string(bin.reason, 'motivo da janela');
    if (![null, 'acima', 'ate_referencia'].includes(bin.comparison)) fail('comparação');
    if (bin.comparedValue !== undefined) finite(bin.comparedValue, 'valor comparado');
    if (bin.expected != null && bin.occupied != null && bin.occupied > bin.expected) fail('slots contraditórios');
    if (bin.comparison !== null && bin.eligibility !== 'admissivel') fail('comparação sem elegibilidade');
  }
  if (analysis.profile !== undefined) { list(analysis.profile, 'perfil', 24); const hours = new Set(); for (const entry of analysis.profile) { object(entry, 'perfil'); integer(entry.hour, 'hora'); if (entry.hour > 23 || hours.has(entry.hour)) fail('hora'); hours.add(entry.hour); integer(entry.n, 'N do perfil'); finite(entry.mean, 'média do perfil', true); } }
  if (analysis.profile?.length && analysis.histogram === undefined) fail('distribuição ausente para o perfil');
  if (analysis.histogram !== undefined) {
    list(analysis.histogram, 'distribuição', 1000);
    for (const entry of analysis.histogram) {
      object(entry, 'distribuição'); finite(entry.lower, 'limite inferior'); finite(entry.upper, 'limite superior');
      const constant = analysis.histogram.length === 1 && analysis.summary.min === analysis.summary.max && entry.lower === analysis.summary.min && entry.upper === entry.lower;
      if (entry.upper < entry.lower || (entry.upper === entry.lower && !constant)) fail('intervalo da distribuição');
      integer(entry.n, 'N da distribuição');
    }
    if (analysis.histogram.reduce((sum, entry) => sum + entry.n, 0) !== analysis.summary.n) fail('total da distribuição');
  }
  object(analysis.quality, 'qualidade'); for (const key of ['inPeriod', 'used', 'excluded', 'flagged', 'emptyWindows']) integer(analysis.quality[key], `qualidade.${key}`);
  for (const key of ['expected', 'occupied']) integer(analysis.quality[key], `qualidade.${key}`, true); fraction(analysis.quality.coverage, 'cobertura', true); finite(analysis.quality.observedInterval, 'intervalo observado', true);
  object(analysis.eligibility, 'elegibilidade'); for (const key of ['windows', 'eligible', 'above']) integer(analysis.eligibility[key], `elegibilidade.${key}`); fraction(analysis.eligibility.fractionAbove, 'fração acima', true);
  if (analysis.eligibility.windows !== analysis.bins.length || analysis.eligibility.above > analysis.eligibility.eligible || analysis.eligibility.eligible > analysis.eligibility.windows || analysis.quality.used !== analysis.summary.n || analysis.quality.used + analysis.quality.excluded !== analysis.quality.inPeriod) fail('totais da análise');
  object(analysis.versions, 'versões'); string(analysis.versions.software, 'versão do software', true); string(analysis.versions.method, 'versão do método', true);
  if (analysis.rule != null) {
    const rule = analysis.rule; object(rule, 'referência'); parameter(rule.parameter, 'parâmetro da referência');
    for (const key of ['name', 'version', 'unit', 'source']) string(rule[key], `referência.${key}`);
    if (!['all', 'escola', 'hospital', 'outro'].includes(rule.scope) || !['hour', 'day'].includes(rule.window)) fail('escopo/janela da referência'); finite(rule.threshold, 'limiar'); fraction(rule.minCoverage, 'suficiência');
    for (const key of ['synthetic', 'measurementConfirmed', 'requiresOutdoor']) if (rule[key] !== undefined) boolean(rule[key], `referência.${key}`);
  }
}
function validateRun(run, dataset, shared = false) {
  object(run, 'execução'); for (const key of ['id', 'datasetId', 'caseName']) string(run[key], `execução.${key}`, true); date(run.createdAt, 'data da execução'); finite(run.offsetMinutes, 'fuso da execução');
  if (!Number.isInteger(run.offsetMinutes) || run.offsetMinutes < -840 || run.offsetMinutes > 840) fail('fuso da execução');
  if (run.datasetId !== dataset.id || (run.sensorId !== undefined && run.sensorId !== dataset.sensorId)) fail('vínculo entre caso, sensor e execução');
  validateAnalysis(run.analysis);
  if (run.reproductionStatus !== undefined && !['snapshot', 'results-only', 'legacy-context-unavailable'].includes(run.reproductionStatus)) fail('estado de reprodução');
  if (run.legacyContext !== undefined) boolean(run.legacyContext, 'contexto legado');
  if (run.datasetSnapshot !== undefined) {
    validateDataset(run.datasetSnapshot, shared || run.datasetSnapshot.hasInputs === false);
    if (run.datasetSnapshot.id !== run.datasetId || run.datasetSnapshot.sensorId !== dataset.sensorId || run.datasetSnapshot.offsetMinutes !== run.offsetMinutes || run.datasetSnapshot.name !== run.caseName) fail('contexto arquivado da execução');
    if (run.datasetSnapshot.hasInputs === false && run.reproductionStatus !== 'results-only') fail('estado da execução sem entradas');
    if (run.analysis.unit !== (run.datasetSnapshot.units[run.analysis.parameter]?.unit ?? '')) fail('unidade do resultado e contexto arquivado');
  }
}
function validateBundle(dataset, run, history, shared = false) {
  validateDataset(dataset, shared); validateRun(run, dataset, shared); list(history, 'histórico', PACKAGE_LIMITS.history);
  if (run.datasetSnapshot) {
    const snapshot = run.datasetSnapshot;
    for (const key of ['name', 'environment', 'synthetic', 'sensorLabel', 'offsetMinutes', 'nominalIntervalSeconds']) if (dataset[key] !== snapshot[key]) fail('caso diferente do contexto da execução selecionada');
    if (JSON.stringify(dataset.units) !== JSON.stringify(snapshot.units) || dataset.sources.length !== snapshot.sources.length || dataset.sources.some(source => !snapshot.sources.some(item => item.id === source.id && item.hash === source.hash && item.size === source.size))) fail('fontes/unidades do contexto selecionado');
  }
  const ids = new Set(); for (const entry of history) { validateRun(entry, dataset, shared); if (ids.has(entry.id)) fail('execução repetida no histórico'); ids.add(entry.id); }
  jsonValues(dataset); jsonValues(run); jsonValues(history);
}
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
function sharedDataset(dataset) {
  return { ...pick(dataset, ['id', 'name', 'environment', 'sensorId', 'sensorLabel', 'synthetic', 'offsetMinutes', 'nominalIntervalSeconds', 'createdAt', 'importedRows', 'rejectedRows']), units: Object.fromEntries(Object.entries(dataset.units).map(([key, unit]) => [key, pick(unit, ['unit', 'confirmed'])])), sources: dataset.sources.map(source => pick(source, ['id', 'name', 'hash', 'size', 'rows', 'origin'])), observations: [], issues: [], decisions: [], hasInputs: false };
}
function sharedRun(run) {
  const clean = pick(run, ['id', 'datasetId', 'sensorId', 'caseName', 'createdAt', 'offsetMinutes', 'reproductionStatus', 'legacyContext']);
  clean.analysis = pick(run.analysis, ['parameter', 'unit', 'rule', 'summary', 'bins', 'profile', 'histogram', 'quality', 'eligibility', 'versions']);
  clean.analysis.summary = pick(run.analysis.summary, ['n', 'mean', 'median', 'min', 'max', 'p95', 'sd']);
  clean.analysis.bins = run.analysis.bins.map(bin => pick(bin, ['start', 'end', 'label', 'n', 'mean', 'median', 'min', 'max', 'p95', 'sd', 'expected', 'occupied', 'coverage', 'partial', 'unitMismatch', 'unitUnconfirmed', 'eligibility', 'reason', 'comparison', 'comparedValue']));
  if (run.analysis.profile) clean.analysis.profile = run.analysis.profile.map(entry => pick(entry, ['hour', 'n', 'mean']));
  if (run.analysis.histogram) clean.analysis.histogram = run.analysis.histogram.map(entry => pick(entry, ['lower', 'upper', 'n']));
  clean.analysis.quality = pick(run.analysis.quality, ['inPeriod', 'used', 'excluded', 'flagged', 'emptyWindows', 'coverage', 'expected', 'occupied', 'observedInterval']);
  clean.analysis.eligibility = pick(run.analysis.eligibility, ['windows', 'eligible', 'above', 'fractionAbove']);
  clean.analysis.versions = pick(run.analysis.versions, ['software', 'method']);
  if (run.analysis.rule) clean.analysis.rule = pick(run.analysis.rule, ['id', 'name', 'version', 'parameter', 'unit', 'scope', 'window', 'threshold', 'minCoverage', 'source', 'synthetic', 'measurementConfirmed', 'requiresOutdoor']);
  clean.analysis.config = pick(run.analysis.config, ['parameter', 'window', 'start', 'end', 'ruleId']);
  if (run.datasetSnapshot) { clean.datasetSnapshot = sharedDataset(run.datasetSnapshot); clean.reproductionStatus = 'results-only'; }
  return clean;
}
function withoutSourceBytes(dataset) { return { ...dataset, sources: dataset.sources.map(({ bytes, ...source }) => source) }; }

export function readBounded(entry, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, rejected = false;
    const stream = entry.internalStream('uint8array');
    stream.on('data', chunk => { size += chunk.length; if (size > limit) { rejected = true; stream.pause(); reject(new Error('Conteúdo descompactado excede o limite desta versão.')); } else chunks.push(chunk); });
    stream.on('error', reject);
    stream.on('end', () => { if (rejected) return; const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } resolve(output); });
    stream.resume();
  });
}

export async function createPackage(dataset, run, history, complete = true) {
  boolean(complete, 'modalidade'); list(history, 'histórico', 1000000);
  const context = executionDataset(dataset, run);
  if (complete && context.hasInputs === false) throw new Error('Esta execução contém somente resultados. Recupere as entradas e crie outra execução para salvar um pacote completo.');
  const caseData = complete ? { ...withoutSourceBytes(context), hasInputs: true } : sharedDataset(context);
  const selected = complete ? run : sharedRun(run);
  // Only the selected execution carries its full basis. Repeating large raw
  // snapshots for 30 filter runs would make small studies exceed the payload cap.
  // Other executions retain aggregates and frozen metadata, explicitly read-only.
  const entriesHistory = history.slice(-PACKAGE_LIMITS.history).map(sharedRun);
  const execution = selected.datasetSnapshot ? { ...selected, datasetSnapshot: withoutSourceBytes(selected.datasetSnapshot) } : selected;
  validateBundle(caseData, execution, entriesHistory, !complete);
  const entries = { 'case.json': JSON.stringify(caseData), 'execution.json': JSON.stringify(execution), 'history.json': JSON.stringify(entriesHistory) };
  if (complete) for (const source of context.sources) {
    const available = source.bytes || dataset.sources.find(item => item.id === source.id && item.hash === source.hash)?.bytes;
    if (!available || available.byteLength !== source.size || await sha256(available) !== source.hash) throw new Error('Os arquivos originais desta execução não estão disponíveis ou não correspondem aos hashes. Salve resultados compartilháveis ou recupere as entradas originais.');
    entries[`inputs/${source.id}.bin`] = available;
  }
  if (Object.keys(entries).length > PACKAGE_LIMITS.sources + 3) throw new Error('O pacote contém arquivos demais.');
  const zip = new JSZip(), checksums = {}; let size = 0;
  for (const [path, data] of Object.entries(entries)) {
    size += typeof data === 'string' ? new TextEncoder().encode(data).length : data.byteLength;
    if (size > PACKAGE_LIMITS.expandedBytes) throw new Error('Conteúdo descompactado excede o limite desta versão. Reduza as entradas ou salve resultados compartilháveis.');
    checksums[path] = await sha256(data); zip.file(path, data);
  }
  const manifest = JSON.stringify({ schemaVersion: 1, software: SOFTWARE_VERSION, complete, createdAt: new Date().toISOString(), containsOriginals: complete, executionContext: run.datasetSnapshot ? 'frozen' : 'legacy-context-unavailable', files: checksums }, null, 2);
  if (new TextEncoder().encode(manifest).length > PACKAGE_LIMITS.manifestBytes) throw new Error('Manifesto excede o limite desta versão.');
  zip.file('manifest.json', manifest);
  zip.file('LEIA-ME.txt', complete ? 'Pacote completo: contém dados originais e normalizados da execução selecionada. Guarde localmente. Reabrir preserva os resultados; recalcular cria outra execução. Execuções legadas sem contexto congelado não oferecem reprodução histórica exata.' : 'Pacote compartilhável: somente resultados agregados e metadados. Leituras, ocorrências, decisões individuais, arquivos e contexto externo individual foram retirados. Não permite recalcular. Metadados e agregados ainda podem identificar o local: revise antes de compartilhar.');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  if (blob.size > PACKAGE_LIMITS.archiveBytes) throw new Error('Pacote maior que o limite de 80 MB desta versão. Reduza as entradas ou salve resultados compartilháveis.');
  return blob;
}
export async function openPackage(file) {
  if (file.size > PACKAGE_LIMITS.archiveBytes) throw new Error('Pacote maior que o limite de 80 MB desta versão.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('manifest.json'); if (!manifestFile) throw new Error('Este arquivo não é um pacote de análise reconhecido.');
  const manifest = JSON.parse(new TextDecoder().decode(await readBounded(manifestFile, PACKAGE_LIMITS.manifestBytes)));
  if (manifest.schemaVersion !== 1) throw new Error('Versão de pacote incompatível. Abra com a versão do software que o criou.');
  object(manifest.files, 'manifesto'); boolean(manifest.complete, 'modalidade'); boolean(manifest.containsOriginals, 'originais'); if (manifest.complete !== manifest.containsOriginals) fail('modalidade contraditória'); string(manifest.software, 'versão do manifesto', true); date(manifest.createdAt, 'data do manifesto'); jsonValues(manifest);
  const files = Object.entries(manifest.files); if (files.length > PACKAGE_LIMITS.sources + 3) throw new Error('O pacote contém arquivos demais.');
  if (['case.json', 'execution.json', 'history.json'].some(path => !Object.hasOwn(manifest.files, path))) fail('componentes obrigatórios');
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) { if (path !== 'inputs/') fail('diretório inesperado'); continue; }
    if (!['manifest.json', 'LEIA-ME.txt'].includes(path) && !Object.hasOwn(manifest.files, path)) fail('arquivo não declarado no manifesto');
  }
  const content = {}; let totalSize = 0;
  for (const [path, expected] of files) {
    if (!pathAllowed(path) || !HASH.test(expected) || (!manifest.complete && path.startsWith('inputs/'))) fail('estrutura inesperada no pacote');
    const entry = zip.file(path); if (!entry) throw new Error(`Arquivo ausente no pacote: ${path}`);
    const bytes = await readBounded(entry, PACKAGE_LIMITS.expandedBytes - totalSize); totalSize += bytes.length;
    if (await sha256(bytes) !== expected) throw new Error(`Integridade divergente: ${path}. O pacote foi alterado ou está corrompido.`);
    content[path] = bytes;
  }
  const decode = path => JSON.parse(new TextDecoder().decode(content[path]));
  const dataset = decode('case.json'), run = decode('execution.json'), history = decode('history.json');
  validateBundle(dataset, run, history, !manifest.complete);
  const sourceMap = new Map(dataset.sources.map(source => [source.id, source]));
  if (manifest.complete) {
    const inputPaths = files.filter(([path]) => path.startsWith('inputs/')).map(([path]) => path);
    if (inputPaths.length !== dataset.sources.length) fail('vínculo dos arquivos originais');
    for (const source of dataset.sources) {
      source.bytes = content[`inputs/${source.id}.bin`];
      if (!source.bytes || source.bytes.byteLength !== source.size || await sha256(source.bytes) !== source.hash) throw new Error('Hash ou tamanho do arquivo original incompatível com os metadados.');
    }
    for (const entry of [run, ...history]) if (entry.datasetSnapshot?.hasInputs !== false && entry.datasetSnapshot) for (const source of entry.datasetSnapshot.sources) { const input = sourceMap.get(source.id); if (!input || input.hash !== source.hash || input.size !== source.size) fail('fonte da execução arquivada'); }
  }
  dataset.hasInputs = manifest.complete;
  return { dataset, run, history: history.map(entry => entry.id === run.id ? run : entry), manifest };
}
