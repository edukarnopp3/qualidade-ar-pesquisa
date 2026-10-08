import { normalizeKey, parameterKey } from './core.js';
export function inferMapping(headers) {
  const find = aliases => headers.find(h => aliases.includes(normalizeKey(h))) || '';
  const date = find(['datalocal', 'datahora', 'timestamplocal', 'timestamp', 'datetime', 'data']);
  const parameter = find(['parametrosolicitado', 'parametro', 'sensornobanco', 'parameter']);
  const value = find(['valor', 'value']), unit = find(['unidade', 'unit']);
  const columns = {};
  for (const h of headers) { const key = parameterKey(h); if (key) columns[key] = h; }
  return { format: parameter && value ? 'long' : 'wide', date, parameter, value, unit, columns };
}
