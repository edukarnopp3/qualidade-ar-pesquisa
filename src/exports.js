import { utils, write } from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { ELIGIBILITY_LABELS, PARAMETERS, localIso } from './core.js';
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function safeCell(value) { return typeof value === 'string' && /^\s*[=+@-]/.test(value) ? `'${value}` : value; }
export const filename = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'analise';
export function resultRows(run) {
  return run.analysis.bins.map(b => ({ caso: run.caseName, execucao: run.id, parametro: run.analysis.parameter, unidade: run.analysis.unit, inicio: b.label, fim: localIso(b.end, run.offsetMinutes), media: b.mean, mediana: b.median, minimo: b.min, maximo: b.max, leituras_usadas: b.n, slots_observados: b.occupied, slots_esperados: b.expected, cobertura: b.coverage, elegibilidade: ELIGIBILITY_LABELS[b.eligibility], resultado: b.comparison === 'acima' ? 'Acima da referência' : b.comparison === 'ate_referencia' ? 'Até a referência' : '', motivo: b.reason, regra: run.analysis.rule?.name || '', versao_regra: run.analysis.rule?.version || '', software: run.analysis.versions.software }));
}
export function exportWorkbook(dataset, run) {
  const wb = utils.book_new();
  const add = (name, rows) => utils.book_append_sheet(wb, utils.json_to_sheet(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v ?? '')])))), name);
  add('Resultados', resultRows(run));
  add('Perfil horario', run.analysis.profile || []);
  add('Distribuicao', run.analysis.histogram || []);
  add('Qualidade', dataset.issues.map(o => ({ arquivo: o.sourceId, linha: o.rowNumber, parametro: o.parameter || '', motivo: o.code, valor_original: o.detail })));
  add('Decisoes', dataset.observations.filter(o => o.flags.length || o.manualDecision).map(o => ({ arquivo: o.sourceId, linha: o.rowNumber, parametro: o.parameter, valor: o.value, incluidos: o.included ? 'Sim' : 'Não', sinalizacao: o.flags.join('; '), decisao: o.decision || '' })));
  add('Metodo', [{ execucao: run.id, data_execucao: run.createdAt, sensor: dataset.sensorId, ambiente: dataset.environment, origem: dataset.synthetic ? 'Sintético' : 'Importado', janela: run.analysis.config.window, frequencia_nominal_segundos: dataset.nominalIntervalSeconds, regra: run.analysis.rule?.name || 'Nenhuma', fonte: run.analysis.rule?.source || '', software: run.analysis.versions.software, metodo: run.analysis.versions.method }]);
  add('Arquivos', dataset.sources.map(({ id, name, hash, size, origin }) => ({ id, name, hash, size, origin })));
  return new Blob([write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function exportCsv(run) {
  const rows = resultRows(run), headers = Object.keys(rows[0] || {});
  const quote = value => `"${String(safeCell(value ?? '')).replace(/"/g, '""')}"`;
  return new Blob(['\ufeff' + [headers.map(quote).join(';'), ...rows.map(r => headers.map(h => quote(r[h])).join(';'))].join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
const plain = value => String(value ?? '').replace(/₂/g, '2').replace(/₁/g, '1').replace(/₀/g, '0').replace(/ₓ/g, 'x').replace(/µ/g, 'u').replace(/³/g, '3').replace(/[—–]/g, '-').replace(/…/g, '...');
const num = value => value == null ? 'Não disponível' : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export function exportPdf(dataset, run) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }), analysis = run.analysis;
  const width = 174, margin = 18;
  doc.setFont('helvetica'); doc.setTextColor('#1e2b36');
  doc.setFontSize(10); doc.text('QUALIDADE DO AR / ANÁLISE HISTÓRICA', margin, 18);
  doc.setFontSize(23); doc.text(plain(dataset.name).slice(0, 55), margin, 32);
  doc.setFontSize(11); doc.text(`${plain(PARAMETERS[analysis.parameter].label)} - ${plain(analysis.unit || 'Unidade não confirmada')}`, margin, 42);
  const lines = [dataset.synthetic ? 'DEMONSTRAÇÃO - dados integralmente sintéticos.' : `Sensor: ${dataset.sensorLabel} (${dataset.sensorId})`, `Período: ${localIso(analysis.config.start, dataset.offsetMinutes).replace('T', ' ')} a ${localIso(analysis.config.end, dataset.offsetMinutes).replace('T', ' ')} (fim exclusivo)`, `Agregação: média ${analysis.config.window === 'day' ? 'diária' : 'horária'}; média aritmética das leituras incluídas.`, `Execução: ${run.id}; realizada em ${new Date(run.createdAt).toLocaleString('pt-BR')}.`];
  doc.setFontSize(9); lines.forEach((text, i) => doc.text(plain(text), margin, 51 + i * 5));
  autoTable(doc, { startY: 75, margin: { left: margin, right: margin }, head: [['Leituras usadas', 'Média das leituras', 'Percentil 95', 'Cobertura temporal']], body: [[num(analysis.summary.n), num(analysis.summary.mean), num(analysis.summary.p95), analysis.quality.coverage == null ? 'Frequência pendente' : `${num(analysis.quality.coverage * 100)}%`]], theme: 'plain', styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [241, 244, 246], textColor: [30, 43, 54] } });
  const chartY = 106, chartH = 62, vals = analysis.bins.filter(b => b.mean != null).map(b => b.mean), min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 1;
  const range = Math.max(max - min, 1), yAt = v => chartY + chartH - (v - min) / range * chartH, xAt = i => margin + 14 + i / Math.max(analysis.bins.length - 1, 1) * (width - 16);
  doc.setDrawColor('#cad3dc'); doc.line(margin + 14, chartY, margin + 14, chartY + chartH); doc.line(margin + 14, chartY + chartH, margin + width, chartY + chartH);
  doc.setFontSize(8); doc.text(num(max), margin, chartY + 2); doc.text(num(min), margin, chartY + chartH);
  doc.setDrawColor(PARAMETERS[analysis.parameter].color); doc.setLineWidth(.65);
  analysis.bins.forEach((b, i) => { if (i && b.mean != null && analysis.bins[i - 1].mean != null) doc.line(xAt(i - 1), yAt(analysis.bins[i - 1].mean), xAt(i), yAt(b.mean)); });
  doc.setTextColor('#4f5b66'); doc.text(plain(analysis.bins[0]?.label.slice(0, 10) || ''), margin + 14, chartY + chartH + 6); doc.text(plain(analysis.bins.at(-1)?.label.slice(0, 10) || ''), margin + width, chartY + chartH + 6, { align: 'right' });
  doc.setFontSize(10); doc.setTextColor('#1e2b36');
  let y = 185;
  const interpretation = analysis.rule ? `Referência: ${analysis.rule.name}. ${analysis.eligibility.eligible} de ${analysis.bins.length} janelas permitem comparação; ${analysis.eligibility.above} ficaram acima do critério.` : 'Resultado descritivo. Uma referência aplicável ainda não foi selecionada; os valores não receberam classificação de conformidade.';
  for (const paragraph of [interpretation, `${analysis.quality.emptyWindows} janelas sem leituras utilizáveis; ${analysis.quality.excluded} leituras excluídas no recorte. A cobertura usa slots da frequência nominal confirmada, quando disponível.`, `Fonte da referência: ${analysis.rule?.source || 'Não selecionada'}.`, 'A ferramenta analisa registros fornecidos. A validade física do sensor e a aplicabilidade da referência exigem documentação própria.']) { const lines = doc.splitTextToSize(plain(paragraph), width); for (const text of lines) { if (y > 270) { doc.addPage(); y = 22; } doc.text(text, margin, y); y += 5; } y += 5; }
  doc.addPage(); doc.setFontSize(17); doc.text('Resultados por janela', margin, 21);
  if (analysis.bins.length > 500) { doc.setFontSize(9); doc.text('Primeiras 500 janelas. O arquivo Excel/CSV contém todas as janelas da execução.', margin, 28); }
  autoTable(doc, { startY: analysis.bins.length > 500 ? 34 : 30, margin: { left: margin, right: margin, bottom: 18 }, head: [['Início', 'Média', 'N', 'Cobertura', 'Elegibilidade / resultado']], body: analysis.bins.slice(0, 500).map(b => [b.label.slice(5, 16).replace('T', ' '), num(b.mean), String(b.n), b.coverage == null ? '-' : `${num(b.coverage * 100)}%`, plain(`${ELIGIBILITY_LABELS[b.eligibility]}${b.comparison ? b.comparison === 'acima' ? ' / acima' : ' / até referência' : ''}`)]), styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [23, 107, 85] } });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) { doc.setPage(page); doc.setFontSize(8); doc.setTextColor('#4f5b66'); doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} | software ${analysis.versions.software} | ${page}/${doc.getNumberOfPages()}`, margin, 287); }
  return doc.output('blob');
}
