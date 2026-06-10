/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Neon Auth base URL; set in .env.production. Absent in dev → no auth gate. */
  readonly VITE_NEON_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
