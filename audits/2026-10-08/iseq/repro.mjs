import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { IseqClient } from '../../../src/iseq.js';
import { inferMapping } from '../../../src/mappings.js';

const findings = [];
const record = (id, details) => findings.push({ id, ...details });
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const html = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('HTML is not JSON'); } });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const loginResponse = { session_token: 'audit-synthetic-session', equipment: [{ mac: 'AUDIT-SENSOR', label: 'Sensor sintético' }] };

// No external request is made: each IseqClient receives a controlled fetcher.
{
  let options;
  const unresolved = deferred();
  const client = new IseqClient('https://audit.invalid', async (_url, opts) => { options = opts; return unresolved.promise; });
  let settled = false;
  const request = client.login('audit-user', 'synthetic-password').finally(() => { settled = true; });
  await pause(60);
  assert.equal(settled, false);
  assert.equal(options.signal, undefined);
  record('ISEQ-01', { phase: 'login', settledAfter60ms: settled, abortSignalAttached: Boolean(options.signal), builtInDeadline: false });
  unresolved.resolve(json(loginResponse)); await request;
}

{
  let now = Date.now();
  const originalNow = Date.now;
  Date.now = () => now;
  const unresolved = deferred();
  let calls = 0;
  const client = new IseqClient('https://audit.invalid', async () => ++calls === 1 ? json({ id: 'audit-job' }) : unresolved.promise);
  let settled = false;
  const controller = new AbortController();
  const request = client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', controller.signal).catch(error => error.message).finally(() => { settled = true; });
  await pause(10); now += 60 * 60000; await pause(60);
  assert.equal(settled, false);
  record('ISEQ-02', { phase: 'job polling request', elapsedFakeMinutes: 60, advertisedDeadlineMinutes: 20, settled });
  unresolved.resolve(json({ status: 'failed', message: 'synthetic cleanup' })); await request;
  Date.now = originalNow;
}

{
  const expected = 'Sua sessão terminou. Entre novamente.';
  const client = new IseqClient('https://audit.invalid', async () => json({ detail: { code: 'session_invalid', message: expected } }, 401));
  let observed;
  try { await client.request('/api/iseq/jobs'); } catch (error) { observed = error.message; }
  assert.equal(observed, 'O backend retornou erro 401.');
  record('ISEQ-03', { expected, observed, actualBackendErrorShape: 'detail.code + detail.message' });
}

{
  let phase = 0;
  const client = new IseqClient('https://audit.invalid', async url => url.endsWith('/jobs') ? json({ id: 'audit-job' }) : url.includes('/data?') ? html() : json({ status: 'completed' }));
  const result = await client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', new AbortController().signal);
  assert.deepEqual(result.rows, []);
  const loginClient = new IseqClient('https://audit.invalid', html);
  let loginMessage;
  try { await loginClient.login('audit-user', 'synthetic-password'); } catch (error) { loginMessage = error.message; }
  record('ISEQ-04', { dataEndpointReturned: 'HTTP 200 HTML', observedSuccessfulRows: result.rows.length, loginEndpointReturned: 'HTTP 200 HTML', loginMessage });
}

const main = await readFile(new URL('../../../src/main.js', import.meta.url), 'utf8');
const flow = main.slice(main.indexOf('function iseqDialog()'), main.indexOf("app.addEventListener('change'"));
function flowContext(client, sensors) {
  const dialogs = [];
  function element() {
    const password = { value: 'synthetic-password' };
    const progress = { innerHTML: '', querySelector: () => ({ onclick: null }) };
    const logout = { onclick: null };
    return { closeCount: 0, password, progress, logout, querySelector(selector) { if (selector === '#iseq-password') return password; if (selector === '#iseq-progress') return progress; if (selector === '#iseq-logout') return logout; return { textContent: '' }; }, close() { this.closeCount++; }, addEventListener() {} };
  }
  const context = { IseqClient: class extends IseqClient { constructor(base) { super(base, client.fetcher); } }, DEFAULT_ISEQ_BACKEND: 'https://audit.invalid', iseq: client, equipment: sensors, controller: null, AbortController, Date, TextEncoder, icon: () => '', e: String, inferMapping, sha256: async () => 'synthetic-hash', importDialog() {}, toast() {}, dialog(title, description, content, buttons, onSubmit) { const el = element(); dialogs.push({ title, description, content, buttons, onSubmit, el }); return el; } };
  vm.createContext(context); vm.runInContext(flow, context);
  return { context, dialogs };
}

{
  const gate = deferred();
  const client = new IseqClient('https://audit.invalid', async () => gate.promise);
  const { context, dialogs } = flowContext(client, []);
  context.iseq = null;
  context.iseqDialog();
  const first = dialogs[0];
  const submitted = first.onSubmit(new Map([['backend', 'https://audit.invalid'], ['username', 'audit-user'], ['password', 'synthetic-password']]), first.el);
  const retainedWhilePending = first.el.password.value === 'synthetic-password';
  assert.equal(retainedWhilePending, true);
  first.el.close();
  gate.resolve(json(loginResponse)); await submitted;
  assert.equal(dialogs.at(-1).title, 'Selecionar histórico ISEQ');
  record('ISEQ-05', { userClosedLoginDialog: true, passwordRetainedWhileWaiting: retainedWhilePending, passwordClearedAfterResolution: first.el.password.value === '', unexpectedDialogAfterResponse: dialogs.at(-1).title, dialogCount: dialogs.length });
}

{
  const calls = [];
  const client = new IseqClient('https://audit.invalid', async (url, options) => { calls.push({ url, auth: Boolean(options.headers.Authorization) }); return url.endsWith('/login') ? json(loginResponse) : json({ detail: { code: 'session_invalid', message: 'Sua sessão terminou. Entre novamente.' } }, 401); });
  await client.login('audit-user', 'synthetic-password');
  try { await client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', new AbortController().signal); } catch {}
  const { context, dialogs } = flowContext(client, loginResponse.equipment);
  context.iseqDialog();
  assert.equal(dialogs[0].title, 'Selecionar histórico ISEQ');
  await client.request('/api/iseq/equipment').catch(() => {});
  assert.equal(calls.at(-1).auth, false);
  record('ISEQ-06', { clientTokenClearedBy401: true, reopeningShows: dialogs[0].title, loginRequiredButNotShown: true });
}

{
  const gate = deferred();
  const calls = [];
  const client = new IseqClient('https://audit.invalid', async (url, options) => { calls.push({ url, tokenAttached: Boolean(options.headers.Authorization) }); return url.endsWith('/logout') ? gate.promise : json(loginResponse); });
  await client.login('audit-user', 'synthetic-password');
  const { context, dialogs } = flowContext(client, loginResponse.equipment);
  context.iseqPeriodDialog();
  let settled = false;
  const logout = dialogs[0].el.logout.onclick().finally(() => { settled = true; });
  await pause(60);
  await client.request('/audit/token-probe');
  assert.equal(settled, false); assert.equal(calls.at(-1).tokenAttached, true);
  record('ISEQ-07', { logoutSettled: settled, modalClosed: dialogs[0].el.closeCount > 0, clientTokenStillAttachedWhileLogoutPending: calls.at(-1).tokenAttached, mainClientStillPresent: Boolean(context.iseq) });
  gate.resolve(json({ ok: true })); await logout;
}

{
  const client = { historical: async () => { throw new Error('audit controlled failure'); } };
  const { context, dialogs } = flowContext(client, loginResponse.equipment);
  context.iseqPeriodDialog();
  const d = dialogs[0];
  await d.onSubmit(new Map([['start', '2026-10-01'], ['end', '2026-10-02'], ['equipment', 'AUDIT-SENSOR']]), d.el).catch(() => {});
  assert.match(d.el.progress.innerHTML, /spinner/);
  record('ISEQ-08', { operationRejected: true, spinnerStillPresent: true, cancelButtonStillPresent: d.el.progress.innerHTML.includes('cancel-iseq'), controllerStillPresent: Boolean(context.controller) });
}

{
  const client = new IseqClient('https://audit.invalid', async url => url.endsWith('/login') ? json({ session_token: 'audit-synthetic-session', equipment: [] }) : json({ equipment: [] }));
  const { context, dialogs } = flowContext(client, []);
  context.iseq = null; context.iseqDialog();
  await dialogs[0].onSubmit(new Map([['backend', 'https://audit.invalid'], ['username', 'audit-user'], ['password', 'synthetic-password']]), dialogs[0].el);
  assert.equal(dialogs.at(-1).title, 'Selecionar histórico ISEQ');
  record('ISEQ-09', { equipmentCount: context.equipment.length, emptyRequiredSelectShown: true, noEmptyAccountMessage: !dialogs.at(-1).content.includes('Nenhum sensor') });
}

{
  const offsets = [];
  const rows = Array.from({ length: 25001 }, (_v, i) => ({ data_local: `audit-${i}`, CO2: i }));
  const client = new IseqClient('https://audit.invalid', async url => {
    if (url.endsWith('/jobs')) return json({ id: 'audit-job' });
    if (!url.includes('/data?')) return json({ status: 'completed' });
    const parsed = new URL(url); const offset = Number(parsed.searchParams.get('offset')); offsets.push(offset);
    return json({ rows: rows.slice(offset, offset + 25000), offset, has_more: offset === 0 });
  });
  const result = await client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', new AbortController().signal);
  assert.equal(result.rows.length, 25001); assert.deepEqual(offsets, [0, 25000]);
  record('PASS-PAGINATION', { rows: result.rows.length, offsets, duplicateRows: false });
}

{
  const client = new IseqClient('https://audit.invalid', async (url, options) => {
    if (url.endsWith('/jobs')) return json({ id: 'audit-job' });
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  });
  const controller = new AbortController(); const result = client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', controller.signal).catch(error => error.name);
  await pause(10); controller.abort(); assert.equal(await result, 'AbortError');
  record('PASS-HISTORY-CANCEL', { abortedFetchRejected: true });
}

{
  const headers = ['data_local', 'CO2', 'NOx', 'VOC', 'PM10', 'PM2.5', 'PM1', 'Umid', 'Temp', 'Pressao'];
  const mapping = inferMapping(headers); assert.equal(mapping.date, 'data_local'); assert.equal(Object.keys(mapping.columns).length, 9);
  record('PASS-HISTORY-FORMAT', { format: mapping.format, recognizedDate: mapping.date, recognizedParameterCount: Object.keys(mapping.columns).length });
}

{
  const rows = [{ data_local: '2026-10-01T10:00:00', CO2: 650, 'PM2.5': 4 }];
  let sentEquipment;
  const client = new IseqClient('https://audit.invalid', async (url, options) => {
    if (url.endsWith('/jobs')) { sentEquipment = JSON.parse(options.body).equipment_id; return json({ id: 'audit-job' }); }
    if (url.includes('/data?')) return json({ rows, offset: 0, has_more: false });
    return json({ status: 'completed' });
  });
  const sensors = [{ mac: 'AA:BB:CC:DD:EE:01', location: 'Sala sintética', label: 'Sala sintética (AA:BB:CC:DD:EE:01)' }];
  const { context, dialogs } = flowContext(client, sensors);
  context.iseqPeriodDialog();
  await dialogs[0].onSubmit(new Map([['equipment', sensors[0].mac], ['start', '2026-10-01'], ['end', '2026-10-02']]), dialogs[0].el);
  assert.equal(sentEquipment, sensors[0].mac);
  assert.equal(context.pending.context.sensorId, sensors[0].mac);
  assert.equal(context.pending.context.sensorLabel, sensors[0].label);
  assert.deepEqual(context.pending.sheets[0].rows, rows);
  record('PASS-EQUIPMENT-CONTEXT', { equipmentIdSent: sentEquipment, importedSensorId: context.pending.context.sensorId, labelPreserved: true, rowsPreserved: true });
}

{
  const client = new IseqClient('https://audit.invalid', async () => json({ detail: 'Erro controlado explícito' }, 400));
  let observed;
  try { await client.request('/audit'); } catch (error) { observed = error.message; }
  assert.equal(observed, 'Erro controlado explícito');
  record('PASS-STRING-ERROR', { observed });
}

{
  const controller = new AbortController();
  let added = 0, removed = 0, poll = 0;
  const signal = { throwIfAborted() {}, addEventListener(...args) { added++; controller.signal.addEventListener(...args); }, removeEventListener(...args) { removed++; controller.signal.removeEventListener(...args); } };
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, ms, ...args) => originalTimeout(callback, ms === 2500 ? 0 : ms, ...args);
  const client = new IseqClient('https://audit.invalid', async url => url.endsWith('/jobs') ? json({ id: 'audit-job' }) : url.includes('/data?') ? json({ rows: [], has_more: false }) : json({ status: ++poll > 3 ? 'completed' : 'running' }));
  await client.historical('AUDIT-SENSOR', '2026-10-01', '2026-10-02', signal);
  globalThis.setTimeout = originalTimeout;
  assert.equal(added, 3); assert.equal(removed, 0);
  record('ISEQ-10', { pollWaitsCompleted: 3, abortListenersAdded: added, abortListenersRemoved: removed });
}

await writeFile(new URL('./resultados.json', import.meta.url), JSON.stringify({ timestamp: new Date().toISOString(), version: '0.1.1', findings }, null, 2));
console.log(JSON.stringify({ probes: findings.length, completed: true, results: findings }, null, 2));
