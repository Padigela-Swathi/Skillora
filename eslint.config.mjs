import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "supabase/functions/**/index.ts", "supabase/functions/_shared/auth.ts", "test-results/**", "playwright-report/**", "reference/**"] },
];
