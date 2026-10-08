import { read, utils } from 'xlsx';
import { sha256 } from './core.js';
import { inferMapping } from './mappings.js';

export async function readInput(file) {
  if (file.size > 50 * 1024 * 1024) throw new Error('O limite desta versão é 50 MB por arquivo. Divida a exportação em períodos menores.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const workbook = read(bytes, { type: 'array', cellDates: false });
  const sheets = workbook.SheetNames.map(name => {
    const array = utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true });
    const headers = (array.shift() || []).map((v, i) => String(v ?? `Coluna ${i + 1}`));
    if (new Set(headers).size !== headers.length) throw new Error(`A aba ${name} tem cabeçalhos duplicados. Corrija a exportação para preservar a origem de cada coluna.`);
    const rows = array.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null])));
    if (rows.length > 250000) throw new Error('O limite desta versão é 250 mil linhas por aba. Divida o período.');
    return { name, headers, rows, mapping: inferMapping(headers) };
  });
  const best = sheets.find(s => s.name === 'Dados brutos') || sheets.find(s => s.name === 'Dados') || sheets.find(s => s.mapping.date) || sheets[0];
  if (!best?.rows.length) throw new Error('A planilha selecionada não contém linhas de dados.');
  const synthetic = sheets.some(s => [...s.headers, ...s.rows.slice(0, 10).flatMap(r => Object.values(r))].some(v => String(v ?? '').includes('DADOS INTEGRALMENTE SINTÉTICOS')));
  return { name: file.name, size: file.size, hash: await sha256(bytes), bytes, sheets, selectedSheet: best.name, synthetic };
}
