import { init } from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';
import { PARAMETERS, localIso, stats } from './core.js';
use([LineChart, BarChart, GridComponent, TooltipComponent, DataZoomComponent, LegendComponent, CanvasRenderer]);
let charts = [];
export function disposeCharts() { charts.forEach(c => c.dispose()); charts = []; }
export function resizeCharts() { charts.forEach(c => c.resize()); }
const number = value => value == null ? 'Sem dados' : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, v => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[v]);
export function renderCharts(dataset, analysis, dark) {
  disposeCharts();
  const p = PARAMETERS[analysis.parameter], color = dark ? p.dark : p.color;
  analysis = { ...analysis, unit: escapeHtml(analysis.unit) };
  const ink = dark ? '#e6ebf0' : '#1e2b36', muted = dark ? '#b2bcc6' : '#4f5b66', line = dark ? '#424c56' : '#dae1e7', surface = dark ? '#20262c' : '#ffffff';
  const base = { animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 200, textStyle: { fontFamily: 'Segoe UI, Arial, sans-serif', color: ink }, grid: { left: 55, right: 24, top: 25, bottom: 48 }, tooltip: { trigger: 'axis', backgroundColor: surface, borderColor: line, textStyle: { color: ink }, confine: true }, xAxis: { axisLabel: { color: muted }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } }, yAxis: { type: 'value', name: analysis.unit || 'Unidade pendente', nameTextStyle: { color: muted, align: 'left' }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: line, type: 'dashed' } } } };
  function mount(id, option) { const element = document.getElementById(id); if (!element) return; const chart = init(element, null, { renderer: 'canvas' }); chart.setOption(option); charts.push(chart); }
  const labels = analysis.bins.map(b => b.label);
  const series = [{ name: analysis.config.window === 'day' ? 'Média diária' : 'Média horária', type: 'line', data: analysis.bins.map(b => b.mean), connectNulls: false, symbol: 'circle', showSymbol: labels.length <= 48, symbolSize: 5, lineStyle: { width: 2.5, color }, itemStyle: { color } }];
  if (analysis.rule && !analysis.rule.requiresOutdoor) series.push({ name: 'Referência em janelas elegíveis', type: 'line', data: analysis.bins.map(b => b.eligibility === 'admissivel' ? analysis.rule.threshold : null), connectNulls: false, showSymbol: labels.length < 48, lineStyle: { type: 'dashed', width: 1.5, color: muted }, itemStyle: { color: muted } });
  mount('time-chart', { ...base, grid: { ...base.grid, bottom: labels.length > 48 ? 65 : 40 }, xAxis: { ...base.xAxis, type: 'category', data: labels, boundaryGap: false, axisLabel: { color: muted, formatter: v => analysis.config.window === 'day' ? v.slice(5, 10).split('-').reverse().join('/') : `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}` } }, tooltip: { ...base.tooltip, formatter: items => { const b = analysis.bins[items[0]?.dataIndex]; return b ? `${b.label.replace('T', ' ')}<br/>Média: <b>${number(b.mean)} ${analysis.unit || ''}</b><br/>Leituras usadas: ${b.n}<br/>Cobertura: ${b.coverage == null ? 'frequência pendente' : `${number(b.coverage * 100)}%`}<br/>Menor / maior leitura: ${number(b.min)} / ${number(b.max)}` : ''; } }, dataZoom: labels.length > 48 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, textStyle: { color: muted }, borderColor: line }] : [], series });
  const hourly = analysis.profile;
  if (!hourly?.some(h => h.n)) return;
  mount('profile-chart', { ...base, xAxis: { ...base.xAxis, type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}h`), boundaryGap: false }, series: [{ type: 'line', name: 'Média por hora', data: hourly.map(s => s.mean), connectNulls: false, showSymbol: false, lineStyle: { color, width: 2 }, itemStyle: { color } }] });
  mount('distribution-chart', { ...base, grid: { ...base.grid, bottom: 44 }, xAxis: { ...base.xAxis, type: 'category', data: analysis.histogram.map(bin => number(bin.lower)), name: analysis.unit || '', nameTextStyle: { color: muted } }, yAxis: { ...base.yAxis, name: 'Leituras', minInterval: 1 }, series: [{ type: 'bar', name: 'Leituras na faixa', data: analysis.histogram.map(bin => bin.n), itemStyle: { color, opacity: .8 }, barCategoryGap: '12%' }] });
}
