import { read, utils } from 'xlsx';
import { sha256 } from './core.js';
import { inferMapping } from './mappings.js';

export const MAX_INPUT_ROWS = 250000;

// Inventory is separate from validation of the chosen sheet. An invalid
// summary sheet must not prevent importing a valid sensor sheet.
export function validateSelectedSheet(sheet) {
  if (!sheet) throw new Error('Selecione uma aba existente para importar.');
  const errors = sheet.validationErrors || [];
  if (errors.length) throw new Error(`A aba ${sheet.name}: ${errors.join(' ')}`);
  if (!sheet.rows?.length) throw new Error('A planilha selecionada não contém linhas de dados.');
  return sheet;
}

export async function readInput(file) {
  if (file.size > 50 * 1024 * 1024) throw new Error('O limite desta versão é 50 MB por arquivo. Divida a exportação em períodos menores.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  // raw:true preserves CSV text before locale/date interpretation. XLSX/XLS
  // typed numeric cells remain numeric; their workbook epoch is retained.
  const workbook = read(bytes, { type: 'array', cellDates: false, raw: true });
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  // The nature marker belongs to the source, even when it appears in a sheet
  // that cannot be imported (for example an oversized summary).
  let synthetic = false;
  for (const name of workbook.SheetNames) {
    for (const address in workbook.Sheets[name]) {
      const value = workbook.Sheets[name][address]?.v;
      if (typeof value === 'string' && value.includes('DADOS INTEGRALMENTE SINTÉTICOS')) { synthetic = true; break; }
    }
    if (synthetic) break;
  }
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name], validationErrors = [];
    const range = worksheet['!ref'] ? utils.decode_range(worksheet['!ref']) : null;
    const rowStart = range ? range.s.r + 2 : 2;
    if (range && range.e.r - range.s.r > MAX_INPUT_ROWS) {
      return { name, headers: [], rows: [], mapping: { ...inferMapping([]), date1904, rowStart }, date1904, originalSensorId: null, validationErrors: ['O limite desta versão é 250 mil linhas por aba. Divida o período.'] };
    }
    const array = utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true, blankrows: true });
    const headers = (array.shift() || []).map((v, i) => String(v ?? `Coluna ${i + 1}`));
    if (new Set(headers).size !== headers.length) validationErrors.push('Há cabeçalhos duplicados. Corrija a exportação para preservar a origem de cada coluna.');
    const rows = array.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null])));
    if (!rows.length || !rows.some(row => Object.values(row).some(value => value != null && String(value).trim()))) validationErrors.push('A planilha selecionada não contém linhas de dados.');
    const mapping = { ...inferMapping(headers), date1904, rowStart };
    const ids = new Set(mapping.sensor ? rows.map(row => String(row[mapping.sensor] ?? '').trim()).filter(Boolean) : []);
    if (ids.size > 1) validationErrors.push('Contém identificadores de vários sensores. Separe a exportação por sensor para preservar os casos.');
    return { name, headers, rows, mapping, date1904, rowStart, originalSensorId: ids.size === 1 ? [...ids][0] : null, validationErrors };
  });
  const usable = sheets.filter(sheet => !sheet.validationErrors.length);
  const best = usable.find(sheet => sheet.name === 'Dados brutos') || usable.find(sheet => sheet.name === 'Dados') || usable.find(sheet => sheet.mapping.date) || usable[0];
  if (!best) throw new Error(`Nenhuma aba utilizável. ${sheets.map(sheet => `${sheet.name}: ${sheet.validationErrors.join(' ')}`).join(' ') || 'O arquivo não contém abas de dados.'}`);
  return { name: file.name, size: file.size, hash: await sha256(bytes), bytes, sheets, selectedSheet: best.name, synthetic, date1904 };
}
