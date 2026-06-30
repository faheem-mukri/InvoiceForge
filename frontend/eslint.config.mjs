import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // We intentionally set state inside effects to synchronize React with
      // browser-only external systems (theme/reduced-motion via matchMedia,
      // one-shot sessionStorage reads) and to load data on mount. These are
      // valid uses of effects, so this strict rule is disabled project-wide.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
