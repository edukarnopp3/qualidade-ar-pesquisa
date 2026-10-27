import { init } from 'echarts/core';
import { LineChart, BarChart, CustomChart, BoxplotChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';
import { PARAMETERS } from './core.js';
import { rangeRuns, weekdayBoxes, WEEKDAYS } from './chart-data.js';
use([LineChart, BarChart, CustomChart, BoxplotChart, GridComponent, TooltipComponent, DataZoomComponent, LegendComponent, CanvasRenderer]);
let charts = [];
export function disposeCharts() { charts.forEach(c => c.dispose()); charts = []; }
export function resizeCharts() { charts.forEach(c => c.resize()); }
const number = value => value == null ? 'Sem dados' : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, v => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[v]);
function rangeSeries(rows, color) {
  const runs = rangeRuns(rows);
  return {
    name: 'Mínimo–máximo', type: 'custom', silent: true, clip: true, z: 1,
    itemStyle: { color, opacity: .2 }, tooltip: { show: false },
    encode: { x: [0, 3], y: [1, 2] },
    data: runs.map(run => [run[0].index, Math.min(...run.map(p => p.min)), Math.max(...run.map(p => p.max)), run.at(-1).index]),
    renderItem: (params, api) => {
      const run = runs[params.dataIndex];
      if (run.length === 1) {
        const lower = api.coord([run[0].index, run[0].min]), upper = api.coord([run[0].index, run[0].max]);
        return { type: 'rect', shape: { x: lower[0] - 2, y: upper[1], width: 4, height: Math.max(1, lower[1] - upper[1]) }, style: { fill: color, opacity: .3 } };
      }
      return { type: 'polygon', shape: { points: [...run.map(p => api.coord([p.index, p.max])), ...run.slice().reverse().map(p => api.coord([p.index, p.min]))] }, style: { fill: color, opacity: .2 } };
    },
  };
}
export function renderCharts(dataset, analysis, dark) {
  disposeCharts();
  const p = PARAMETERS[analysis.parameter], color = dark ? p.dark : p.color;
  analysis = { ...analysis, unit: escapeHtml(analysis.unit) };
  const ink = dark ? '#e6ebf0' : '#1e2b36', muted = dark ? '#b2bcc6' : '#4f5b66', line = dark ? '#424c56' : '#dae1e7', surface = dark ? '#20262c' : '#ffffff';
  const base = { animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 200, textStyle: { fontFamily: 'Segoe UI, Arial, sans-serif', color: ink }, grid: { left: 55, right: 24, top: 25, bottom: 48 }, tooltip: { trigger: 'axis', backgroundColor: surface, borderColor: line, textStyle: { color: ink }, confine: true }, xAxis: { axisLabel: { color: muted }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } }, yAxis: { type: 'value', name: analysis.unit || 'Unidade pendente', nameTextStyle: { color: muted, align: 'left' }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: line, type: 'dashed' } } } };
  function mount(id, option) { const element = document.getElementById(id); if (!element) return; const chart = init(element, null, { renderer: 'canvas' }); chart.setOption(option); charts.push(chart); }
  const labels = analysis.bins.map(b => b.label);
  const meanName = analysis.config.window === 'day' ? 'Média diária' : 'Média horária';
  const legend = names => ({ top: 0, left: 48, textStyle: { color: muted }, itemWidth: 19, itemHeight: 8, data: names.map(name => ({ name, icon: name === 'Mínimo–máximo' ? 'rect' : undefined })) });
  const series = [rangeSeries(analysis.bins, color), { name: meanName, type: 'line', z: 3, data: analysis.bins.map(b => b.mean), connectNulls: false, symbol: 'circle', showSymbol: labels.length <= 48, symbolSize: 5, lineStyle: { width: 2.5, color }, itemStyle: { color } }];
  if (analysis.rule && !analysis.rule.requiresOutdoor) series.push({ name: 'Referência em janelas elegíveis', type: 'line', data: analysis.bins.map(b => b.eligibility === 'admissivel' ? analysis.rule.threshold : null), connectNulls: false, showSymbol: labels.length < 48, lineStyle: { type: 'dashed', width: 1.5, color: muted }, itemStyle: { color: muted } });
  mount('time-chart', { ...base, legend: legend(series.map(s => s.name)), grid: { ...base.grid, top: 48, bottom: labels.length > 48 ? 65 : 40 }, xAxis: { ...base.xAxis, type: 'category', data: labels, boundaryGap: false, axisLabel: { color: muted, formatter: v => analysis.config.window === 'day' ? v.slice(5, 10).split('-').reverse().join('/') : `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}` } }, tooltip: { ...base.tooltip, formatter: items => { const b = analysis.bins[(items.find(item => item.seriesName === meanName) || items[0])?.dataIndex]; return b ? `${escapeHtml(b.label.replace('T', ' '))}<br/>Média: <b>${number(b.mean)} ${analysis.unit || ''}</b><br/>Mediana: ${number(b.median)}<br/>Mínimo / máximo: ${number(b.min)} / ${number(b.max)}<br/>Leituras usadas: ${b.n}<br/>Cobertura: ${b.coverage == null ? 'frequência pendente' : `${number(b.coverage * 100)}%`}` : ''; } }, dataZoom: labels.length > 48 ? [{ type: 'inside', filterMode: 'none' }, { type: 'slider', filterMode: 'none', height: 18, bottom: 8, textStyle: { color: muted }, borderColor: line }] : [], series });
  const hourly = analysis.profile;
  if (!hourly?.some(h => h.n)) return;
  const profileSeries = [rangeSeries(hourly, color), { type: 'line', z: 3, name: 'Média', data: hourly.map(s => s.mean), connectNulls: false, showSymbol: true, symbolSize: 3, lineStyle: { color, width: 2.5 }, itemStyle: { color } }];
  if (hourly.some(h => h.median != null)) profileSeries.push({ type: 'line', z: 3, name: 'Mediana', data: hourly.map(h => h.median ?? null), connectNulls: false, showSymbol: true, symbol: 'rect', symbolSize: 3, lineStyle: { color: ink, type: 'dashed', width: 1.5 }, itemStyle: { color: ink } });
  mount('profile-chart', { ...base, legend: legend(profileSeries.filter(s => s.type !== 'custom' || s.data.length).map(s => s.name)), grid: { ...base.grid, top: 48 }, xAxis: { ...base.xAxis, type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}h`), boundaryGap: false }, tooltip: { ...base.tooltip, formatter: items => { const h = hourly[(items.find(item => item.seriesName === 'Média') || items[0])?.dataIndex]; return h ? `${h.hour}h · dias do recorte<br/>Média: <b>${number(h.mean)} ${analysis.unit}</b><br/>Mediana: ${number(h.median)}<br/>Mínimo / máximo: ${number(h.min)} / ${number(h.max)}<br/>Leituras usadas: ${h.n}` : ''; } }, series: profileSeries });
  if (analysis.weekdays) mount('weekday-chart', { ...base, grid: { ...base.grid, top: 25 }, xAxis: { ...base.xAxis, type: 'category', data: WEEKDAYS.map(d => d.slice(0, 3)), boundaryGap: true }, tooltip: { ...base.tooltip, formatter: items => { const day = items[0]?.dataIndex, b = analysis.weekdays.find(entry => entry.day === day); return b ? `${WEEKDAYS[day]} · ${b.n} leituras<br/>Mínimo: ${number(b.min)}<br/>Q1: ${number(b.q1)}<br/>Mediana: <b>${number(b.median)} ${analysis.unit}</b><br/>Q3: ${number(b.q3)}<br/>Máximo: ${number(b.max)}` : ''; } }, series: [{ name: 'Distribuição por dia', type: 'boxplot', data: weekdayBoxes(analysis.weekdays), itemStyle: { color, opacity: .65, borderColor: color, borderWidth: 1.5 } }] });
  mount('distribution-chart', { ...base, grid: { ...base.grid, bottom: 44 }, xAxis: { ...base.xAxis, type: 'category', data: analysis.histogram.map(bin => number(bin.lower)), name: analysis.unit || '', nameTextStyle: { color: muted } }, yAxis: { ...base.yAxis, name: 'Leituras', minInterval: 1 }, series: [{ type: 'bar', name: 'Leituras na faixa', data: analysis.histogram.map(bin => bin.n), itemStyle: { color, opacity: .8 }, barCategoryGap: '12%' }] });
}
