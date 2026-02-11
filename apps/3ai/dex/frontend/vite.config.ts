import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env variables regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  console.log('Environment variables:', env);
  
  return {
    server: {
      port: 5173,
      strictPort: true,
      open: true,
      host: true,
    },
    plugins: [
      react(),
      // Visualize bundle size
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
      }) as any,
      // PWA support
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: '3aiXchange DEX',
          short_name: '3aiXchange',
          description: 'Decentralized Exchange on 3ai Chain',
          theme_color: '#3182ce',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    // Resolve path aliases
    resolve: {
      alias: {
        '@atlas-sphere/atomic-swap-sdk': path.resolve(__dirname, '../../../../packages/atomic-swap-sdk/src'),
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@services': path.resolve(__dirname, './src/services'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@config': path.resolve(__dirname, './src/config'),
        '@theme': path.resolve(__dirname, './src/theme'),
        '@types': path.resolve(__dirname, './src/types'),
      },
    },
    // Environment variables to be exposed to the client
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: mode === 'production' ? 'esbuild' : false,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            chakra: ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion'],
            wagmi: ['wagmi', 'viem'],
          },
        },
      },
    },
    // Development server configuration
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Proxy API requests to avoid CORS issues
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // WebSocket proxy for real-time updates
        '/ws': {
          target: env.VITE_WS_URL || 'ws://localhost:3002',
          ws: true,
        },
      },
    },
    // Test configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
