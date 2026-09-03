import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const cfg = JSON.parse(raw);
      if (!process.env.VITE_FIREBASE_API_KEY && !env.VITE_FIREBASE_API_KEY && cfg.apiKey) {
        process.env.VITE_FIREBASE_API_KEY = cfg.apiKey;
      }
      if (!process.env.VITE_FIREBASE_AUTH_DOMAIN && !env.VITE_FIREBASE_AUTH_DOMAIN && cfg.authDomain) {
        process.env.VITE_FIREBASE_AUTH_DOMAIN = cfg.authDomain;
      }
      if (!process.env.VITE_FIREBASE_PROJECT_ID && !env.VITE_FIREBASE_PROJECT_ID && cfg.projectId) {
        process.env.VITE_FIREBASE_PROJECT_ID = cfg.projectId;
      }
      if (!process.env.VITE_FIREBASE_STORAGE_BUCKET && !env.VITE_FIREBASE_STORAGE_BUCKET && cfg.storageBucket) {
        process.env.VITE_FIREBASE_STORAGE_BUCKET = cfg.storageBucket;
      }
      if (!process.env.VITE_FIREBASE_MESSAGING_SENDER_ID && !env.VITE_FIREBASE_MESSAGING_SENDER_ID && cfg.messagingSenderId) {
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = cfg.messagingSenderId;
      }
      if (!process.env.VITE_FIREBASE_APP_ID && !env.VITE_FIREBASE_APP_ID && cfg.appId) {
        process.env.VITE_FIREBASE_APP_ID = cfg.appId;
      }
      if (!process.env.VITE_FIREBASE_DATABASE_ID && !env.VITE_FIREBASE_DATABASE_ID && cfg.firestoreDatabaseId) {
        process.env.VITE_FIREBASE_DATABASE_ID = cfg.firestoreDatabaseId;
      }
      if (!process.env.VITE_FIREBASE_OAUTH_CLIENT_ID && !env.VITE_FIREBASE_OAUTH_CLIENT_ID && cfg.oAuthClientId) {
        process.env.VITE_FIREBASE_OAUTH_CLIENT_ID = cfg.oAuthClientId;
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
