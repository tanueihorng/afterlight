import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  { ignores: ["dist", "public", "scripts/*.mjs", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Accessibility is a product requirement here, not advice: every rule the plugin
      // recommends is an error. Rules it deliberately disables (deprecated ones, and stricter
      // rules that cannot see through component boundaries) stay off — promoting those would
      // flag correct code, e.g. any <input> wrapped by our own <Field> label component.
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, level]) => {
          const [severity, ...options] = Array.isArray(level) ? level : [level];
          const off = severity === "off" || severity === 0;
          return [rule, off ? "off" : ["error", ...options]];
        }),
      ),
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "no-console": "off" },
  },
);
