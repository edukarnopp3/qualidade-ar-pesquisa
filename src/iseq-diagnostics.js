// Only fixed labels and numeric aggregates can leave this transient trace.
export const ISEQ_PHASES = Object.freeze({
  health: 'Preparação do serviço', login: 'Entrada e lista de sensores',
  equipment: 'Atualização de sensores', create_job: 'Preparação da consulta',
  history: 'Busca do histórico', download: 'Transferência dos dados', prepare: 'Preparação local',
});
const OPERATIONS = Object.freeze({ login: 'Conexão', history: 'Histórico', equipment: 'Sensores' });
const OUTCOMES = Object.freeze({ running: 'em andamento', success: 'concluído', error: 'interrompido', cancelled: 'cancelado', unavailable: 'não disponível' });
const TASK_KEYS = ['total', 'completed', 'cached', 'downloads', 'attempted', 'workers', 'failedAttempts'];
const integer = value => Number.isSafeInteger(value) && value >= 0;
const duration = value => Number.isFinite(value) && value >= 0 && value <= 86400000;
const round = value => Math.round(value * 10) / 10;
export const formatIseqDuration = ms => ms < 1000 ? `${Math.round(Math.max(0, ms))} ms` : `${(Math.max(0, ms) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;

export class IseqTrace {
  #clock; #start; #operation; #end = null; #outcome = 'running'; #phases = new Map(); #tasks = {}; #transfer = {};
  constructor(operation, clock = () => performance.now()) {
    this.#operation = Object.hasOwn(OPERATIONS, operation) ? operation : 'history';
    this.#clock = clock; this.#start = clock();
  }
  #phase(stage) {
    if (!Object.hasOwn(ISEQ_PHASES, stage)) return null;
    if (!this.#phases.has(stage)) this.#phases.set(stage, { stage, outcome: 'running', durationMs: 0, requests: 0, requestMs: 0, responseBytes: 0, measuredResponses: 0, decodeMs: 0, failures: 0, status: null, started: null });
    return this.#phases.get(stage);
  }
  observe(event) {
    if (this.#end !== null || !event || typeof event !== 'object') return;
    if (event.type === 'stage') {
      const phase = this.#phase(event.stage); if (!phase) return;
      if (event.state === 'start') { phase.started = this.#clock(); phase.outcome = 'running'; }
      else if (event.state === 'end') {
        phase.durationMs = duration(event.durationMs) ? event.durationMs : Math.max(0, this.#clock() - (phase.started ?? this.#clock()));
        phase.started = null;
        phase.outcome = Object.hasOwn(OUTCOMES, event.outcome) && event.outcome !== 'running' ? event.outcome : 'error';
      }
    } else if (event.type === 'request') {
      const phase = this.#phase(event.stage); if (!phase) return;
      phase.requests++;
      if (duration(event.durationMs)) phase.requestMs += event.durationMs;
      if (integer(event.responseBytes)) { phase.responseBytes += event.responseBytes; phase.measuredResponses++; }
      if (duration(event.decodeMs)) phase.decodeMs += event.decodeMs;
      if (Number.isInteger(event.status) && event.status >= 100 && event.status <= 599) phase.status = event.status;
      if (event.outcome === 'error' || event.outcome === 'cancelled') phase.failures++;
    } else if (event.type === 'tasks') {
      const tasks = {};
      for (const key of TASK_KEYS) if (integer(event[key])) tasks[key] = event[key];
      this.#tasks = tasks;
    } else if (event.type === 'download') {
      for (const key of ['rows', 'pages']) if (integer(event[key])) this.#transfer[key] = event[key];
    }
  }
  finish(outcome) {
    if (this.#end !== null) return this.snapshot();
    const now = this.#clock(); this.#end = now;
    this.#outcome = ['success', 'error', 'cancelled'].includes(outcome) ? outcome : 'error';
    for (const phase of this.#phases.values()) if (phase.started !== null) {
      phase.durationMs = Math.max(0, now - phase.started); phase.started = null; phase.outcome = this.#outcome;
    }
    return this.snapshot();
  }
  snapshot() {
    const now = this.#end ?? this.#clock();
    return {
      schema: 'iseq-timings-1', operation: this.#operation, outcome: this.#outcome,
      durationMs: round(Math.max(0, now - this.#start)),
      phases: [...this.#phases.values()].map(p => ({
        stage: p.stage, outcome: p.outcome,
        durationMs: round(p.started === null ? p.durationMs : Math.max(0, now - p.started)),
        requests: p.requests, requestMs: round(p.requestMs), responseBytes: p.responseBytes,
        measuredResponses: p.measuredResponses, decodeMs: round(p.decodeMs), failures: p.failures, status: p.status,
      })), tasks: { ...this.#tasks }, transfer: { ...this.#transfer },
    };
  }
}

export function formatIseqReport(report) {
  // Rebuild text from a closed vocabulary; never stringify incoming events/errors.
  const lines = [`ISEQ · ${OPERATIONS[report.operation] || 'Operação'}`, `Resultado: ${OUTCOMES[report.outcome] || 'interrompido'}`, `Tempo total: ${formatIseqDuration(report.durationMs)}`];
  for (const p of report.phases || []) {
    if (!Object.hasOwn(ISEQ_PHASES, p.stage)) continue;
    lines.push(`${ISEQ_PHASES[p.stage]}: ${formatIseqDuration(p.durationMs)} · ${OUTCOMES[p.outcome] || 'interrompido'} · ${p.requests} ${p.requests === 1 ? 'requisição' : 'requisições'}${p.status ? ` · HTTP ${p.status}` : ''}`);
    if (p.measuredResponses) lines.push(`  Conteúdo recebido: ${p.responseBytes} bytes em ${p.measuredResponses} respostas medidas · decodificação: ${formatIseqDuration(p.decodeMs)}`);
    if (p.failures) lines.push(`  Requisições interrompidas: ${p.failures}`);
  }
  const labels = { total: 'Etapas totais', completed: 'Concluídas', cached: 'Reutilizadas', downloads: 'Consultas novas', attempted: 'Etapas tentadas', workers: 'Consultas simultâneas', failedAttempts: 'Tentativas com falha' };
  for (const key of TASK_KEYS) if (integer(report.tasks?.[key])) lines.push(`${labels[key]}: ${report.tasks[key]}`);
  if (integer(report.transfer?.rows)) lines.push(`Linhas recebidas: ${report.transfer.rows}`);
  if (integer(report.transfer?.pages)) lines.push(`Páginas recebidas: ${report.transfer.pages}`);
  lines.push('Diagnóstico transitório: somente tempos e contagens.');
  return lines.join('\n');
}
