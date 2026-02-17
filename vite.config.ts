import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Only generate sourcemaps in development to reduce bundle size in production
    sourcemap: mode === "development",

    // Optimize chunk splitting for better caching and parallel loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk: Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // UI Library chunk: All Radix UI components
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
            '@radix-ui/react-label',
            '@radix-ui/react-avatar',
            '@radix-ui/react-separator',
            '@radix-ui/react-scroll-area',
          ],

          // Charts chunk: Charting library (heavy)
          'vendor-charts': ['recharts'],

          // Query/State chunk: Data fetching and state management
          'vendor-query': ['@tanstack/react-query', 'zustand'],

          // Supabase chunk: Backend client
          'vendor-supabase': ['@supabase/supabase-js'],

          // Forms chunk: Form handling libraries
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // Icons chunk: Icon library
          'vendor-icons': ['lucide-react'],

          // Utils chunk: Utility libraries
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        },

        // Optimize chunk file names for better caching
        chunkFileNames: (chunkInfo) => {
          // Use content hash for long-term caching
          return 'assets/[name]-[hash].js';
        },

        // Optimize entry file names
        entryFileNames: 'assets/[name]-[hash].js',

        // Optimize asset file names
        assetFileNames: (assetInfo) => {
          // Group assets by type for better organization
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    // Increase chunk size warning limit for vendor chunks
    chunkSizeWarningLimit: 1000, // 1MB (vendor chunks can be large)

    // Enable minification in production
    minify: mode === 'production' ? 'esbuild' : false,

    // Optimize CSS code splitting
    cssCodeSplit: true,

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Enable compression
    reportCompressedSize: true,
  },

  // Compression plugins would be added here for production
  // vite-plugin-compression can add Brotli/Gzip compression
}));
