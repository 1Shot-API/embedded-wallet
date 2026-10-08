import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { fixupPluginRules } from "@eslint/compat";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import _import from "eslint-plugin-import";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescript from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default typescript.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".git/**",
      "*.log",
      "**/*.min.js",
      "**/*.bundle.js",
      // Workspace packages have their own trees; lint Branding Layer (+ tests) here.
      "host/**",
      "extension/**",
      "**/signer/**",
      ".cursor/**",
      // Loader stub embeds a regex in a data: URL string — escape noise only.
      "test/hooks/svgImportStub.mjs",
    ],
  },

  js.configs.recommended,
  ...typescript.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      import: fixupPluginRules(_import),
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/internal-regex": "^@/",
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      // Match CoinOperated / repo style: structured import groups, ascending.
      // Use import/no-duplicates (type-aware) instead of core no-duplicate-imports.
      "no-duplicate-imports": "off",
      "import/no-duplicates": ["error", { "prefer-inline": true }],
      "import/no-named-as-default": "off",
      "import/default": "off",
      "import/no-named-as-default-member": "off",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // Align with tsconfig unused checks; allow intentional `_` prefixes.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],

      // React 19 / Vite JSX transform — no React import required.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
    },
  },

  // Disable ESLint rules that conflict with Prettier formatting.
  prettier,
);
