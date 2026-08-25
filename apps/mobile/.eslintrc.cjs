/**
 * Estende a base do monorepo (.eslintrc.cjs na raiz) com o que apps/mobile precisa e a base nao
 * previa (nenhum app React existia ate a FASE 10): parsing de JSX e as regras de react-hooks.
 * Mesmo padrao de "app estende a base e sobrepoe o especifico do seu framework" da decisao 5 de
 * docs/ARCHITECTURE.md.
 */
module.exports = {
  root: false,
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  extends: ['plugin:react-hooks/recommended'],
  env: { browser: true },
  ignorePatterns: ['.expo', 'dist', 'web-build'],
};
