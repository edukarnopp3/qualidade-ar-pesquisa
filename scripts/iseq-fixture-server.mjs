/**
 * Backend HTTP exclusivamente sintético; nunca acessa ISEQ nem outro serviço.
 * Uso: node scripts/iseq-fixture-server.mjs [--port=8877]
 * No formulário, use http://127.0.0.1:8877/uncached (ou um cenário abaixo),
 * usuário e senha "sintetico". Período de exemplo: 01/10/2026 a 01/10/2026.
 * Marque os dados como sintéticos na conferência da importação.
 * Cenários: warmup, cached, uncached, legacy, bad-counts, auth-fail,
 * pending-health. Reiniciar o processo reinicia o cenário de aquecimento.
 * Sem persistência, logs de requisições/corpos ou chamadas de rede externas.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const FIXTURE_EQUIPMENT = 'SINTETICO-SEM-SENSOR-REAL';
export const FIXTURE_TOKEN = 'sessao-ficticia-sem-acesso-real';
export const FIXTURE_SCENARIOS = Object.freeze(['warmup', 'cached', 'uncached', 'legacy', 'bad-counts', 'auth-fail', 'pending-health']);
const equipment = [{ mac: FIXTURE_EQUIPMENT, label: 'DADOS SINTÉTICOS · sensor fictício', location: 'Ambiente de teste sem medições reais' }];

export function syntheticRows(count = 288) {
  if (!Number.isInteger(count) || count < 0 || count > 100000) throw new RangeError('Quantidade sintética fora do limite.');
  return Array.from({ length: count }, (_, i) => ({
    data_local: new Date(Date.UTC(2026, 9, 1, 0, i * 5)).toISOString().slice(0, 19),
    sensor_id: FIXTURE_EQUIPMENT,
    CO2: 450 + i % 500, 'PM2.5': 5 + i % 12, PM1: 2 + i % 7, PM10: 10 + i % 20,
    Temp: 22 + (i % 20) / 10, Umid: 45 + i % 15, Pressao: 1013,
    VOC: 80 + i % 40, NOx: 20 + i % 15, origem: 'DADOS INTEGRALMENTE SINTÉTICOS',
  }));
}

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol)
      && (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || origin === 'https://edukarnopp3.github.io');
  } catch { return false; }
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function createFixtureServer() {
  const states = new Map(FIXTURE_SCENARIOS.map(scenario => [scenario, { healthRequests: 0, polls: 0, workers: 2, hasJob: false }]));
  const rows = syntheticRows();
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!allowedOrigin(origin)) { response.writeHead(403); response.end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (origin && request.headers['access-control-request-private-network'] === 'true') response.setHeader('Access-Control-Allow-Private-Network', 'true');
    const send = (status, payload) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(payload));
    };
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const [, scenario, ...parts] = url.pathname.split('/');
      const route = `/${parts.join('/')}`;
      const state = states.get(scenario);
      if (!state) return send(404, { detail: 'Escolha um cenário sintético documentado no script.' });
      if (route === '/api/health' && request.method === 'GET') {
        state.healthRequests++;
        if (scenario === 'legacy') return send(404, { detail: 'Rota de prontidão ausente no contrato legado sintético.' });
        if (scenario === 'pending-health') {
          const timer = setTimeout(() => send(200, { status: 'ok', auth_ready: true }), 120000);
          response.once('close', () => clearTimeout(timer));
          return;
        }
        if (scenario === 'warmup' && state.healthRequests <= 2) {
          response.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end('<!doctype html><title>Inicialização sintética</title><p>Inicialização sintética do serviço.</p>');
          return;
        }
        return send(200, { status: 'ok', auth_ready: true, database: 'synthetic-memory', persistent_storage: false });
      }
      if (route === '/api/auth/iseq/login' && request.method === 'POST') {
        const body = await readBody(request);
        if (scenario === 'auth-fail' || body.username_or_email !== 'sintetico' || body.password !== 'sintetico') {
          return send(401, { detail: { code: 'invalid_iseq_credentials', message: 'Fixture aceita somente usuário e senha sintéticos documentados.' } });
        }
        return send(200, { session_token: FIXTURE_TOKEN, equipment });
      }
      if (request.headers.authorization !== `Bearer ${FIXTURE_TOKEN}`) return send(401, { detail: { code: 'session_invalid', message: 'Sessão sintética necessária.' } });
      if (route === '/api/auth/logout' && request.method === 'POST') return send(200, { ok: true });
      if (route === '/api/iseq/equipment' && request.method === 'GET') return send(200, { equipment });
      const job = () => {
        const completed = scenario === 'cached' ? 9 : Math.min(9, 3 + state.polls * 2);
        const status = completed === 9 ? 'completed' : 'running';
        const basic = { id: 'job-sintetico', status, message: status === 'completed' ? 'Histórico sintético pronto.' : 'Obtendo tarefas sintéticas.' };
        if (scenario === 'legacy') return basic;
        return {
          ...basic, total_tasks: 9, completed_tasks: scenario === 'bad-counts' ? 12 : completed,
          cached_tasks: scenario === 'cached' ? 9 : 3, download_tasks: scenario === 'cached' ? 0 : 6,
          attempted_tasks: scenario === 'cached' ? 0 : completed - 3,
          failed_attempts: 0, worker_count: state.workers,
        };
      };
      if (route === '/api/iseq/jobs' && request.method === 'POST') {
        const body = await readBody(request);
        if (body.equipment_id !== FIXTURE_EQUIPMENT || ![2, 3].includes(body.workers)) return send(400, { detail: 'Use o sensor sintético e dois ou três workers.' });
        state.workers = body.workers;
        state.polls = 0;
        state.hasJob = true;
        return send(200, job());
      }
      if (!state.hasJob) return send(404, { detail: 'Nenhum job sintético iniciado.' });
      if (route === '/api/iseq/jobs/job-sintetico' && request.method === 'GET') { state.polls++; return send(200, job()); }
      if (route === '/api/iseq/jobs/job-sintetico/data' && request.method === 'GET') {
        if (job().status !== 'completed') return send(409, { detail: 'Job sintético ainda em execução.' });
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Number(url.searchParams.get('limit') || 25000);
        if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 25000) return send(400, { detail: 'Paginação inválida.' });
        return send(200, { rows: rows.slice(offset, offset + limit), offset, has_more: offset + limit < rows.length });
      }
      return send(404, { detail: 'Rota sintética inexistente.' });
    } catch { send(400, { detail: 'Requisição sintética inválida.' }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portArgument = process.argv.slice(2).find(value => value.startsWith('--port='));
  const port = portArgument ? Number(portArgument.slice(7)) : 8877;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new RangeError('Porta de fixture inválida.');
  const server = createFixtureServer();
  server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ fixture: 'ISEQ sintética; sem rede externa', port, scenarios: FIXTURE_SCENARIOS })));
  const stop = () => { server.closeAllConnections(); server.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
