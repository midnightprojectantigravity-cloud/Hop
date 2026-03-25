import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: [
      'packages/engine/src/**/*.ts',
      'apps/web/src/**/*.ts',
      'apps/web/src/**/*.tsx',
    ],
    ignores: [
      '**/__tests__/**',
      'packages/engine/src/scenarios/**',
      'packages/engine/src/debug/**',
      'packages/**/scripts/**',
      'apps/**/scripts/**',
      'packages/engine/src/logic-turn-loop.ts',
      'packages/engine/src/skillTests.ts',
      'apps/web/src/app/use-debug-*.ts',
      'apps/web/src/components/game-board/useBoardJuicePresentation.ts',
    ],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
])
