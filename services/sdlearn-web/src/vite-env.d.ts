/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'http' | 'local';
  readonly VITE_API_BASE_URL?: string;
}
