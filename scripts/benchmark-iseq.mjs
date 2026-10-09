/**
 * Uso: node scripts/benchmark-iseq.mjs > caminho-local/benchmark-iseq.json
 * Não recebe URL/credenciais reais. Usa IseqClient com transporte sintético
 * injetado, sem abrir conexões. Cada repetição isola o cache; a segunda
 * consulta reutiliza apenas o cache da mesma repetição. O relógio/tarefas são
 * determinísticos, mas as durações medidas variam com o escalonamento local.
 * Comparação 2/3 não altera o padrão de workers da aplicação.
 */
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { IseqClient } from '../src/iseq.js';
import { FIXTURE_EQUIPMENT, FIXTURE_TOKEN, syntheticRows } from './iseq-fixture-server.mjs';

const repetitions = 5;
const totalTasks = 9;
const taskLatencyMs = 40;
const transportLatencyMs = 2;
const round = value => Math.round(value * 100) / 100;
const median = values => { const sorted = [...values].sort((a, b) => a - b); return round(sorted[Math.floor(sorted.length / 2)]); };

function syntheticTransport(rows, { expectedWorkers, total = totalTasks } = {}) {
  let cached = false, currentJob = null, jobCount = 0;
  const measurements = { requests: 0, polls: 0, pages: 0, responseBytes: 0, errors: 0, retries: 0, tasksDownloaded: 0, tasksCached: 0 };
  const response = body => {
    const text = JSON.stringify(body);
    measurements.responseBytes += Buffer.byteLength(text);
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const status = () => {
    if (!currentJob) throw new Error('Job sintético ausente.');
    const completed = currentJob.cached ? total : Math.min(total, Math.floor((performance.now() - currentJob.started) / taskLatencyMs) * currentJob.workers);
    if (completed === total) cached = true;
    return {
      id: `job-sintetico-${jobCount}`, status: completed === total ? 'completed' : 'running',
      message: 'Execução integralmente sintética.', total_tasks: total, completed_tasks: completed,
      cached_tasks: currentJob.cached ? total : 0, download_tasks: currentJob.cached ? 0 : total,
      attempted_tasks: currentJob.cached ? 0 : Math.min(total, completed + currentJob.workers), failed_attempts: 0,
      worker_count: currentJob.workers,
      // Exercita o peso da lista no endpoint atual sem conter identificadores.
      tasks: Array.from({ length: total }, (_, i) => ({ status: i < completed ? 'completed' : 'pending', attempts: currentJob.cached ? 0 : 1 })),
    };
  };
  return {
    measurements,
    async fetch(url, options = {}) {
      const address = new URL(url);
      if (address.origin !== 'https://sintetico.invalid') throw new Error('Benchmark bloqueou destino não sintético.');
      measurements.requests++;
      await wait(transportLatencyMs, undefined, { signal: options.signal });
      if (address.pathname === '/api/health') return response({ status: 'ok', auth_ready: true });
      if (address.pathname === '/api/auth/iseq/login') {
        const body = JSON.parse(options.body);
        if (body.username_or_email !== 'sintetico' || body.password !== 'sintetico') throw new Error('Benchmark rejeitou credenciais externas.');
        return response({ session_token: FIXTURE_TOKEN, equipment: [{ mac: FIXTURE_EQUIPMENT, label: 'Dados sintéticos' }] });
      }
      if (address.pathname === '/api/auth/logout') return response({ ok: true });
      if (options.headers?.Authorization !== `Bearer ${FIXTURE_TOKEN}`) throw new Error('Sessão sintética ausente.');
      if (address.pathname === '/api/iseq/jobs') {
        const body = JSON.parse(options.body);
        if (body.workers !== expectedWorkers) throw new Error('Cliente não enviou o paralelismo solicitado pelo benchmark.');
        currentJob = { cached, workers: body.workers, started: performance.now() };
        jobCount++;
        measurements.tasksDownloaded += cached ? 0 : total;
        measurements.tasksCached += cached ? total : 0;
        return response(status());
      }
      if (address.pathname === `/api/iseq/jobs/job-sintetico-${jobCount}`) { measurements.polls++; return response(status()); }
      if (address.pathname === `/api/iseq/jobs/job-sintetico-${jobCount}/data`) {
        if (status().status !== 'completed') throw new Error('Consulta sintética prematura de dados.');
        measurements.pages++;
        const offset = Number(address.searchParams.get('offset'));
        const limit = Number(address.searchParams.get('limit'));
        return response({ rows: rows.slice(offset, offset + limit), offset, has_more: offset + limit < rows.length });
      }
      throw new Error('Rota inesperada no transporte sintético.');
    },
  };
}

async function scenario(workers, rows, total = totalTasks) {
  const transport = syntheticTransport(rows, { expectedWorkers: workers, total });
  const client = new IseqClient('https://sintetico.invalid', transport.fetch, {
    workers, pollIntervalMs: 10, requestTimeoutMs: 2000, operationTimeoutMs: 10000,
  });
  await client.login('sintetico', 'sintetico');
  const run = async () => {
    const before = { ...transport.measurements };
    const started = performance.now();
    const result = await client.historical(FIXTURE_EQUIPMENT, '2026-10-01', '2026-10-01');
    if (result.rows.length !== rows.length) throw new Error('Quantidade de linhas divergiu na simulação.');
    return {
      durationMs: round(performance.now() - started), rows: result.rows.length,
      ...Object.fromEntries(Object.entries(transport.measurements).map(([key, value]) => [key, value - before[key]])),
    };
  };
  const first = await run();
  const repeated = await run();
  await client.logout();
  return { first, repeated };
}

function summarize(runs, field) {
  const rows = runs.map(run => run[field]);
  return Object.fromEntries(Object.keys(rows[0]).map(key => [`${key}Median`, median(rows.map(row => row[key]))]));
}

async function preparation(count) {
  const rows = syntheticRows(count);
  const samples = [];
  for (let i = 0; i < repetitions; i++) {
    let at = performance.now();
    const json = JSON.stringify({ rows });
    const serializeMs = performance.now() - at;
    at = performance.now();
    const bytes = new TextEncoder().encode(json);
    const encodeMs = performance.now() - at;
    at = performance.now();
    const parsed = JSON.parse(json);
    const parseMs = performance.now() - at;
    at = performance.now();
    createHash('sha256').update(bytes).digest();
    const hashMs = performance.now() - at;
    if (parsed.rows.length !== count) throw new Error('Volume sintético divergente.');
    samples.push({ serializeMs, encodeMs, parseMs, hashMs, bytes: bytes.length });
  }
  return { rows: count, ...Object.fromEntries(Object.keys(samples[0]).map(key => [`${key}Median`, median(samples.map(sample => sample[key]))])) };
}

function statusPayload(total) {
  const payload = {
    status: 'running', total_tasks: total, completed_tasks: 0, cached_tasks: 0,
    download_tasks: total, attempted_tasks: 0, failed_attempts: 0, worker_count: 2,
    tasks: Array.from({ length: total }, (_, i) => ({
      parameter: `parametro-sintetico-${i % 9}`, start: '2026-10-01T00:00:00', end: '2026-10-01T23:59:59',
      status: 'pending', attempts: 0, last_error: null, next_retry_at: null, file_path: null,
    })),
  };
  const text = JSON.stringify(payload);
  const samples = [];
  for (let i = 0; i < repetitions; i++) {
    const at = performance.now();
    const parsed = JSON.parse(text);
    samples.push(performance.now() - at);
    if (parsed.tasks.length !== total) throw new Error('Payload de status sintético divergente.');
  }
  return { tasks: total, responseBytes: Buffer.byteLength(text), parseMsMedian: median(samples) };
}

const comparison = [];
const smallRows = syntheticRows(288);
const groups = new Map([[2, []], [3, []]]);
// Alterna a ordem para reduzir viés de aquecimento do processo.
for (let i = 0; i < repetitions; i++) for (const workers of i % 2 ? [3, 2] : [2, 3]) groups.get(workers).push(await scenario(workers, smallRows));
for (const [workers, runs] of groups) comparison.push({ workers, uncached: summarize(runs, 'first'), cachedRepeat: summarize(runs, 'repeated') });
const largeTransfer = await scenario(2, syntheticRows(100000), 0);
const localPreparation = [await preparation(1000), await preparation(100000)];
console.log(JSON.stringify({
  notice: 'simulado; não prova desempenho ISEQ real',
  repetitions, totalTasks, taskLatencyMs, transportLatencyMs,
  defaultWorkersUnchanged: 2, networkRequestsToRealISEQ: 0,
  failuresAndRetriesAreSynthetic: true, comparison,
  pagination100000Rows: largeTransfer.first,
  statusPayloads: [statusPayload(9), statusPayload(3285)],
  localPreparation,
}, null, 2));
