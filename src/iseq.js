export const DEFAULT_ISEQ_BACKEND = 'https://iseq-export-backend.onrender.com';

export class IseqError extends Error {
  constructor(message, code = 'iseq_error', status = null, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = code === 'cancelled' ? 'AbortError' : 'IseqError';
    this.code = code;
    this.status = status;
  }
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const schemaError = message => new IseqError(`Resposta inesperada da ISEQ: ${message}`, 'invalid_schema');
const cancellation = reason => reason instanceof IseqError ? reason : new IseqError('Espera cancelada. Nenhum dado foi importado.', 'cancelled', null, reason);
const positiveDuration = (value, name) => {
  if (!Number.isFinite(value) || value <= 0 || value > 2147483647) throw new IseqError(`Prazo inválido: ${name}.`, 'invalid_configuration');
  return value;
};

// A rejected race settles even when a custom fetcher or body reader ignores abort.
// The underlying fetch still receives a signal so native network work is cancelled.
function guarded(signal, work) {
  return new Promise((resolve, reject) => {
    const onAbort = () => finish(reject, cancellation(signal.reason));
    let settled = false;
    function finish(settle, value) {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      settle(value);
    }
    if (signal.aborted) return finish(reject, cancellation(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw cancellation(signal.reason);
      return work();
    }).then(value => finish(resolve, value), error => finish(reject, error));
  });
}

function abortScope(externalSignal, timeoutMs, timeoutError) {
  const controller = new AbortController();
  const abort = () => controller.abort(cancellation(externalSignal.reason));
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    },
  };
}

function validateEquipment(value) {
  if (!Array.isArray(value)) throw schemaError('a lista de sensores está ausente ou é inválida.');
  const identities = new Set();
  for (const item of value) {
    if (!isObject(item) || !isText(item.mac) || item.mac.length > 128) throw schemaError('há um sensor sem identificador MAC válido.');
    if (identities.has(item.mac.trim().toUpperCase())) throw schemaError('a lista contém sensores com identificadores repetidos.');
    identities.add(item.mac.trim().toUpperCase());
    for (const key of ['label', 'location']) if (item[key] !== undefined && typeof item[key] !== 'string') throw schemaError(`o campo ${key} de um sensor é inválido.`);
  }
  return value;
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const onAbort = () => finish(reject, cancellation(signal.reason));
    const finish = (settle, value) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      settle(value);
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(resolve), milliseconds);
  });
}

export class IseqClient {
  #token = null;
  #sessionRevision = 0;
  #settings;
  constructor(base, fetcher = globalThis.fetch, options = {}) {
    let url;
    try { url = new URL(base); } catch (cause) { throw new IseqError('Endereço do backend inválido.', 'invalid_backend', null, cause); }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new IseqError('Use HTTPS ou um backend local em localhost.', 'invalid_backend');
    if (url.username || url.password || url.search || url.hash) throw new IseqError('Use apenas a URL base do backend, sem credenciais ou parâmetros.', 'invalid_backend');
    if (typeof fetcher !== 'function') throw new IseqError('O transporte HTTP não está disponível.', 'invalid_configuration');
    this.base = url.href.replace(/\/+$/, '');
    // Window.fetch requires the browser global as its receiver, not this client.
    this.fetcher = fetcher.bind(globalThis);
    this.#settings = {
      requestTimeoutMs: positiveDuration(options.requestTimeoutMs ?? 45000, 'requisição'),
      operationTimeoutMs: positiveDuration(options.operationTimeoutMs ?? 1200000, 'operação'),
      logoutTimeoutMs: positiveDuration(options.logoutTimeoutMs ?? 8000, 'encerramento remoto'),
      pollIntervalMs: positiveDuration(options.pollIntervalMs ?? 2500, 'intervalo de consulta'),
    };
  }

  get hasSession() { return this.#token !== null; }
  clearSession() { this.#token = null; this.#sessionRevision++; }

  async request(path, options = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new IseqError('Rota de consulta inválida.', 'invalid_request');
    const { signal, timeoutMs, ...fetchOptions } = options;
    const duration = positiveDuration(timeoutMs ?? this.#settings.requestTimeoutMs, 'requisição');
    const scope = abortScope(signal, duration, new IseqError(`O backend não respondeu em ${Math.ceil(duration / 1000)} segundos. Ele pode estar iniciando; tente novamente ou reduza o período.`, 'request_timeout'));
    const headers = { 'Content-Type': 'application/json', ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}), ...fetchOptions.headers };
    const authorization = headers.Authorization;
    const sessionRevision = this.#sessionRevision;
    try {
      return await guarded(scope.signal, async () => {
        let response;
        try { response = await this.fetcher(`${this.base}${path}`, { ...fetchOptions, headers, signal: scope.signal }); }
        catch (cause) {
          if (scope.signal.aborted) throw cancellation(scope.signal.reason);
          throw new IseqError('Não foi possível acessar o backend. Confira conexão, disponibilidade e autorização CORS para esta origem.', 'network_error', null, cause);
        }
        if (scope.signal.aborted) throw cancellation(scope.signal.reason);
        if (!response || typeof response.ok !== 'boolean' || typeof response.json !== 'function') throw schemaError('o transporte não devolveu uma resposta HTTP válida.');
        const status = Number.isInteger(response.status) ? response.status : null;
        // A late response for a previous session cannot invalidate a new login.
        if (status === 401 && sessionRevision === this.#sessionRevision && authorization && authorization === `Bearer ${this.#token}`) this.clearSession();
        const contentType = response.headers?.get?.('content-type');
        if (contentType && !/^application\/(?:[\w.-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) throw new IseqError('O backend respondeu em formato inesperado, possivelmente uma página de carregamento. Aguarde e tente novamente.', 'invalid_json', status);
        let payload;
        try { payload = await response.json(); }
        catch (cause) {
          if (scope.signal.aborted) throw cancellation(scope.signal.reason);
          throw new IseqError('O backend não devolveu JSON válido. Aguarde e tente novamente.', 'invalid_json', status, cause);
        }
        if (scope.signal.aborted) throw cancellation(scope.signal.reason);
        if (!isObject(payload)) throw new IseqError('O backend devolveu uma resposta JSON incompatível com o contrato esperado.', 'invalid_schema', status);
        if (!response.ok) {
          const detail = payload.detail;
          const message = isText(detail) ? detail : isObject(detail) && isText(detail.message) ? detail.message : `O backend retornou erro ${status ?? 'HTTP'}.`;
          const code = isObject(detail) && isText(detail.code) ? detail.code : status === 401 ? 'session_invalid' : 'http_error';
          throw new IseqError(message, code, status);
        }
        return payload;
      });
    } finally { scope.dispose(); }
  }

  async #operation(signal, work) {
    const duration = this.#settings.operationTimeoutMs;
    const scope = abortScope(signal, duration, new IseqError(`A operação excedeu ${Math.ceil(duration / 60000)} minuto(s). Reduza o período e tente novamente.`, 'operation_timeout'));
    try { return await guarded(scope.signal, () => work(scope.signal)); }
    finally { scope.dispose(); }
  }

  async login(username, password, signal) {
    this.clearSession();
    const revision = this.#sessionRevision;
    try {
      return await this.#operation(signal, async operationSignal => {
        const payload = await this.request('/api/auth/iseq/login', { method: 'POST', body: JSON.stringify({ username_or_email: username, password }), signal: operationSignal });
        if (!isText(payload.session_token) || payload.session_token.length > 4096) throw schemaError('o backend não devolveu uma sessão válida.');
        if (payload.equipment !== undefined) validateEquipment(payload.equipment);
        if (operationSignal.aborted) throw cancellation(operationSignal.reason);
        if (revision !== this.#sessionRevision) throw new IseqError('Esta tentativa de conexão foi substituída ou encerrada.', 'cancelled');
        this.#token = payload.session_token;
        const equipment = payload.equipment?.length ? payload.equipment : await this.listEquipment(operationSignal);
        if (operationSignal.aborted) throw cancellation(operationSignal.reason);
        if (revision !== this.#sessionRevision) throw new IseqError('Esta tentativa de conexão foi substituída ou encerrada.', 'cancelled');
        return equipment; // [] is a valid explicit empty-account state, not a schema error.
      });
    } catch (error) {
      if (revision === this.#sessionRevision) this.clearSession();
      throw error;
    }
  }

  async listEquipment(signal) {
    const payload = await this.request('/api/iseq/equipment', { signal });
    return validateEquipment(payload.equipment);
  }

  logout() {
    const token = this.#token;
    this.clearSession(); // Local logout is synchronous, regardless of remote availability.
    if (!token) return Promise.resolve({ ok: true, localOnly: true });
    return this.request('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, timeoutMs: this.#settings.logoutTimeoutMs }).then(payload => {
      if (payload.ok !== true) throw schemaError('o backend não confirmou o encerramento remoto da sessão.');
      return payload;
    });
  }

  async historical(equipmentId, start, end, signal, progress = () => {}) {
    return this.#operation(signal, async operationSignal => {
      const created = await this.request('/api/iseq/jobs', { method: 'POST', body: JSON.stringify({ equipment_id: equipmentId, start, end, workers: 2 }), signal: operationSignal });
      if (!isText(created.id)) throw schemaError('a importação não devolveu um identificador válido.');
      const route = `/api/iseq/jobs/${encodeURIComponent(created.id)}`;
      while (true) {
        const job = await this.request(route, { signal: operationSignal });
        if (!['queued', 'running', 'completed', 'failed', 'cancelled', 'stale'].includes(job.status)) throw schemaError('o status da importação está ausente ou é inválido.');
        if (job.id !== undefined && job.id !== created.id) throw schemaError('o identificador da importação foi alterado na resposta.');
        if (job.message !== undefined && typeof job.message !== 'string') throw schemaError('a mensagem de progresso é inválida.');
        progress(job.message || 'Obtendo histórico na ISEQ…');
        if (job.status === 'completed') break;
        if (['failed', 'cancelled', 'stale'].includes(job.status)) throw new IseqError(job.message || 'Importação interrompida na ISEQ.', `job_${job.status}`);
        await delay(this.#settings.pollIntervalMs, operationSignal);
      }
      const rows = [], pageSize = 25000;
      while (true) {
        const payload = await this.request(`${route}/data?offset=${rows.length}&limit=${pageSize}`, { signal: operationSignal });
        if (!Array.isArray(payload.rows) || payload.rows.some(row => !isObject(row)) || typeof payload.has_more !== 'boolean') throw schemaError('a página do histórico não contém linhas e paginação válidas.');
        if (payload.offset !== undefined && payload.offset !== rows.length) throw schemaError('o deslocamento da página não corresponde às linhas solicitadas.');
        if (payload.rows.length > pageSize || (payload.rows.length === 0 && payload.has_more)) throw schemaError('a paginação do histórico não avançou ou excedeu o tamanho solicitado.');
        if (rows.length + payload.rows.length > 250000) throw new IseqError('Limite de 250 mil linhas atingido. Use um período menor.', 'row_limit');
        rows.push(...payload.rows);
        progress(`${rows.length.toLocaleString('pt-BR')} linhas recebidas…`);
        if (!payload.has_more) break;
      }
      return { rows, jobId: created.id, equipmentId, start, end, backend: this.base };
    });
  }
}
