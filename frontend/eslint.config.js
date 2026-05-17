const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const typedRecommendedConfig = typescriptEslint.configs[
  'flat/recommended-type-checked'
].map((config) => ({
  ...config,
  files: ['src/**/*.ts'],
}));

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', '.parcel-cache/**'],
  },
  ...typedRecommendedConfig,
  {
    files: ['src/**/*.ts'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
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
