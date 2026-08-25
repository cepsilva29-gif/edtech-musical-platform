/**
 * Ponte para o `npm run lint` da raiz (ESLint 8, config legado `.eslintrc.cjs`) - o mesmo padrao
 * de apps/mobile (decisao 36 de docs/ARCHITECTURE.md): parsing de JSX + regras de react-hooks.
 * Next.js 16 exige ESLint 9 (flat config, `eslint.config.mjs` nesta mesma pasta) para as regras
 * especificas de Next (`eslint-config-next`) - por isso este app tem as DUAS configs. Rode
 * `npm run lint` (raiz) para a checagem rapida de TS/JSX/hooks em todo o monorepo, ou
 * `cd apps/admin && npm run lint` para a checagem completa com as regras de Next (usa o eslint@9
 * local deste workspace, nao o eslint@8 hoisted na raiz - ver decisao correspondente).
 */
module.exports = {
  root: false,
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  extends: ['plugin:react-hooks/recommended'],
  env: { browser: true },
  ignorePatterns: ['.next', 'dist', 'out'],
};
