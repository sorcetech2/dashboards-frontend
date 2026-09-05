import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: configDirectory,
  resolvePluginsRelativeTo: configDirectory
});

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'public/**',
      'output/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts'
    ]
  },
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: config.files ?? ['**/*.{ts,tsx,mts,cts}']
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDirectory
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreIIFE: false,
          // `void` makes intentional fire-and-forget calls explicit, which is
          // required for React event handlers that cannot return a promise.
          ignoreVoid: true
        }
      ]
    }
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['vitest.config.ts'],
    ...tseslint.configs.disableTypeChecked
  }
);
