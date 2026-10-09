const snapshots = new WeakMap();

function freezeTree(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeTree(child);
  return Object.freeze(value);
}

// Cases are replaced transactionally. A snapshot is shared by runs of the same
// case revision; changing the case never mutates an existing execution.
export function cloneCase(dataset) {
  const sources = dataset.sources || [];
  const cloned = structuredClone({ ...dataset, sources: sources.map(({ bytes, ...source }) => source) });
  cloned.sources = cloned.sources.map((source, i) => sources[i].bytes ? { ...source, bytes: sources[i].bytes } : source);
  return cloned;
}

export function snapshotCase(dataset) {
  if (snapshots.has(dataset)) return snapshots.get(dataset);
  const snapshot = structuredClone({
    id: dataset.id, name: dataset.name, environment: dataset.environment,
    synthetic: Boolean(dataset.synthetic), sensorId: dataset.sensorId,
    sensorLabel: dataset.sensorLabel, offsetMinutes: dataset.offsetMinutes,
    nominalIntervalSeconds: dataset.nominalIntervalSeconds ?? null,
    units: dataset.units || {}, sources: (dataset.sources || []).map(({ bytes, ...source }) => source),
    observations: dataset.observations || [], issues: dataset.issues || [],
    decisions: dataset.decisions || [], notes: dataset.notes || '',
    importedRows: dataset.importedRows || 0, rejectedRows: dataset.rejectedRows || 0,
    outdoorContext: dataset.outdoorContext || null,
    hasInputs: dataset.hasInputs !== false, createdAt: dataset.createdAt,
    revision: dataset.revision || 1,
  });
  freezeTree(snapshot);
  snapshots.set(dataset, snapshot);
  return snapshot;
}

export function createExecution(dataset, analysis) {
  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    datasetId: dataset.id, caseName: dataset.name, sensorId: dataset.sensorId,
    offsetMinutes: dataset.offsetMinutes, analysis,
    datasetSnapshot: snapshotCase(dataset), reproductionStatus: 'snapshot',
  };
}

export function executionDataset(dataset, run) {
  if (!run?.datasetSnapshot) {
    if (run?.reproductionStatus === 'results-only') return { ...dataset, name: run.caseName, observations: [], issues: [], decisions: [], sources: [], hasInputs: false, legacyContext: true, reproductionStatus: 'results-only' };
    return { ...dataset, legacyContext: true, reproductionStatus: 'legacy-context-unavailable' };
  }
  const snapshot = run.datasetSnapshot;
  const hasInputs = dataset.hasInputs !== false && snapshot.hasInputs !== false;
  return {
    ...snapshot, hasInputs, reproductionStatus: run.reproductionStatus || 'snapshot',
    sources: (snapshot.sources || []).map(source => {
      const original = hasInputs && dataset.sources?.find(s => s.id === source.id && s.hash === source.hash);
      return original?.bytes ? { ...source, bytes: original.bytes } : { ...source };
    }),
  };
}

export function validateCaseNature(dataset, synthetic) {
  if (dataset && Boolean(dataset.synthetic) !== Boolean(synthetic)) {
    throw new Error('Dados sintéticos e medições reais não podem ser combinados no mesmo caso. Crie outro caso.');
  }
}

export function validateOutdoorContext(outdoor) {
  if (!outdoor) return null;
  if (!Number.isFinite(outdoor.value) || outdoor.value < 0) throw new Error('Informe CO₂ externo finito e não negativo.');
  if (!['ppm', 'ppb', '%'].includes(outdoor.unit)) throw new Error('Informe a unidade do CO₂ externo: ppm, ppb ou %.');
  if (!String(outdoor.source || '').trim()) throw new Error('Documente a fonte e o período do CO₂ externo.');
  return { value: outdoor.value, unit: outdoor.unit, source: String(outdoor.source).trim(), recordedAt: new Date().toISOString() };
}

export async function commitCaseChange(dataset, mutate, calculate, commit) {
  if (dataset.hasInputs === false) throw new Error('Este pacote permite visualizar resultados. Recupere as entradas para editar ou recalcular.');
  const candidate = cloneCase(dataset);
  await mutate(candidate);
  candidate.revision = (dataset.revision || 1) + 1;
  const result = await calculate(candidate);
  commit(candidate, result);
  return candidate;
}
