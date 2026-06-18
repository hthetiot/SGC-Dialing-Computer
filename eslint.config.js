// Flat ESLint config (v9). Browser modules under public/src, Node/Bun scripts under scripts.
import globals from "globals";

export default [
  {
    files: ["public/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-undef": "error",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, Bun: "readonly" },
    },
    rules: { "no-unused-vars": "warn" },
  },
];
