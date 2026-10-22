import { httpClient } from './httpClient';
import { localClient } from './localClient';
import type { ApiClient } from './types';

/** `npm run dev:offline` (or VITE_API_MODE=local) runs entirely in the browser without the API or PostgreSQL. */
export const api: ApiClient = import.meta.env.MODE === 'offline' || import.meta.env.VITE_API_MODE === 'local' ? localClient : httpClient;
export type { ApiClient } from './types';
