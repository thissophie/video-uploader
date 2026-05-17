const path = require('node:path');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const typedRecommendedConfig = typescriptEslint.configs[
  'flat/recommended-type-checked'
].map((config) => ({
  ...config,
  files: config.files ?? ['src/**/*.ts'],
}));

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.guard.ts'],
  },
  ...typedRecommendedConfig,
  {
    files: ['src/**/*.ts'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'tsconfig.json'),
        tsconfigRootDir: __dirname,
        ecmaVersion: 2018,
        sourceType: 'module',
      },
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
    },
  },
];
