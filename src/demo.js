import { PARAMETERS, normalizeRows, resolveDuplicates, sha256 } from './core.js';
export async function createDemoCases() {
  const cases = [];
  for (const [index, environment] of ['escola', 'hospital'].entries()) {
    const sensorId = `DEMO-${index + 1}`;
    const units = Object.fromEntries(Object.entries(PARAMETERS).map(([key, p]) => [key, { unit: p.unit || 'índice sintético', confirmed: true }]));
    const context = { sensorId, offsetMinutes: -180, units };
    const rows = [];
    for (let day = 0; day < 7; day++) for (let minute = 0; minute < 1440; minute += 5) {
      if ((day === 2 && minute >= 600 && minute < 810) || (day === 4 && minute >= 360 && minute < 420)) continue;
      const hour = minute / 60, occupied = environment === 'escola' ? hour >= 7 && hour < 17 && day < 5 : true;
      const bump = occupied ? Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)) : 0;
      const noise = Math.sin(minute * .173 + day * 7.2 + index * 2.3);
      const iso = new Date(Date.UTC(2026, 9, 1 + day, 0, minute)).toISOString().slice(0, 19);
      const row = { data_local: iso, CO2: Math.round(440 + (index ? 380 : 1020) * bump + noise * 55), 'PM2.5': +(6 + 11 * bump + 3 * noise + index * 2).toFixed(2), PM1: +(3 + 7 * bump + noise).toFixed(2), PM10: +(11 + 19 * bump + noise * 4).toFixed(2), Temp: +(22 + bump * 3 + noise * .6 + index).toFixed(2), Umid: +(52 + noise * 5 - bump * 4).toFixed(2), Pressao: +(1013 + Math.sin(day) * 3 + noise).toFixed(2), VOC: Math.round(80 + bump * 40), NOx: Math.round(20 + bump * 15) };
      rows.push(row);
    }
    rows.push({ ...rows[20] });
    rows.push({ ...rows[40], CO2: rows[40].CO2 + 220 });
    rows.push({ data_local: '31/02/2026 10:00', CO2: 850 });
    const bytes = new TextEncoder().encode(JSON.stringify(rows));
    const hash = await sha256(bytes), sourceId = hash.slice(0, 16);
    const mapping = { format: 'wide', date: 'data_local', columns: Object.fromEntries(Object.keys(PARAMETERS).map(k => [k, k])) };
    const normalized = normalizeRows(rows, mapping, context, sourceId);
    cases.push({ id: `demo-${environment}`, name: environment === 'escola' ? 'Escola · sala de aula' : 'Hospital · ambiente interno', environment, sensorId, sensorLabel: `Sensor demonstrativo ${index + 1}`, synthetic: true, offsetMinutes: -180, nominalIntervalSeconds: 300, units, notes: 'Dados gerados por fórmula determinística para demonstrar o fluxo. Não representam medições reais.', createdAt: '2026-10-08T00:00:00Z', sources: [{ id: sourceId, name: `${sensorId}.json`, hash, size: bytes.length, origin: 'synthetic', bytes, mapping, rows: rows.length }], observations: resolveDuplicates(normalized.observations), issues: normalized.issues, importedRows: normalized.importedRows, rejectedRows: normalized.rejectedRows, decisions: [] });
  }
  return cases;
}
