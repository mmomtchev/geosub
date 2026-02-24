import {defineConfig} from 'eslint/config';
import mocha from 'eslint-plugin-mocha';
import preferArrow from 'eslint-plugin-prefer-arrow';
import globals from 'globals';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    {
        files: ['**/*.js'],

        extends: compat.extends('eslint:recommended'),

        plugins: {
            mocha,
            'prefer-arrow': preferArrow
        },

        languageOptions: {
            globals: {
                ...globals.mocha,
                ...globals.node
            },

            ecmaVersion: 2017,
            sourceType: 'commonjs'
        },

        rules: {
            'mocha/no-exclusive-tests': 'error',
            quotes: ['error', 'single']
        }
    },
    {
        files: ['**/*.mjs'],

        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module'
        },

        rules: {
            quotes: ['error', 'single']
        }
    }
]);
