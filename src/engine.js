export function execute(operation, payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.result); };
    worker.onerror = () => { worker.terminate(); reject(new Error('O processamento local foi interrompido. Reduza o arquivo ou o período e tente novamente.')); };
    worker.postMessage({ operation, payload });
  });
}
