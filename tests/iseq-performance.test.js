import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ISEQ_BACKEND, IseqClient } from '../src/iseq.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const loginData = { session_token: 'synthetic-session-secret', equipment: [] };
const client = (fetcher, options = {}, base = 'https://synthetic.invalid') => new IseqClient(base, fetcher, { requestTimeoutMs: 200, operationTimeoutMs: 2000, healthTimeoutMs: 1000, healthPollIntervalMs: 1, pollIntervalMs: 1, ...options });
const login = (instance, signal, observer) => instance.login('synthetic-private-user', 'synthetic-private-password', signal, observer);
const history = (instance, observer, signal) => instance.historical('synthetic-private-sensor', '2026-10-01', '2026-10-02', signal, () => {}, observer);
const code = expected => error => error.code === expected;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

test('health é inerte até login, público e precede o único POST de credenciais', async () => {
  const calls = [], events = [];
  const instance = client(async (url, options) => {
    calls.push({ url, options });
    return json(url.endsWith('/health') ? { status: 'ok', auth_ready: true } : loginData);
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await login(instance, undefined, event => events.push(event)), []);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(calls[0].options.headers, {});
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(events.filter(event => event.type === 'stage').map(({ stage, state, outcome }) => [stage, state, outcome]), [
    ['health', 'start', undefined], ['health', 'end', 'success'], ['login', 'start', undefined], ['login', 'end', 'success'],
  ]);
});

test('health pode superar o prazo normal com retries; login nunca é reenviado', async () => {
  let healthCalls = 0, posts = 0;
  const instance = client(async (url, options) => {
    if (url.endsWith('/health')) {
      healthCalls++;
      if (healthCalls === 1) return new Promise(() => {});
      if (healthCalls === 2) return new Response('<html>Application loading</html>', { headers: { 'Content-Type': 'text/html' } });
      if (healthCalls === 3) return json({ detail: 'Serviço indisponível' }, 503);
      if (healthCalls === 4) throw new TypeError('Network startup');
      return json({ status: 'ok' });
    }
    if (options.method === 'POST') posts++;
    return json({ detail: 'Login recusado' }, 403);
  }, { requestTimeoutMs: 10 });
  await assert.rejects(login(instance), code('http_error'));
  assert.equal(healthCalls, 5);
  assert.equal(posts, 1);
  assert.equal(instance.hasSession, false);
});

test('health sem auth_ready é compatível; equipment ausente faz uma consulta própria', async () => {
  const paths = [], events = [];
  const instance = client(async url => {
    paths.push(new URL(url).pathname);
    if (url.endsWith('/health')) return json({ status: 'ok' });
    if (url.endsWith('/login')) return json({ session_token: 'synthetic-session-secret' });
    return json({ equipment: [] });
  });
  await login(instance, undefined, event => events.push(event));
  assert.deepEqual(paths, ['/api/health', '/api/auth/iseq/login', '/api/iseq/equipment']);
  assert.ok(events.some(event => event.type === 'stage' && event.stage === 'equipment' && event.outcome === 'success'));
});

test('health auth_ready false ou esquema incompatível bloqueia a senha', async () => {
  for (const [payload, expected] of [
    [{ status: 'ok', auth_ready: false }, 'backend_not_ready'],
    [{ status: 'ok', auth_ready: 'true' }, 'invalid_schema'],
    [{ status: 'loading', auth_ready: true }, 'invalid_schema'],
    [{}, 'invalid_schema'],
  ]) {
    let calls = 0;
    const instance = client(async () => { calls++; return json(payload); });
    await assert.rejects(login(instance), code(expected));
    assert.equal(calls, 1);
    assert.equal(instance.hasSession, false);
  }
});

test('404/405 do health customizado tem fallback explícito; backend padrão não tem', async () => {
  for (const status of [404, 405]) {
    const events = []; let posts = 0;
    const instance = client(async url => {
      if (url.endsWith('/health')) return new Response('<html>Not found</html>', { status, headers: { 'Content-Type': 'text/html' } });
      posts++; return json(loginData);
    });
    await login(instance, undefined, event => events.push(event));
    assert.equal(posts, 1);
    assert.ok(events.some(event => event.stage === 'health' && event.outcome === 'unavailable'));
    let defaultCalls = 0;
    await assert.rejects(login(client(async () => { defaultCalls++; return json({ detail: 'Ausente' }, status); }, {}, DEFAULT_ISEQ_BACKEND)), error => error.status === status);
    assert.equal(defaultCalls, 1);
  }
});

test('health interrompido por cancelamento, prazo ou clearSession nunca envia senha tardia', async () => {
  for (const mode of ['abort', 'timeout', 'clear']) {
    const gate = deferred(), controller = new AbortController();
    let calls = 0;
    const instance = client(async () => { calls++; return gate.promise; }, { healthTimeoutMs: mode === 'timeout' ? 15 : 500 });
    const attempt = login(instance, controller.signal);
    await new Promise(resolve => setImmediate(resolve));
    if (mode === 'abort') controller.abort();
    if (mode === 'clear') { instance.clearSession(); gate.resolve(json({ status: 'ok' })); }
    await assert.rejects(attempt, code(mode === 'timeout' ? 'health_timeout' : 'cancelled'));
    if (mode !== 'clear') gate.resolve(json({ status: 'ok' }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1, mode);
    assert.equal(instance.hasSession, false);
  }
});

test('health aguarda corpo pendente com prazo total e publica fim de erro', async () => {
  const events = []; let posted = false;
  const instance = client(async (_url, options) => {
    if (options.method === 'POST') posted = true;
    return { ok: true, status: 200, json: async () => new Promise(() => {}) };
  }, { healthTimeoutMs: 15 });
  await assert.rejects(login(instance, undefined, event => events.push(event)), code('health_timeout'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(posted, false);
  assert.ok(events.some(event => event.type === 'stage' && event.stage === 'health' && event.outcome === 'error'));
});

test('observer síncrono ou assíncrono defeituoso não interrompe login ou histórico', async () => {
  for (const observer of [() => { throw new Error('Observer quebrado'); }, async () => { throw new Error('Observer assíncrono quebrado'); }]) {
    const instance = client(async url => json(url.endsWith('/health') ? { status: 'ok' } : url.endsWith('/login') ? loginData : url.endsWith('/jobs') ? { id: 'synthetic-job', status: 'completed' } : { rows: [], has_more: false }));
    await login(instance, undefined, observer);
    assert.deepEqual((await history(instance, observer)).rows, []);
  }
});

test('job já concluído usa status da criação, mostra cache e evita GET de polling', async () => {
  const paths = [], events = [];
  const instance = client(async url => {
    paths.push(new URL(url).pathname);
    return json(url.endsWith('/jobs') ? { id: 'synthetic-job', status: 'completed', total_tasks: 9, completed_tasks: 9, cached_tasks: 9, download_tasks: 0, attempted_tasks: 0, worker_count: 2, failed_attempts: 0, tasks: [{ private: 'must-not-leak' }] } : { rows: [{ CO2: 640 }], has_more: false });
  });
  assert.equal((await history(instance, event => events.push(event))).rows.length, 1);
  assert.deepEqual(paths, ['/api/iseq/jobs', '/api/iseq/jobs/synthetic-job/data']);
  assert.deepEqual(events.find(event => event.type === 'tasks'), { type: 'tasks', total: 9, completed: 9, cached: 9, downloads: 0, attempted: 0, workers: 2, failedAttempts: 0 });
  assert.deepEqual(events.find(event => event.type === 'download'), { type: 'download', rows: 1, pages: 1 });
});

test('contagens inválidas ou inconsistentes impedem download e percentuais inventados', async () => {
  for (const counts of [
    { total_tasks: '9' }, { total_tasks: -1 }, { completed_tasks: 0.5 }, { cached_tasks: Number.MAX_SAFE_INTEGER + 1 },
    { total_tasks: 9, completed_tasks: 10 }, { total_tasks: 9, cached_tasks: 9, download_tasks: 1 },
    { total_tasks: 9, completed_tasks: 8 }, { completed_tasks: 9, cached_tasks: 3, attempted_tasks: 5 },
    { cached_tasks: 3, completed_tasks: 2 }, { attempted_tasks: 5, download_tasks: 4 }, { worker_count: 0 }, { failed_attempts: null },
  ]) {
    let calls = 0; const events = [];
    const instance = client(async () => { calls++; return json({ id: 'synthetic-job', status: 'completed', ...counts }); });
    await assert.rejects(history(instance, event => events.push(event)), code('invalid_schema'));
    assert.equal(calls, 1);
    assert.equal(events.some(event => event.type === 'tasks'), false);
  }
});

test('legado sem contagens continua; polling parcial conserva downloads como total novo', async () => {
  let polls = 0; const events = [];
  const instance = client(async url => {
    if (url.endsWith('/jobs')) return json({ id: 'synthetic-job' });
    if (url.endsWith('/synthetic-job')) return json(++polls === 1 ? { status: 'running', total_tasks: 9, completed_tasks: 6, cached_tasks: 3, download_tasks: 6, attempted_tasks: 4 } : { status: 'completed' });
    return json({ rows: [], has_more: false });
  });
  await history(instance, event => events.push(event));
  assert.equal(polls, 2);
  assert.equal(events.find(event => event.type === 'tasks').downloads, 6);
  assert.ok(events.some(event => event.type === 'stage' && event.stage === 'history' && event.outcome === 'success'));
});

test('métricas medem corpo JSON decodificado e não contêm segredos, leituras, URLs ou tarefas', async () => {
  const events = [];
  const privateHistory = { id: 'synthetic-private-job', status: 'completed', message: 'private-server-message', tasks: [{ mac: 'private-mac' }] };
  const instance = client(async url => json(url.endsWith('/health') ? { status: 'ok' } : url.endsWith('/login') ? loginData : url.endsWith('/jobs') ? privateHistory : { rows: [{ CO2: 647.321987 }], has_more: false }));
  await login(instance, undefined, event => events.push(event));
  await history(instance, event => events.push(event));
  const requests = events.filter(event => event.type === 'request');
  assert.equal(requests.length, 4);
  for (const event of requests) {
    assert.equal(event.status, 200);
    assert.equal(event.outcome, 'success');
    assert.ok(Number.isSafeInteger(event.responseBytes) && event.responseBytes > 0);
    assert.ok(Number.isFinite(event.durationMs) && event.durationMs >= 0);
    assert.ok(Number.isFinite(event.decodeMs) && event.decodeMs >= 0);
    assert.deepEqual(Object.keys(event).sort(), ['decodeMs', 'durationMs', 'outcome', 'responseBytes', 'stage', 'status', 'type'].sort());
  }
  assert.equal(requests[1].responseBytes, new TextEncoder().encode(JSON.stringify(loginData)).byteLength);
  const diagnostic = JSON.stringify(events);
  for (const secret of ['synthetic-private-user', 'synthetic-private-password', 'synthetic-session-secret', 'synthetic-private-sensor', 'synthetic-private-job', 'private-server-message', 'private-mac', '647.321987', 'https://', 'CO2']) assert.equal(diagnostic.includes(secret), false, secret);
});

test('worker configurável continua em 2 por padrão e valida intervalo antes da rede', async () => {
  for (const setting of [undefined, 1, 2, 3, 6]) {
    let workers;
    const instance = client(async (url, options) => {
      if (url.endsWith('/jobs')) { workers = JSON.parse(options.body).workers; return json({ id: 'synthetic-job', status: 'completed' }); }
      return json({ rows: [], has_more: false });
    }, setting === undefined ? {} : { workers: setting });
    await history(instance);
    assert.equal(workers, setting ?? 2);
  }
  for (const workers of [0, 7, 2.5, '3', Infinity]) assert.throws(() => client(async () => { throw new Error('Nunca deve chamar rede'); }, { workers }), code('invalid_configuration'));
});

test('falha de HTTP preserva estado numérico sem copiar detail ou code remoto no observer', async () => {
  const events = [];
  const instance = client(async () => json({ detail: { message: 'PRIVATE-UPSTREAM-DETAIL', code: 'PRIVATE-UPSTREAM-CODE' } }, 429));
  await assert.rejects(history(instance, event => events.push(event)), code('PRIVATE-UPSTREAM-CODE'));
  const request = events.find(event => event.type === 'request');
  assert.equal(request.status, 429);
  assert.equal(request.outcome, 'error');
  assert.equal(JSON.stringify(events).includes('PRIVATE'), false);
});

test('cancelar durante pausa de health encerra prontamente sem novos requests', async () => {
  const controller = new AbortController(); let calls = 0;
  const instance = client(async () => { calls++; return json({ detail: 'Iniciando' }, 503); }, { healthPollIntervalMs: 500 });
  const attempt = login(instance, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(attempt, code('cancelled'));
  assert.equal(calls, 1);
});

test('login antigo não envia senha quando nova tentativa conclui durante health pendente', async () => {
  const oldHealth = deferred(); let healthCalls = 0, loginCalls = 0;
  const instance = client(async url => {
    if (url.endsWith('/health')) return ++healthCalls === 1 ? oldHealth.promise : json({ status: 'ok' });
    loginCalls++;
    return json(loginData);
  });
  const first = login(instance);
  await new Promise(resolve => setImmediate(resolve));
  await login(instance);
  oldHealth.resolve(json({ status: 'ok' }));
  await assert.rejects(first, code('cancelled'));
  assert.equal(loginCalls, 1);
  assert.equal(instance.hasSession, true);
});
