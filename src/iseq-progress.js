import { IseqTrace, ISEQ_PHASES, formatIseqDuration, formatIseqReport } from './iseq-diagnostics.js';

let reports = [], generation = 0;
export function clearIseqReports() { reports = []; generation++; }

function reportDetails(getReport, title = 'Tempos desta operação') {
  const details = document.createElement('details'); details.className = 'iseq-diagnostics';
  const summary = document.createElement('summary'); summary.textContent = title;
  const text = document.createElement('pre'); text.className = 'iseq-report';
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'small'; copy.textContent = 'Copiar diagnóstico';
  const feedback = document.createElement('span'); feedback.className = 'small-text'; feedback.setAttribute('role', 'status');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(formatIseqReport(getReport())); feedback.textContent = 'Diagnóstico copiado.'; }
    catch { feedback.textContent = 'Selecione o resumo acima para copiar.'; }
  };
  details.append(summary, text, copy, feedback);
  const update = () => { text.textContent = formatIseqReport(getReport()); };
  update(); return { element: details, update };
}

export function appendIseqReports(element) {
  if (!element || !reports.length) return;
  element.querySelector('.iseq-saved-reports')?.remove();
  const box = document.createElement('div'); box.className = 'iseq-saved-reports';
  for (const report of reports) box.append(reportDetails(() => report, report.operation === 'login' ? 'Tempos da última conexão' : report.operation === 'history' ? 'Tempos do último histórico' : 'Tempos da atualização de sensores').element);
  element.querySelector('.dialog-body').append(box);
}

export function beginIseqProgress(element, abort, message, operation = 'history') {
  const epoch = generation, trace = new IseqTrace(operation);
  element.querySelector('.iseq-saved-reports')?.remove();
  element.querySelector('.iseq-live')?.remove();
  let container = element.querySelector('#iseq-progress');
  if (!container) { container = document.createElement('div'); container.id = 'iseq-progress'; element.querySelector('.dialog-body').append(container); }
  container.removeAttribute('role'); container.removeAttribute('aria-live'); container.className = 'iseq-progress';
  container.innerHTML = '<div class="iseq-status"><span class="spinner" aria-hidden="true"></span><strong id="iseq-progress-text"></strong><span class="iseq-elapsed" aria-live="off"></span></div><progress class="iseq-meter" aria-label="Etapas da coleta" hidden></progress><p class="iseq-counts small-text" hidden></p><button type="button" id="cancel-iseq">Cancelar espera</button>';
  const label = container.querySelector('#iseq-progress-text'), elapsed = container.querySelector('.iseq-elapsed'), counts = container.querySelector('.iseq-counts'), meter = container.querySelector('progress'), cancel = container.querySelector('#cancel-iseq');
  // Outside the form's aria-busy region; clocks do not repeatedly announce.
  const live = document.createElement('div'); live.className = 'iseq-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true'); element.append(live);
  const details = reportDetails(() => trace.snapshot()); container.append(details.element);
  let ended = false;
  const announce = text => { if (live.textContent !== text) live.textContent = text; };
  const update = text => { if (ended || abort.signal.aborted) return; label.textContent = text; announce(text + (counts.hidden ? '' : ' · ' + counts.textContent)); };
  const paint = () => { elapsed.textContent = formatIseqDuration(trace.snapshot().durationMs); if (details.element.open) details.update(); };
  const close = () => { abort.abort(); };
  const stopped = () => { cancel.disabled = true; label.textContent = 'Cancelando espera…'; announce(label.textContent); };
  cancel.onclick = close; element.addEventListener('close', close, { once: true }); abort.signal.addEventListener('abort', stopped, { once: true });
  update(message); paint(); const timer = setInterval(paint, 1000);
  const observe = event => {
    if (ended || abort.signal.aborted) return;
    trace.observe(event);
    if (event.type === 'stage' && event.state === 'start' && Object.hasOwn(ISEQ_PHASES, event.stage)) update(ISEQ_PHASES[event.stage] + '…');
    if (event.type === 'stage' && event.stage === 'health' && event.outcome === 'unavailable') update('Este serviço não oferece verificação prévia. Iniciando a entrada…');
    const snapshot = trace.snapshot();
    if (event.type === 'tasks') {
      const t = snapshot.tasks, parts = [];
      if (Number.isSafeInteger(t.total) && Number.isSafeInteger(t.completed)) {
        if (t.total > 0) { meter.hidden = false; meter.max = t.total; meter.value = t.completed; }
        else meter.hidden = true;
        parts.push(`${t.completed} de ${t.total} etapas concluídas`);
      }
      if (Number.isSafeInteger(t.cached)) parts.push(`${t.cached} reutilizadas`);
      if (Number.isSafeInteger(t.downloads)) parts.push(`${t.downloads} consultas novas`);
      if (t.failedAttempts > 0) parts.push(`${t.failedAttempts} tentativas com falha`);
      counts.textContent = parts.join(' · '); counts.hidden = !parts.length;
      if (parts.length) announce(counts.textContent);
    }
    if (event.type === 'download') update(`${snapshot.transfer.rows?.toLocaleString('pt-BR') ?? '0'} linhas recebidas · ${snapshot.transfer.pages ?? 0} página(s)`);
    paint();
  };
  return {
    update, observe,
    async measure(stage, work) {
      const started = performance.now(); observe({ type: 'stage', stage, state: 'start' });
      try { const value = await work(); observe({ type: 'stage', stage, state: 'end', outcome: 'success', durationMs: performance.now() - started }); return value; }
      catch (error) { observe({ type: 'stage', stage, state: 'end', outcome: abort.signal.aborted ? 'cancelled' : 'error', durationMs: performance.now() - started }); throw error; }
    },
    end(outcome = 'error') {
      if (ended) return; ended = true;
      clearInterval(timer); element.removeEventListener('close', close); abort.signal.removeEventListener('abort', stopped);
      const report = trace.finish(abort.signal.aborted ? 'cancelled' : outcome);
      if (epoch === generation) { reports = reports.filter(r => r.operation !== report.operation).concat(report).slice(-2); }
      container.querySelector('.spinner').hidden = true; cancel.hidden = true; meter.hidden = true;
      label.textContent = report.outcome === 'success' ? 'Operação concluída' : report.outcome === 'cancelled' ? 'Espera cancelada' : 'Operação interrompida';
      announce(label.textContent); paint(); details.update();
    },
  };
}
