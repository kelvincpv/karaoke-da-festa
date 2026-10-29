import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
const publicEnvNames = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_YOUTUBE_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'YOUTUBE_API_KEY',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react()],
  // Disable prefix matching: only these public names may reach the client.
  envPrefix: [],
  define: Object.fromEntries(
    publicEnvNames.map((name) => [
      `import.meta.env.${name}`,
      JSON.stringify(env[name] ?? ''),
    ]),
  ),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  };
});
