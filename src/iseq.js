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
const stages = new Set(['health', 'login', 'equipment', 'create_job', 'history', 'download']);
const now = () => performance.now();
const elapsed = started => Math.max(0, now() - started);
const outcome = error => error?.code === 'cancelled' ? 'cancelled' : 'error';
const emit = (observer, event) => {
  // Diagnostics are optional and cannot change the connector's result.
  try { Promise.resolve(observer?.(event)).catch(() => {}); } catch { /* observer failure */ }
};

function taskCounts(job) {
  const event = { type: 'tasks' };
  for (const [source, target] of Object.entries({ total_tasks: 'total', completed_tasks: 'completed', cached_tasks: 'cached', download_tasks: 'downloads', attempted_tasks: 'attempted', worker_count: 'workers', failed_attempts: 'failedAttempts' })) {
    if (job[source] === undefined) continue;
    if (!Number.isSafeInteger(job[source]) || job[source] < 0 || (target === 'workers' && (job[source] < 1 || job[source] > 6))) throw schemaError('as contagens de tarefas são inválidas.');
    event[target] = job[source];
  }
  const { total, completed, cached, downloads, attempted } = event;
  if ([completed, cached, downloads, attempted].some(value => total !== undefined && value !== undefined && value > total)
    || (cached !== undefined && completed !== undefined && cached > completed)
    || (attempted !== undefined && downloads !== undefined && attempted > downloads)
    || (attempted !== undefined && completed !== undefined && cached !== undefined && completed - cached > attempted)
    || (job.status === 'completed' && total !== undefined && completed !== undefined && completed !== total)
    || (total !== undefined && cached !== undefined && downloads !== undefined && cached + downloads !== total)) throw schemaError('as contagens de tarefas são inconsistentes.');
  return event;
}

function validateJob(job, id) {
  if (!['queued', 'running', 'completed', 'failed', 'cancelled', 'stale'].includes(job.status)) throw schemaError('o status da importação está ausente ou é inválido.');
  if (job.id !== undefined && job.id !== id) throw schemaError('o identificador da importação foi alterado na resposta.');
  if (job.message !== undefined && typeof job.message !== 'string') throw schemaError('a mensagem de progresso é inválida.');
  return taskCounts(job);
}

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
      healthTimeoutMs: positiveDuration(options.healthTimeoutMs ?? 90000, 'prontidão do serviço'),
      healthPollIntervalMs: positiveDuration(options.healthPollIntervalMs ?? 2500, 'intervalo de prontidão'),
      healthCheck: options.healthCheck ?? true,
      workers: options.workers ?? 2,
    };
    if (typeof this.#settings.healthCheck !== 'boolean' || !Number.isInteger(this.#settings.workers) || this.#settings.workers < 1 || this.#settings.workers > 6) throw new IseqError('Configuração de prontidão ou paralelismo inválida.', 'invalid_configuration');
  }

  get hasSession() { return this.#token !== null; }
  clearSession() { this.#token = null; this.#sessionRevision++; }

  async request(path, options = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new IseqError('Rota de consulta inválida.', 'invalid_request');
    const { signal, timeoutMs, publicRequest = false, stage, observer, ...fetchOptions } = options;
    const duration = positiveDuration(timeoutMs ?? this.#settings.requestTimeoutMs, 'requisição');
    const scope = abortScope(signal, duration, new IseqError(`O backend não respondeu em ${Math.ceil(duration / 1000)} segundos. Ele pode estar iniciando; tente novamente ou reduza o período.`, 'request_timeout'));
    const headers = publicRequest ? { ...fetchOptions.headers } : { 'Content-Type': 'application/json', ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}), ...fetchOptions.headers };
    const authorization = headers.Authorization;
    const sessionRevision = this.#sessionRevision;
    const metrics = { type: 'request', stage, status: null };
    const started = now();
    try {
      const payload = await guarded(scope.signal, async () => {
        let response;
        try { response = await this.fetcher(`${this.base}${path}`, { ...fetchOptions, headers, signal: scope.signal }); }
        catch (cause) {
          if (scope.signal.aborted) throw cancellation(scope.signal.reason);
          throw new IseqError('Não foi possível acessar o backend. Confira conexão, disponibilidade e autorização CORS para esta origem.', 'network_error', null, cause);
        }
        if (scope.signal.aborted) throw cancellation(scope.signal.reason);
        if (!response || typeof response.ok !== 'boolean' || typeof response.json !== 'function') throw schemaError('o transporte não devolveu uma resposta HTTP válida.');
        const status = Number.isInteger(response.status) ? response.status : null;
        metrics.status = status !== null && status >= 100 && status <= 599 ? status : null;
        // A late response for a previous session cannot invalidate a new login.
        if (status === 401 && sessionRevision === this.#sessionRevision && authorization && authorization === `Bearer ${this.#token}`) this.clearSession();
        const contentType = response.headers?.get?.('content-type');
        if (contentType && !/^application\/(?:[\w.-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) throw new IseqError('O backend respondeu em formato inesperado, possivelmente uma página de carregamento. Aguarde e tente novamente.', 'invalid_json', status);
        let payload;
        try {
          if (typeof response.text === 'function') {
            const text = await response.text();
            if (scope.signal.aborted) throw cancellation(scope.signal.reason);
            metrics.responseBytes = new TextEncoder().encode(text).byteLength;
            const decodeStarted = now();
            try { payload = JSON.parse(text); } finally { metrics.decodeMs = elapsed(decodeStarted); }
          } else {
            // Compatibility for injected transports that expose only json().
            payload = await response.json();
          }
        }
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
      if (stages.has(stage)) emit(observer, { ...metrics, durationMs: elapsed(started), outcome: 'success' });
      return payload;
    } catch (error) {
      if (stages.has(stage)) emit(observer, { ...metrics, durationMs: elapsed(started), outcome: outcome(error) });
      throw error;
    } finally { scope.dispose(); }
  }

  async #stage(stage, observer, work) {
    const started = now();
    emit(observer, { type: 'stage', stage, state: 'start' });
    try {
      const value = await work();
      emit(observer, { type: 'stage', stage, state: 'end', outcome: stage === 'health' && value === false ? 'unavailable' : 'success', durationMs: elapsed(started) });
      return value;
    } catch (error) {
      emit(observer, { type: 'stage', stage, state: 'end', outcome: outcome(error), durationMs: elapsed(started) });
      throw error;
    }
  }

  async #ready(signal, observer) {
    return this.#stage('health', observer, async () => {
      const duration = this.#settings.healthTimeoutMs;
      const timeout = new IseqError(`O serviço não ficou pronto em ${Math.ceil(duration / 1000)} segundos. Tente novamente em alguns instantes.`, 'health_timeout');
      const scope = abortScope(signal, duration, timeout);
      const started = now();
      try {
        return await guarded(scope.signal, async () => {
          for (let attempt = 0; attempt < 36; attempt++) {
            try {
              const remaining = duration - elapsed(started);
              if (remaining <= 0) throw timeout;
              const payload = await this.request('/api/health', { method: 'GET', publicRequest: true, credentials: 'omit', cache: 'no-store', signal: scope.signal, timeoutMs: Math.min(this.#settings.requestTimeoutMs, remaining), stage: 'health', observer });
              if (payload.auth_ready === false) throw new IseqError('O serviço respondeu, mas a autenticação está desabilitada por configuração do backend.', 'backend_not_ready');
              if (payload.status !== 'ok' || (payload.auth_ready !== undefined && payload.auth_ready !== true)) throw schemaError('o serviço não confirmou que está pronto para receber o login.');
              return true;
            } catch (error) {
              if (scope.signal.aborted) throw cancellation(scope.signal.reason);
              if ([404, 405].includes(error.status) && this.base !== DEFAULT_ISEQ_BACKEND) return false;
              const retryable = ['network_error', 'request_timeout'].includes(error.code) || (error.code === 'invalid_json' && error.status === 200) || (error.status >= 500 && error.status <= 599);
              if (!retryable) throw error;
              if (attempt === 35) throw timeout;
              await delay(this.#settings.healthPollIntervalMs, scope.signal);
            }
          }
        });
      } finally { scope.dispose(); }
    });
  }

  async #operation(signal, work) {
    const duration = this.#settings.operationTimeoutMs;
    const scope = abortScope(signal, duration, new IseqError(`A operação excedeu ${Math.ceil(duration / 60000)} minuto(s). Reduza o período e tente novamente.`, 'operation_timeout'));
    try { return await guarded(scope.signal, () => work(scope.signal)); }
    finally { scope.dispose(); }
  }

  async login(username, password, signal, observer = () => {}) {
    this.clearSession();
    const revision = this.#sessionRevision;
    try {
      return await this.#operation(signal, async operationSignal => {
        if (this.#settings.healthCheck) await this.#ready(operationSignal, observer);
        const payload = await this.#stage('login', observer, async () => {
          if (operationSignal.aborted) throw cancellation(operationSignal.reason);
          if (revision !== this.#sessionRevision) throw new IseqError('Esta tentativa de conexão foi substituída ou encerrada.', 'cancelled');
          const result = await this.request('/api/auth/iseq/login', { method: 'POST', body: JSON.stringify({ username_or_email: username, password }), signal: operationSignal, stage: 'login', observer });
          if (!isText(result.session_token) || result.session_token.length > 4096) throw schemaError('o backend não devolveu uma sessão válida.');
          if (result.equipment !== undefined) validateEquipment(result.equipment);
          if (operationSignal.aborted) throw cancellation(operationSignal.reason);
          if (revision !== this.#sessionRevision) throw new IseqError('Esta tentativa de conexão foi substituída ou encerrada.', 'cancelled');
          this.#token = result.session_token;
          return result;
        });
        const equipment = payload.equipment !== undefined ? payload.equipment : await this.listEquipment(operationSignal, observer);
        if (operationSignal.aborted) throw cancellation(operationSignal.reason);
        if (revision !== this.#sessionRevision) throw new IseqError('Esta tentativa de conexão foi substituída ou encerrada.', 'cancelled');
        return equipment; // [] is a valid explicit empty-account state, not a schema error.
      });
    } catch (error) {
      if (revision === this.#sessionRevision) this.clearSession();
      throw error;
    }
  }

  async listEquipment(signal, observer = () => {}) {
    return this.#stage('equipment', observer, async () => {
      const payload = await this.request('/api/iseq/equipment', { signal, stage: 'equipment', observer });
      return validateEquipment(payload.equipment);
    });
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

  async historical(equipmentId, start, end, signal, progress = () => {}, observer = () => {}) {
    return this.#operation(signal, async operationSignal => {
      const created = await this.#stage('create_job', observer, async () => {
        const result = await this.request('/api/iseq/jobs', { method: 'POST', body: JSON.stringify({ equipment_id: equipmentId, start, end, workers: this.#settings.workers }), signal: operationSignal, stage: 'create_job', observer });
        if (!isText(result.id)) throw schemaError('a importação não devolveu um identificador válido.');
        if (result.status !== undefined) validateJob(result, result.id);
        else taskCounts(result);
        return result;
      });
      const route = `/api/iseq/jobs/${encodeURIComponent(created.id)}`;
      await this.#stage('history', observer, async () => {
        let job = created.status !== undefined ? created : await this.request(route, { signal: operationSignal, stage: 'history', observer });
        while (true) {
          if (operationSignal.aborted) throw cancellation(operationSignal.reason);
          const counts = validateJob(job, created.id);
          if (Object.keys(counts).length > 1) emit(observer, counts);
          progress(job.message || 'Obtendo histórico na ISEQ…');
          if (job.status === 'completed') break;
          if (['failed', 'cancelled', 'stale'].includes(job.status)) throw new IseqError(job.message || 'Importação interrompida na ISEQ.', `job_${job.status}`);
          await delay(this.#settings.pollIntervalMs, operationSignal);
          job = await this.request(route, { signal: operationSignal, stage: 'history', observer });
        }
      });
      const rows = await this.#stage('download', observer, async () => {
        const rows = [], pageSize = 25000;
        let pages = 0;
        while (true) {
          const payload = await this.request(`${route}/data?offset=${rows.length}&limit=${pageSize}`, { signal: operationSignal, stage: 'download', observer });
          if (!Array.isArray(payload.rows) || payload.rows.some(row => !isObject(row)) || typeof payload.has_more !== 'boolean') throw schemaError('a página do histórico não contém linhas e paginação válidas.');
          if (payload.offset !== undefined && payload.offset !== rows.length) throw schemaError('o deslocamento da página não corresponde às linhas solicitadas.');
          if (payload.rows.length > pageSize || (payload.rows.length === 0 && payload.has_more)) throw schemaError('a paginação do histórico não avançou ou excedeu o tamanho solicitado.');
          if (rows.length + payload.rows.length > 250000) throw new IseqError('Limite de 250 mil linhas atingido. Use um período menor.', 'row_limit');
          rows.push(...payload.rows);
          emit(observer, { type: 'download', rows: rows.length, pages: ++pages });
          progress(`${rows.length.toLocaleString('pt-BR')} linhas recebidas…`);
          if (!payload.has_more) break;
        }
        return rows;
      });
      return { rows, jobId: created.id, equipmentId, start, end, backend: this.base };
    });
  }
}
