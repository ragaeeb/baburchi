import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'solid-js',
    },
    optimizeDeps: {
        esbuildOptions: {
            jsx: 'automatic',
            jsxImportSource: 'solid-js',
        },
    },
    plugins: [solid()],
});
