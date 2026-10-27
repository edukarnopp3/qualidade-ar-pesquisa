import test from 'node:test';
import assert from 'node:assert/strict';
import { IseqClient } from '../src/iseq.js';

const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const flush = () => new Promise(resolve => setImmediate(resolve));
const minute = 60000;
const history = (client, signal) => client.historical('SYNTHETIC-SENSOR', '2026-10-01', '2026-10-02', signal);

test('ISEQ: histórico padrão conclui após mais de 20 minutos sem prazo total implícito', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let polls = 0, settled = false;
  const client = new IseqClient('https://synthetic.invalid', async url => {
    if (url.endsWith('/jobs')) return json({ id: 'synthetic-job', status: 'running' });
    if (url.endsWith('/synthetic-job')) { polls++; return json({ status: 'completed' }); }
    return json({ rows: [{ CO2: 600 }], has_more: false, offset: 0 });
  }, { healthCheck: false, pollIntervalMs: 25 * minute });
  const attempt = history(client);
  attempt.then(() => { settled = true; }, () => { settled = true; });
  await flush();
  t.mock.timers.tick(20 * minute + 1);
  await flush();
  assert.equal(settled, false, '20 minutos não encerram uma tarefa ainda em execução');
  t.mock.timers.tick(5 * minute);
  assert.deepEqual((await attempt).rows, [{ CO2: 600 }]);
  assert.equal(polls, 1);
});

test('ISEQ: histórico sem prazo total continua cancelável após mais de 20 minutos', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const abort = new AbortController();
  let calls = 0;
  const client = new IseqClient('https://synthetic.invalid', async () => {
    calls++;
    return json({ id: 'synthetic-job', status: 'running' });
  }, { healthCheck: false, pollIntervalMs: 25 * minute });
  const attempt = history(client, abort.signal);
  const cancelled = assert.rejects(attempt, error => error.code === 'cancelled');
  await flush();
  t.mock.timers.tick(21 * minute);
  await flush();
  abort.abort();
  await cancelled;
  t.mock.timers.tick(25 * minute);
  await flush();
  assert.equal(calls, 1, 'o cancelamento impede novas consultas');
});

test('ISEQ: requisição sem resposta mantém o prazo padrão de 45 segundos', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal, settled = false;
  const client = new IseqClient('https://synthetic.invalid', async (_url, options) => {
    requestSignal = options.signal;
    return new Promise(() => {});
  }, { healthCheck: false });
  const attempt = history(client);
  attempt.then(() => { settled = true; }, () => { settled = true; });
  await flush();
  t.mock.timers.tick(44999);
  await flush();
  assert.equal(settled, false);
  const timedOut = assert.rejects(attempt, error => error.code === 'request_timeout');
  t.mock.timers.tick(1);
  await timedOut;
  assert.equal(requestSignal.aborted, true);
});
