import { mkdir, writeFile } from 'node:fs/promises';
import { utils, write } from 'xlsx';
import { createDemoCases } from '../src/demo.js';
await mkdir('examples', { recursive: true });
for (const c of await createDemoCases()) {
  const rows = JSON.parse(new TextDecoder().decode(c.sources[0].bytes));
  const wb = utils.book_new(); utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Dados brutos'); utils.book_append_sheet(wb, utils.aoa_to_sheet([['Origem', 'DADOS INTEGRALMENTE SINTÉTICOS'], ['Ambiente', c.environment], ['Sensor', c.sensorId], ['Intervalo nominal', '300 segundos'], ['Fuso dos horários', 'UTC-3'], ['Uso', 'Exercício do software, sem evidência ambiental real']]), 'Sobre o exemplo');
  await writeFile(`examples/${c.environment}-sintetica.xlsx`, write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
