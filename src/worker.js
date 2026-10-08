import { analyze, normalizeRows, resolveDuplicates } from './core.js';
self.onmessage = async ({ data: { operation, payload } }) => {
  try {
    let result;
    if (operation === 'analyze') result = analyze(payload.dataset, payload.config, payload.rule);
    else if (operation === 'normalize') { result = normalizeRows(payload.rows, payload.mapping, payload.context, payload.sourceId); result.combined = resolveDuplicates([...(payload.previous || []), ...result.observations]); }
    else if (operation === 'read') result = await (await import('./importer.js')).readInput(payload.file);
    else throw new Error('Operação local desconhecida.');
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
