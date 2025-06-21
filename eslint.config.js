import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    {
        extends: ['js/recommended'],
        files: ['**/*.{js,mjs,ts,mts,cts}'],
        plugins: { js },
    },
    {
        files: ['**/*.{js,mjs,ts,mts,cts}'],
        languageOptions: { ecmaVersion: 'latest', globals: { ...globals.browser, ...globals.es2025 } },
    },
    tseslint.configs.recommended,
    perfectionist.configs['recommended-natural'],
    eslintPluginPrettierRecommended,
    eslintConfigPrettier,
]);
