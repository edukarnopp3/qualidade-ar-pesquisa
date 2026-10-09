import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf("app.addEventListener('change', async event => {");
const finish = main.indexOf("app.addEventListener('submit', async event => {", start);
assert.ok(start >= 0 && finish > start);
// Only the lazy module loader is injected; the production callback is executed.
const callbackSource = main.slice(start, finish).replace("await import('./packages.js')", 'await loadPackages()');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const savedPackage = id => ({
  dataset: { id, name: id, sources: [], observations: [], hasInputs: false },
  run: { id: `${id}-run`, datasetId: id, analysis: { config: { parameter: 'CO2' }, rule: null } },
  history: [{ id: `${id}-run`, datasetId: id, analysis: { config: { parameter: 'CO2' }, rule: null } }],
});

function harness() {
  let callback, modal = null, imports = 0, renders = 0;
  const reads = new Map(), packages = new Map(), messages = [], remembered = [];
  const original = savedPackage('original');
  const state = { cases: [original.dataset], activeId: original.dataset.id, run: original.run, config: original.run.analysis.config, history: original.history, rules: [], archived: true, view: 'sources' };
  const context = {
    state, requestId: 0, pending: null,
    app: { addEventListener(type, handler) { assert.equal(type, 'change'); callback = handler; } },
    document: { getElementById(id) { assert.equal(id, 'main-dialog'); return modal; } },
    toast(message) { messages.push(message); }, render() { renders++; },
    rememberInputs(dataset) { remembered.push(dataset.id); },
    execute(operation, { file }) { assert.equal(operation, 'read'); return reads.get(file).promise; },
    async loadPackages() { return { openPackage: file => packages.get(file).promise }; },
    importDialog() { imports++; modal = { kind: 'import' }; },
  };
  vm.createContext(context); vm.runInContext(callbackSource, context);
  return {
    context, state, messages, remembered,
    read(file) { const wait = deferred(); reads.set(file, wait); return { ...wait, action: callback({ target: { id: 'file-input', files: [file] } }) }; },
    open(file) { const wait = deferred(); packages.set(file, wait); return { ...wait, action: callback({ target: { id: 'package-input', files: [file] } }) }; },
    newModal() { modal = { kind: 'new-form' }; return modal; },
    get modal() { return modal; }, get imports() { return imports; }, get renders() { return renders; },
  };
}

test('leitura vigente registra somente seu arquivo e abre a conferência', async () => {
  const h = harness(), input = { name: 'atual.csv' }, read = h.read({});
  read.resolve(input); await read.action;
  assert.equal(h.context.pending, input); assert.equal(h.imports, 1);
  assert.equal(h.state.activeId, 'original'); assert.equal(h.renders, 0);
});

test('leitura antiga não substitui arquivo e modal da leitura mais recente', async () => {
  const h = harness(), first = h.read({}), second = h.read({});
  const latest = { name: 'atual.csv' };
  second.resolve(latest); await second.action; const currentModal = h.modal;
  first.resolve({ name: 'antigo.csv' }); await first.action;
  assert.equal(h.context.pending, latest); assert.equal(h.imports, 1); assert.equal(h.modal, currentModal);
});

test('outro formulário aberto durante leitura é preservado mesmo sem mudar requestId', async () => {
  const h = harness(), read = h.read({}), generation = h.context.requestId;
  const form = h.newModal(); read.resolve({ name: 'tardio.csv' }); await read.action;
  assert.equal(h.context.requestId, generation); assert.equal(h.context.pending, null);
  assert.equal(h.imports, 0); assert.equal(h.modal, form);
});

test('pacote antigo não sobrescreve o pacote aberto pela operação mais recente', async () => {
  const h = harness(), first = h.open({}), second = h.open({}), latest = savedPackage('latest');
  second.resolve(latest); await second.action;
  first.resolve(savedPackage('late')); await first.action;
  assert.equal(h.state.activeId, 'latest'); assert.equal(h.state.run, latest.run);
  assert.deepEqual(h.state.cases.map(item => item.id), ['original', 'latest']);
  assert.deepEqual(h.remembered, ['latest']); assert.equal(h.renders, 1);
});

test('pacote tardio não altera caso ou fecha formulário escolhido depois', async () => {
  const h = harness(), opening = h.open({}), before = { ...h.state, cases: [...h.state.cases], history: [...h.state.history] };
  const form = h.newModal(); opening.resolve(savedPackage('late')); await opening.action;
  assert.deepEqual(h.state, before); assert.equal(h.modal, form);
  assert.deepEqual(h.remembered, []); assert.equal(h.renders, 0);
});

test('troca de caso invalidando a abertura pendente mantém o novo caso', async () => {
  const h = harness(), opening = h.open({}), next = savedPackage('selected-later');
  h.context.requestId++; h.state.cases.push(next.dataset); h.state.activeId = next.dataset.id;
  h.state.run = next.run; h.state.config = next.run.analysis.config;
  opening.resolve(savedPackage('late')); await opening.action;
  assert.equal(h.state.activeId, 'selected-later'); assert.equal(h.state.run, next.run);
  assert.deepEqual(h.state.cases.map(item => item.id), ['original', 'selected-later']);
  assert.deepEqual(h.remembered, []); assert.equal(h.renders, 0);
});

test('leitura tardia não substitui pacote aberto depois e erro obsoleto fica silencioso', async () => {
  const h = harness(), first = h.read({}), second = h.open({}), latest = savedPackage('latest');
  second.resolve(latest); await second.action;
  first.reject(new Error('Falha obsoleta')); await first.action;
  assert.equal(h.state.activeId, 'latest'); assert.equal(h.context.pending, null); assert.equal(h.imports, 0);
  assert.ok(!h.messages.includes('Falha obsoleta'));
});
