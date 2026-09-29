// The rules Obsidian's plugin review runs: ESLint's own recommended set plus
// typescript-eslint's type-checked recommendations. `npm run lint` is part of
// CI, so a warning the review would raise fails the build here first.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['main.js', 'esbuild.config.mjs', 'version-bump.mjs', 'eslint.config.mjs', '.github/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // tsconfig.json deliberately excludes the tests, so there is no type
    // information for them; the syntactic rules still apply.
    files: ['tests/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);
