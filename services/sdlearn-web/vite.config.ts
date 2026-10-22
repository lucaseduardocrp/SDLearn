import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '../../', '');
  return {
    envDir: '../../',
    plugins: [react()],
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
    server: {
      host: true,
      allowedHosts: true,
      strictPort: false,
      port: 5173,
      proxy: {
        '/api': {
          target: environment.API_PROXY_TARGET ?? environment.API_BASE_URL ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
