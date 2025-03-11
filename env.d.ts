/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CF_ACCOUNT_ID: string;
  readonly VITE_CF_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}