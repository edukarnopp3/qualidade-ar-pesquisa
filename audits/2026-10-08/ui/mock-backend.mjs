import http from 'node:http';
import { appendFile } from 'node:fs/promises';

const log = new URL('./mock-requests.jsonl', import.meta.url);
let count = 0;
const send = (res, body, status = 200) => {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:8765');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return send(res, {});
  const parsed = new URL(req.url, 'http://127.0.0.1:8787');
  const [, mode, ...segments] = parsed.pathname.split('/');
  const path = '/' + segments.join('/');
  await appendFile(log, JSON.stringify({ count: ++count, at: new Date().toISOString(), mode, method: req.method, path }) + '\n');
  req.resume(); // Discard fixture credentials: never log request bodies or tokens.
  if (path === '/api/auth/iseq/login') {
    if (mode === 'hang') return;
    const success = () => send(res, { session_token: 'audit-synthetic-token', equipment: [{ mac: 'AUDIT-DEVICE', label: 'Sensor sintético da auditoria' }] });
    if (mode === 'slow') return setTimeout(success, 15000);
    if (mode === 'fail') return send(res, { detail: { code: 'invalid_credentials', message: 'Credenciais sintéticas recusadas pelo servidor de auditoria.' } }, 401);
    return success();
  }
  if (path === '/api/auth/logout') return send(res, { ok: true });
  if (path === '/api/iseq/equipment') return send(res, { equipment: [] });
  if (path === '/api/iseq/jobs') return send(res, { id: 'audit-job' });
  if (path === '/api/iseq/jobs/audit-job') return send(res, { status: 'completed' });
  if (path === '/api/iseq/jobs/audit-job/data') return send(res, { rows: [{ data_local: '2026-10-01 00:00:00', CO2: 500 }, { data_local: '2026-10-01 00:05:00', CO2: 700 }], has_more: false });
  return send(res, { detail: 'Somente fixture local de auditoria.' }, 404);
});
server.listen(8787, '127.0.0.1', () => process.stdout.write('Backend sintético de auditoria em 127.0.0.1:8787\n'));
