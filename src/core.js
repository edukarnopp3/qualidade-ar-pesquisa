export const SOFTWARE_VERSION = '0.1.1';
export const METHOD_VERSION = 'descritivo-1';
export const PARAMETERS = {
  CO2: { label: 'CO₂', unit: 'ppm', color: '#3569a8', dark: '#8eb8eb' },
  'PM2.5': { label: 'PM₂,₅', unit: 'µg/m³', color: '#8052aa', dark: '#c4a5e4' },
  PM1: { label: 'PM₁', unit: 'µg/m³', color: '#397c83', dark: '#90cbd0' },
  PM10: { label: 'PM₁₀', unit: 'µg/m³', color: '#a2602e', dark: '#e0af86' },
  Temp: { label: 'Temperatura', unit: '°C', color: '#a65069', dark: '#e3a1b3' },
  Umid: { label: 'Umidade relativa', unit: '%', color: '#537b35', dark: '#b1cd90' },
  Pressao: { label: 'Pressão', unit: 'hPa', color: '#657384', dark: '#bbc5d2' },
  VOC: { label: 'COVs', unit: '', color: '#9b6f0d', dark: '#e0c079' },
  NOx: { label: 'NOₓ', unit: '', color: '#6558a0', dark: '#b4abdf' },
};
const ALIASES = { co2: 'CO2', dioxidodecarbono: 'CO2', pm25: 'PM2.5', pm2: 'PM2.5', mp25: 'PM2.5', pm1: 'PM1', mp1: 'PM1', pm10: 'PM10', mp10: 'PM10', temp: 'Temp', temperatura: 'Temp', temperature: 'Temp', umid: 'Umid', umidade: 'Umid', umidaderelativa: 'Umid', humidity: 'Umid', rh: 'Umid', pressao: 'Pressao', press: 'Pressao', pressure: 'Pressao', voc: 'VOC', tvoc: 'VOC', cov: 'VOC', covs: 'VOC', nox: 'NOx' };
export const normalizeKey = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function parameterKey(value) {
  const key = normalizeKey(String(value ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ''));
  return ALIASES[key] || null;
}
export function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null || String(value).trim() === '') return null;
  let text = String(value).trim().replace(/\s/g, '');
  if (/[,]/.test(text) && /\./.test(text)) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else text = text.replace(',', '.');
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
export function parseTimestamp(value, offsetMinutes = -180) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 1 || value > 100000) return null;
    return Math.round((value - 25569) * 86400000) - offsetMinutes * 60000;
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const [year, month, day] = text.slice(0, 10).split('-').map(Number), calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    const brazil = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brazil) match = [brazil[0], brazil[3], brazil[2], brazil[1], brazil[4], brazil[5], brazil[6]];
  }
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(v => Number(v || 0));
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  return wall.getTime() - offsetMinutes * 60000;
}
export function localIso(timestamp, offsetMinutes = -180) { return new Date(timestamp + offsetMinutes * 60000).toISOString().slice(0, 19); }
export function stats(values) {
  const numbers = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return { n: 0, mean: null, median: null, min: null, max: null, p95: null, sd: null };
  const n = numbers.length, mean = numbers.reduce((sum, v) => sum + v, 0) / n;
  const quantile = (p) => { const index = (n - 1) * p; const low = Math.floor(index); return numbers[low] + (index - low) * (numbers[Math.ceil(index)] - numbers[low]); };
  return { n, mean, median: quantile(.5), min: numbers[0], max: numbers[n - 1], p95: quantile(.95), sd: Math.sqrt(numbers.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n) };
}
export function inferInterval(observations) {
  const times = [...new Set(observations.map(o => o.timestamp))].sort((a, b) => a - b);
  const differences = times.slice(1).map((t, i) => (t - times[i]) / 1000).filter(v => v > 0);
  return stats(differences).median;
}
export function normalizeRows(rows, mapping, context, sourceId) {
  const observations = [], issues = [];
  let rejectedRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], rowNumber = i + 2;
    const timestamp = parseTimestamp(row[mapping.date], context.offsetMinutes);
    if (timestamp == null) { issues.push({ rowNumber, sourceId, code: 'data_invalida', detail: String(row[mapping.date] ?? 'Data ausente') }); rejectedRows++; continue; }
    const pairs = mapping.format === 'long' ? [[parameterKey(row[mapping.parameter]), mapping.value]] : Object.entries(mapping.columns);
    let found = 0;
    for (const [parameter, column] of pairs) {
      if (!PARAMETERS[parameter]) { issues.push({ rowNumber, sourceId, code: 'parametro_desconhecido', detail: String(row[mapping.parameter] ?? '') }); continue; }
      const value = numeric(row[column]);
      if (value == null) { issues.push({ rowNumber, sourceId, parameter, code: 'valor_ausente_invalido', detail: String(row[column] ?? 'Valor ausente') }); continue; }
      found++;
      const flags = [];
      if ((['CO2', 'PM1', 'PM2.5', 'PM10'].includes(parameter) && value < 0) || (parameter === 'Umid' && (value < 0 || value > 100))) flags.push('fora_dominio_fisico');
      const unit = mapping.format === 'long' && mapping.unit ? String(row[mapping.unit] ?? '').trim() : context.units?.[parameter]?.unit ?? PARAMETERS[parameter].unit;
      if (context.units?.[parameter]?.unit && unit !== context.units[parameter].unit) flags.push('unidade_incompativel');
      observations.push({ id: `${sourceId}:${rowNumber}:${parameter}`, sourceId, rowNumber, timestamp, originalTime: String(row[mapping.date]), sensorId: context.sensorId, parameter, value, unit, originalUnit: mapping.format === 'long' && mapping.unit ? unit : null, unitSource: mapping.format === 'long' && mapping.unit ? 'file' : 'context', unitConfirmed: Boolean(context.units?.[parameter]?.confirmed), flags, included: flags.length === 0, decision: flags.length ? 'Sinalizado e excluído por domínio físico ou unidade incompatível; revisão necessária' : null });
    }
    if (!found) rejectedRows++;
  }
  return { observations, issues, importedRows: rows.length, rejectedRows };
}
export function resolveDuplicates(observations) {
  const grouped = new Map();
  const result = observations.map(o => ({ ...o, flags: [...o.flags] }));
  for (const o of result) {
    const key = `${o.sensorId}|${o.timestamp}|${o.parameter}`;
    const previous = grouped.get(key);
    if (!previous) { grouped.set(key, [o]); continue; }
    previous.push(o);
  }
  for (const group of grouped.values()) {
    if (group.length < 2) continue;
    const conflict = group.some(o => o.value !== group[0].value || o.unit !== group[0].unit);
    group.forEach((o, index) => {
      const flag = conflict ? 'duplicata_conflitante' : 'duplicata_identica';
      if (!o.flags.includes(flag)) o.flags.push(flag);
      if (!o.manualDecision) { o.included = !conflict && index === 0 && !o.flags.includes('fora_dominio_fisico'); o.decision = conflict ? 'Valores conflitantes preservados; todos excluídos até revisão' : index ? 'Duplicata idêntica preservada e excluída do cálculo' : 'Primeira leitura da duplicata mantida'; }
    });
  }
  return result.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}
export function classifyWindow(bin, dataset, config, rule) {
  if (!bin.n) return { eligibility: 'sem_dados', reason: 'Nenhuma leitura utilizável nesta janela.', comparison: null };
  if (!rule) return { eligibility: 'sem_referencia', reason: 'Análise descritiva. Nenhuma referência selecionada.', comparison: null };
  if (rule.synthetic && !dataset.synthetic) return { eligibility: 'fora_escopo', reason: 'Critérios sintéticos não podem ser aplicados a medições reais.', comparison: null };
  if (rule.parameter !== config.parameter || (rule.scope !== 'all' && rule.scope !== dataset.environment)) return { eligibility: 'fora_escopo', reason: 'A referência não se aplica ao parâmetro ou ambiente.', comparison: null };
  if (!dataset.units[config.parameter]?.confirmed || rule.unit !== dataset.units[config.parameter].unit || bin.unitMismatch || bin.unitUnconfirmed) return { eligibility: 'unidade_pendente', reason: 'Unidade não confirmada ou incompatível com a referência.', comparison: null };
  if (!rule.measurementConfirmed) return { eligibility: 'metodo_pendente', reason: 'Os requisitos de medição da referência ainda não foram confirmados.', comparison: null };
  if (rule.window !== config.window) return { eligibility: 'janela_incompativel', reason: 'A agregação exibida difere da janela da referência.', comparison: null };
  if (bin.partial) return { eligibility: 'janela_parcial', reason: 'O recorte não inclui toda a janela exigida.', comparison: null };
  if (bin.coverage == null) return { eligibility: 'frequencia_pendente', reason: 'Informe a frequência nominal para calcular cobertura temporal.', comparison: null };
  if (bin.coverage < rule.minCoverage) return { eligibility: 'dados_insuficientes', reason: `Cobertura ${Math.round(bin.coverage * 100)}% inferior ao critério ${Math.round(rule.minCoverage * 100)}% da referência selecionada.`, comparison: null };
  if (rule.requiresOutdoor && !Number.isFinite(config.outdoorCo2)) return { eligibility: 'contexto_pendente', reason: 'A comparação exige CO₂ externo e esse dado não foi informado.', comparison: null };
  const value = rule.requiresOutdoor ? bin.mean - config.outdoorCo2 : bin.mean;
  return { eligibility: 'admissivel', reason: rule.synthetic ? 'Critério sintético de demonstração; sem valor normativo.' : 'Condições documentadas desta regra atendidas.', comparison: value > rule.threshold ? 'acima' : 'ate_referencia', comparedValue: value };
}
export function analyze(dataset, config, rule = null) {
  const parameter = config.parameter;
  const selected = dataset.observations.filter(o => o.parameter === parameter && o.timestamp >= config.start && o.timestamp < config.end);
  const accepted = selected.filter(o => o.included && o.unit === dataset.units[parameter]?.unit);
  const incompatibleTimes = selected.filter(o => o.included && o.unit !== dataset.units[parameter]?.unit).map(o => o.timestamp);
  const width = config.window === 'day' ? 86400000 : 3600000;
  const shift = dataset.offsetMinutes * 60000;
  const first = Math.floor((config.start + shift) / width) * width - shift;
  const incompatibleWindows = new Set(incompatibleTimes.map(t => Math.floor((t + shift) / width) * width - shift));
  const bins = [];
  if (Math.ceil((config.end - first) / width) > 20000) throw new Error('Recorte muito extenso. Use médias diárias ou reduza o período.');
  const grouped = new Map();
  for (const o of accepted) { const key = Math.floor((o.timestamp + shift) / width) * width - shift; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(o); }
  const cadence = dataset.nominalIntervalSeconds;
  for (let time = first; time < config.end; time += width) {
    const start = Math.max(time, config.start), end = Math.min(time + width, config.end);
    const samples = grouped.get(time) || [];
    const expected = cadence > 0 ? Math.ceil((end - start) / (cadence * 1000)) : null;
    // Occupancy of nominal temporal slots: multiple samples in one slot count once.
    const occupied = new Set(samples.map(o => Math.floor((o.timestamp - start) / (cadence * 1000))));
    const summary = stats(samples.map(o => o.value));
    const bin = { start: time, end: time + width, label: localIso(time, dataset.offsetMinutes), ...summary, expected, occupied: cadence > 0 ? occupied.size : null, coverage: expected ? Math.min(1, occupied.size / expected) : null, partial: start !== time || end !== time + width, unitMismatch: incompatibleWindows.has(time), unitUnconfirmed: samples.some(o => !o.unitConfirmed) };
    bins.push({ ...bin, ...classifyWindow(bin, dataset, config, rule) });
  }
  const occupiedTotal = bins.reduce((sum, b) => sum + (b.occupied || 0), 0), expectedTotal = bins.reduce((sum, b) => sum + (b.expected || 0), 0);
  const eligible = bins.filter(b => b.eligibility === 'admissivel'), above = eligible.filter(b => b.comparison === 'acima');
  const summary = stats(accepted.map(o => o.value)), profile = Array.from({ length: 24 }, (_, hour) => ({ hour, n: 0, sum: 0, mean: null }));
  const step = Math.max(((summary.max ?? 1) - (summary.min ?? 0)) / 16, 1e-6);
  const histogram = Array.from({ length: 16 }, (_, i) => ({ lower: (summary.min ?? 0) + i * step, upper: (summary.min ?? 0) + (i + 1) * step, n: 0 }));
  for (const observation of accepted) { const slot = profile[new Date(observation.timestamp + shift).getUTCHours()]; slot.n++; slot.sum += observation.value; histogram[Math.min(15, Math.floor((observation.value - summary.min) / step))].n++; }
  profile.forEach(p => { p.mean = p.n ? p.sum / p.n : null; delete p.sum; });
  return { parameter, unit: dataset.units[parameter]?.unit ?? '', config: { ...config }, rule: rule ? { ...rule } : null, summary, bins, profile, histogram, quality: { inPeriod: selected.length, used: accepted.length, excluded: selected.length - accepted.length, flagged: selected.filter(o => o.flags.length).length, emptyWindows: bins.filter(b => !b.n).length, coverage: expectedTotal ? occupiedTotal / expectedTotal : null, expected: expectedTotal || null, occupied: expectedTotal ? occupiedTotal : null, observedInterval: inferInterval(accepted) }, eligibility: { windows: bins.length, eligible: eligible.length, above: above.length, fractionAbove: eligible.length ? above.length / eligible.length : null }, versions: { software: SOFTWARE_VERSION, method: METHOD_VERSION } };
}
export async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export const ELIGIBILITY_LABELS = { sem_dados: 'Sem leituras utilizáveis', sem_referencia: 'Descritivo', fora_escopo: 'Fora do escopo', unidade_pendente: 'Unidade pendente', metodo_pendente: 'Método pendente', janela_incompativel: 'Janela incompatível', janela_parcial: 'Janela parcial', frequencia_pendente: 'Frequência pendente', dados_insuficientes: 'Dados insuficientes', contexto_pendente: 'Contexto pendente', admissivel: 'Comparação admissível' };
