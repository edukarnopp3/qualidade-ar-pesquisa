import test from 'node:test';
import assert from 'node:assert/strict';
import { IseqClient, IseqError } from '../src/iseq.js';

const response = (payload, status = 200, contentType = 'application/json; charset=utf-8') => ({ ok: status >= 200 && status < 300, status, headers: new Headers({ 'Content-Type': contentType }), json: async () => payload });
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value; }); return { resolve, promise }; };
const pending = () => new Promise(() => {});
const equipment = [{ mac: 'SYNTHETIC-SCHOOL', label: 'Escola sintética' }];
const loginPayload = { session_token: 'synthetic-token', equipment };
const client = (fetcher, options = {}) => new IseqClient('https://example.invalid', fetcher, { healthCheck: false, requestTimeoutMs: 500, operationTimeoutMs: 2000, pollIntervalMs: 1, logoutTimeoutMs: 30, ...options });
const historical = (instance, signal, progress) => instance.historical('SYNTHETIC-SCHOOL', '2026-10-01T00:00:00', '2026-10-02T00:00:00', signal, progress);
const codeIs = code => error => error instanceof IseqError && error.code === code;

test('ISEQ-01: login pendente termina por timeout e não estabelece sessão', { timeout: 1000 }, async () => {
  let requestSignal;
  const instance = client(async (_url, options) => { requestSignal = options.signal; return pending(); }, { requestTimeoutMs: 20 });
  await assert.rejects(instance.login('synthetic-user', 'synthetic-password'), codeIs('request_timeout'));
  assert.equal(requestSignal.aborted, true);
  assert.equal(instance.hasSession, false);
});

test('ISEQ-01/02: o prazo também cobre o leitor de corpo que não responde', { timeout: 1000 }, async () => {
  let requestSignal;
  const instance = client(async (_url, options) => { requestSignal = options.signal; return { ...response({}), json: pending }; }, { requestTimeoutMs: 20 });
  await assert.rejects(instance.login('synthetic-user', 'synthetic-password'), codeIs('request_timeout'));
  assert.equal(requestSignal.aborted, true);
  assert.equal(instance.hasSession, false);
});

test('ISEQ-02: o prazo integral inclui criação, polling, leitura e paginação', { timeout: 2000 }, async () => {
  for (const stalledPhase of ['create', 'poll', 'body', 'page']) {
    const instance = client(async url => {
      if (url.endsWith('/jobs')) return stalledPhase === 'create' ? pending() : response({ id: 'job' });
      if (url.endsWith('/job')) return stalledPhase === 'poll' ? pending() : stalledPhase === 'body' ? { ...response({}), json: pending } : response({ status: 'completed' });
      return pending();
    }, { requestTimeoutMs: 500, operationTimeoutMs: 20 });
    await assert.rejects(historical(instance), codeIs('operation_timeout'), stalledPhase);
  }
});

test('ISEQ-02: prazo integral alcança a segunda página depois de uma página válida', { timeout: 1000 }, async () => {
  let calls = 0;
  const instance = client(async url => {
    if (url.endsWith('/jobs')) return response({ id: 'job' });
    if (url.endsWith('/job')) return response({ status: 'completed' });
    return calls++ === 0 ? response({ rows: [{ CO2: 600 }], has_more: true, offset: 0 }) : pending();
  }, { requestTimeoutMs: 500, operationTimeoutMs: 20 });
  await assert.rejects(historical(instance), codeIs('operation_timeout'));
  assert.equal(calls, 2);
});

test('ISEQ-01/02: prazo integral do login inclui lista complementar e remove token provisório', { timeout: 1000 }, async () => {
  const instance = client(async url => url.endsWith('/login') ? response({ session_token: 'synthetic-token' }) : pending(), { requestTimeoutMs: 500, operationTimeoutMs: 20 });
  await assert.rejects(instance.login('synthetic-user', 'synthetic-password'), codeIs('operation_timeout'));
  assert.equal(instance.hasSession, false);
});

test('ISEQ-03/06: detail estruturado preserva código/status/mensagem e limpa sessão', async () => {
  let expired = false;
  const instance = client(async () => expired ? response({ detail: { code: 'session_invalid', message: 'Sua sessão terminou. Entre novamente.' } }, 401) : response(loginPayload));
  await instance.login('synthetic-user', 'synthetic-password');
  assert.equal(instance.hasSession, true);
  expired = true;
  await assert.rejects(instance.request('/api/iseq/equipment'), error => error instanceof IseqError && error.code === 'session_invalid' && error.status === 401 && error.message === 'Sua sessão terminou. Entre novamente.');
  assert.equal(instance.hasSession, false);
});

test('ISEQ-03: erro detail string e erro de rede têm diagnóstico próprio', async () => {
  await assert.rejects(client(async () => response({ detail: 'Erro explícito' }, 403)).request('/api/iseq/equipment'), error => error.message === 'Erro explícito' && error.status === 403 && error.code === 'http_error');
  await assert.rejects(client(async () => { throw new TypeError('Failed to fetch'); }).request('/api/health'), codeIs('network_error'));
});

test('ISEQ-04: HTML, JSON inválido e array no envelope não viram conjunto vazio', async () => {
  const invalidResponses = [response('<html>Loading</html>', 200, 'text/html'), { ...response({}), json: async () => { throw new SyntaxError('HTML is not JSON'); } }, response([])];
  for (const invalid of invalidResponses) {
    await assert.rejects(client(async () => invalid).login('synthetic-user', 'synthetic-password'), error => ['invalid_json', 'invalid_schema'].includes(error.code));
    const instance = client(async url => url.endsWith('/jobs') ? response({ id: 'job' }) : url.endsWith('/job') ? response({ status: 'completed' }) : invalid);
    await assert.rejects(historical(instance), error => ['invalid_json', 'invalid_schema'].includes(error.code));
  }
});

test('ISEQ-04: esquema de sessão, sensor, status e página é validado', async () => {
  for (const payload of [{ session_token: {} }, { session_token: 'token', equipment: {} }, { session_token: 'token', equipment: [{ label: 'Sem MAC' }] }, { session_token: 'token', equipment: [{ mac: 'A' }, { mac: 'a' }] }]) await assert.rejects(client(async () => response(payload)).login('synthetic-user', 'synthetic-password'), codeIs('invalid_schema'));
  for (const invalid of [{ rows: [] }, { rows: null, has_more: false }, { rows: [null], has_more: false }, { rows: [], has_more: true }, { rows: [{ CO2: 500 }], has_more: false, offset: 50 }]) {
    const instance = client(async url => url.endsWith('/jobs') ? response({ id: 'job' }) : url.endsWith('/job') ? response({ status: 'completed' }) : response(invalid));
    await assert.rejects(historical(instance), codeIs('invalid_schema'));
  }
  await assert.rejects(historical(client(async url => response(url.endsWith('/jobs') ? { id: 'job' } : {}))), codeIs('invalid_schema'));
});

test('ISEQ-05: abort externo encerra login mesmo com transporte que ignora signal', async () => {
  const gate = deferred(), controller = new AbortController();
  const instance = client(async () => gate.promise);
  const attempt = instance.login('synthetic-user', 'synthetic-password', controller.signal);
  controller.abort();
  await assert.rejects(attempt, error => error.name === 'AbortError' && error.code === 'cancelled');
  gate.resolve(response(loginPayload));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(instance.hasSession, false);
});

test('ISEQ-05: clearSession invalida login tardio e cancelamento prévio não envia login', async () => {
  const gate = deferred(), instance = client(async () => gate.promise);
  const attempt = instance.login('synthetic-user', 'synthetic-password');
  instance.clearSession();
  gate.resolve(response(loginPayload));
  await assert.rejects(attempt, codeIs('cancelled'));
  assert.equal(instance.hasSession, false);
  let calls = 0;
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(client(async () => { calls++; return response(loginPayload); }).login('synthetic-user', 'synthetic-password', cancelled.signal), codeIs('cancelled'));
  assert.equal(calls, 0);
});

test('ISEQ-07: logout local é imediato e a revogação remota tem prazo', { timeout: 1000 }, async () => {
  const calls = [];
  const instance = client(async (url, options) => { calls.push({ url, headers: options.headers }); return url.endsWith('/logout') ? pending() : response(loginPayload); });
  await instance.login('synthetic-user', 'synthetic-password');
  const revoke = instance.logout();
  assert.equal(instance.hasSession, false);
  await instance.request('/api/health');
  assert.equal(calls.at(-1).headers.Authorization, undefined);
  await assert.rejects(revoke, codeIs('request_timeout'));
  assert.equal(calls.find(call => call.url.endsWith('/logout')).headers.Authorization, 'Bearer synthetic-token');
});

test('ISEQ-06/07: 401 tardio de logout antigo não remove uma nova sessão', async () => {
  const gate = deferred(); let logins = 0;
  const instance = client(async url => url.endsWith('/logout') ? gate.promise : response({ ...loginPayload, session_token: `synthetic-${++logins}` }));
  await instance.login('synthetic-user', 'synthetic-password');
  const revoke = instance.logout();
  await instance.login('synthetic-user', 'synthetic-password');
  gate.resolve(response({ detail: { code: 'session_invalid', message: 'Sessão antiga encerrada' } }, 401));
  await assert.rejects(revoke, codeIs('session_invalid'));
  assert.equal(instance.hasSession, true);
});

test('ISEQ-07: confirmação inválida do logout não é sucesso remoto e não restaura token', async () => {
  const instance = client(async url => response(url.endsWith('/logout') ? {} : loginPayload));
  await instance.login('synthetic-user', 'synthetic-password');
  await assert.rejects(instance.logout(), codeIs('invalid_schema'));
  assert.equal(instance.hasSession, false);
});

test('ISEQ-08: histórico abortável em corpo pendente não devolve sucesso ou progresso tardio', async () => {
  const gate = deferred(), controller = new AbortController(); let progressCalls = 0;
  const instance = client(async url => url.endsWith('/jobs') ? response({ id: 'job' }) : { ...response({}), json: () => gate.promise });
  const attempt = historical(instance, controller.signal, () => progressCalls++);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(attempt, codeIs('cancelled'));
  gate.resolve({ status: 'completed' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(progressCalls, 0);
});

test('ISEQ-09: conta vazia retorna [] explícito e permite atualizar sensores', async () => {
  let listCalls = 0;
  const instance = client(async url => {
    if (url.endsWith('/login')) return response({ session_token: 'synthetic-token', equipment: [] });
    listCalls++;
    return response({ equipment });
  });
  assert.deepEqual(await instance.login('synthetic-user', 'synthetic-password'), []);
  assert.equal(instance.hasSession, true);
  assert.equal(listCalls, 0);
  assert.deepEqual(await instance.listEquipment(), equipment);
  assert.equal(listCalls, 1);
});

test('ISEQ-10: polling concluído remove todos os listeners temporários de abort', async () => {
  const originalAdd = AbortSignal.prototype.addEventListener, originalRemove = AbortSignal.prototype.removeEventListener;
  let added = 0, removed = 0, polls = 0;
  AbortSignal.prototype.addEventListener = function (type, ...args) { if (type === 'abort') added++; return originalAdd.call(this, type, ...args); };
  AbortSignal.prototype.removeEventListener = function (type, ...args) { if (type === 'abort') removed++; return originalRemove.call(this, type, ...args); };
  try {
    const instance = client(async url => url.endsWith('/jobs') ? response({ id: 'job' }) : url.endsWith('/job') ? response({ status: ++polls <= 3 ? 'running' : 'completed' }) : response({ rows: [], has_more: false }));
    await historical(instance, new AbortController().signal);
    assert.equal(polls, 4);
    assert.equal(added, removed);
  } finally { AbortSignal.prototype.addEventListener = originalAdd; AbortSignal.prototype.removeEventListener = originalRemove; }
});

test('controle: paginação integral preserva 25.001 registros e token fica privado', async () => {
  const offsets = [], rows = Array.from({ length: 25000 }, (_unused, i) => ({ CO2: i }));
  const instance = client(async (url, options) => {
    if (url.endsWith('/login')) return response(loginPayload);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    if (url.endsWith('/jobs')) return response({ id: 'job' });
    if (url.endsWith('/job')) return response({ status: 'completed' });
    const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset);
    return response({ rows: offset === 0 ? rows : [{ CO2: 25000 }], offset, has_more: offset === 0 });
  });
  await instance.login('synthetic-user', 'synthetic-password');
  const result = await historical(instance);
  assert.equal(result.rows.length, 25001);
  assert.deepEqual(offsets, [0, 25000]);
  assert.equal(JSON.stringify(instance).includes('synthetic-token'), false);
});
