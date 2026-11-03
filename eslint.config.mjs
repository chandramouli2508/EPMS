// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // ─── Global ignores ─────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
    ],
  },

  // ─── Base JS ────────────────────────────────────────────────────────────────
  js.configs.recommended,

  // ─── TypeScript (all workspaces) ────────────────────────────────────────────
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off', // Handled by TypeScript compiler
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Enforce feature-slice boundaries: no cross-feature deep imports
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Features can only import from each other via their index.ts
            {
              target: './apps/web/src/features',
              from: './apps/web/src/features',
              except: ['*/index.ts', '*/index.tsx'],
              message:
                'Cross-feature imports must go through the feature index.ts barrel file.',
            },
          ],
        },
      ],

      // No direct axios import outside shared/api
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'Do not import axios directly. Use the http client from shared/api instead.',
            },
          ],
          patterns: [
            {
              group: ['*/shared/api/client', '*/shared/api/token-store', '*/shared/api/auth-events'],
              message: 'Import from shared/api/index.ts, not internal modules directly.',
            },
          ],
        },
      ],
    },
  },

  // ─── React (web app only) ───────────────────────────────────────────────────
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with React 18 + Vite
      'react/prop-types': 'off', // TypeScript handles this
    },
  },

  // ─── NestJS / backend (allow decorators meta pattern) ───────────────────────
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ─── shared package: no framework imports ───────────────────────────────────
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', '@nestjs/*', 'class-validator', 'class-transformer', 'axios', 'prisma'],
              message:
                'packages/shared must be framework-agnostic. No framework imports allowed here.',
            },
          ],
        },
      ],
    },
  },

  // ─── Allow axios import inside shared/api only ─────────────────────────────
  {
    files: ['apps/web/src/shared/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
