export const DEFAULT_ISEQ_BACKEND = 'https://iseq-export-backend.onrender.com';
export class IseqClient {
  #token = null;
  constructor(base, fetcher = fetch) {
    const url = new URL(base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS ou um backend local em localhost.');
    if (url.username || url.password || url.search || url.hash) throw new Error('Use apenas a URL base do backend, sem credenciais ou parâmetros.');
    this.base = base.replace(/\/+$/, ''); this.fetcher = fetcher;
  }
  async request(path, options = {}) {
    const response = await this.fetcher(`${this.base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}), ...options.headers } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) this.#token = null;
      throw new Error(typeof payload.detail === 'string' ? payload.detail : `O backend retornou erro ${response.status}.`);
    }
    return payload;
  }
  async login(username, password) {
    const payload = await this.request('/api/auth/iseq/login', { method: 'POST', body: JSON.stringify({ username_or_email: username, password }) });
    if (!payload.session_token) throw new Error('O backend não devolveu uma sessão válida.');
    this.#token = payload.session_token;
    return payload.equipment?.length ? payload.equipment : (await this.request('/api/iseq/equipment')).equipment || [];
  }
  async logout() { try { await this.request('/api/auth/logout', { method: 'POST' }); } finally { this.#token = null; } }
  async historical(equipmentId, start, end, signal, progress = () => {}) {
    const created = await this.request('/api/iseq/jobs', { method: 'POST', body: JSON.stringify({ equipment_id: equipmentId, start, end, workers: 2 }), signal });
    if (!created.id) throw new Error('A importação não devolveu um identificador.');
    const deadline = Date.now() + 20 * 60000;
    while (true) {
      signal?.throwIfAborted();
      const job = await this.request(`/api/iseq/jobs/${encodeURIComponent(created.id)}`, { signal });
      progress(job.message || 'Obtendo histórico na ISEQ…');
      if (job.status === 'completed') break;
      if (['failed', 'cancelled', 'stale'].includes(job.status)) throw new Error(job.message || 'Importação interrompida na ISEQ.');
      if (Date.now() > deadline) throw new Error('O histórico demorou mais que 20 minutos. Reduza o período e tente novamente.');
      await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 2500); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); }, { once: true }); });
    }
    const rows = [], pageSize = 25000;
    while (true) {
      signal?.throwIfAborted();
      const payload = await this.request(`/api/iseq/jobs/${encodeURIComponent(created.id)}/data?offset=${rows.length}&limit=${pageSize}`, { signal });
      const page = Array.isArray(payload.rows) ? payload.rows : [];
      rows.push(...page); progress(`${rows.length.toLocaleString('pt-BR')} linhas recebidas…`);
      if (rows.length > 250000) throw new Error('Limite de 250 mil linhas atingido. Use um período menor.');
      if (page.length < pageSize || payload.has_more === false) break;
    }
    return { rows, jobId: created.id, equipmentId, start, end, backend: this.base };
  }
}
