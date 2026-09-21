// eslint.config.js
import { defineConfig } from "eslint/config";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
  eslintPluginPrettierRecommended,
  {
    rules: {
      semi: "error",
      "prefer-const": "error",
    },
  },
]);
