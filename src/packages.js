import JSZip from 'jszip';
import { sha256, SOFTWARE_VERSION } from './core.js';

export function readBounded(entry, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, rejected = false;
    const stream = entry.internalStream('uint8array');
    stream.on('data', chunk => { size += chunk.length; if (size > limit) { rejected = true; stream.pause(); reject(new Error('Conteúdo descompactado excede o limite desta versão.')); } else chunks.push(chunk); });
    stream.on('error', reject);
    stream.on('end', () => { if (rejected) return; const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } resolve(output); });
    stream.resume();
  });
}

export async function createPackage(dataset, run, history, complete = true) {
  const zip = new JSZip();
  const sanitized = { ...dataset, sources: dataset.sources.map(({ bytes, ...source }) => source), observations: complete ? dataset.observations : [], issues: complete ? dataset.issues : [], hasInputs: complete };
  const entries = { 'case.json': JSON.stringify(sanitized), 'execution.json': JSON.stringify(run), 'history.json': JSON.stringify(history.slice(-30)) };
  if (complete) for (const source of dataset.sources) if (source.bytes) entries[`inputs/${source.id}.bin`] = source.bytes;
  const checksums = {};
  for (const [path, data] of Object.entries(entries)) { checksums[path] = await sha256(data); zip.file(path, data); }
  zip.file('manifest.json', JSON.stringify({ schemaVersion: 1, software: SOFTWARE_VERSION, complete, createdAt: new Date().toISOString(), containsOriginals: complete, files: checksums }, null, 2));
  zip.file('LEIA-ME.txt', complete ? 'Pacote completo: contém dados originais e normalizados. Guarde localmente. Reabrir preserva os resultados; recalcular cria outra execução.' : 'Pacote compartilhável: contém resultados agregados e metadados. Não contém as leituras originais/normalizadas e não permite recalcular sem recuperar as entradas. Metadados e resultados ainda podem identificar o local estudado: revise antes de compartilhar.');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export async function openPackage(file) {
  if (file.size > 80 * 1024 * 1024) throw new Error('Pacote maior que o limite de 80 MB desta versão.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Este arquivo não é um pacote de análise reconhecido.');
  const manifestText = new TextDecoder().decode(await readBounded(manifestFile, 100000));
  const manifest = JSON.parse(manifestText);
  if (manifest.schemaVersion !== 1) throw new Error('Versão de pacote incompatível. Abra com a versão do software que o criou.');
  const files = Object.entries(manifest.files || {});
  if (files.length > 150) throw new Error('O pacote contém arquivos demais.');
  const content = {};
  let totalSize = 0;
  for (const [path, expected] of files) {
    if (!/^(case|execution|history)\.json$|^inputs\/[a-zA-Z0-9-]+\.bin$/.test(path)) throw new Error('Estrutura inesperada no pacote.');
    const entry = zip.file(path);
    if (!entry) throw new Error(`Arquivo ausente no pacote: ${path}`);
    const bytes = await readBounded(entry, 160 * 1024 * 1024 - totalSize);
    totalSize += bytes.length;
    if (totalSize > 160 * 1024 * 1024) throw new Error('Conteúdo descompactado excede o limite desta versão.');
    if (await sha256(bytes) !== expected) throw new Error(`Integridade divergente: ${path}. O pacote foi alterado ou está corrompido.`);
    content[path] = bytes;
  }
  const decode = path => JSON.parse(new TextDecoder().decode(content[path]));
  const dataset = decode('case.json'), run = decode('execution.json'), history = decode('history.json');
  if (!Array.isArray(dataset.observations) || !Array.isArray(dataset.sources) || !run.analysis?.bins || !Array.isArray(history)) throw new Error('O conteúdo do pacote não segue o esquema esperado.');
  for (const source of dataset.sources) if (manifest.complete) {
    source.bytes = content[`inputs/${source.id}.bin`];
    if (!source.bytes || await sha256(source.bytes) !== source.hash) throw new Error('Hash do arquivo original incompatível com os metadados.');
  }
  dataset.hasInputs = manifest.complete;
  return { dataset, run, history, manifest };
}
