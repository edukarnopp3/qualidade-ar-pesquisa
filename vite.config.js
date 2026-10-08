import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2022' }, server: { port: 8765, strictPort: true }, preview: { port: 4176, strictPort: true } });
