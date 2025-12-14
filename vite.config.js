import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [vue()],
  optimizeDeps: {
    include: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/features', 'echarts/renderers', 'animejs/lib/anime.es.js'],
  },
  server: {
    open: 'index.html',
  },
  build: {
    chunkSizeWarningLimit: 650,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts')) return 'vendor-echarts';
          if (id.includes('node_modules/vue')) return 'vendor-vue';
          if (id.includes('node_modules/pinia')) return 'vendor-pinia';
          if (id.includes('node_modules/animejs')) return 'vendor-anime';
        },
      },
      input: {
        index: resolve(__dirname, 'index.html'),
        analysis: resolve(__dirname, 'analysis.html'),
        alerts: resolve(__dirname, 'alerts.html'),
        chat: resolve(__dirname, 'chat.html'),
        reports: resolve(__dirname, 'reports.html'),
        'vue-demo': resolve(__dirname, 'vue-demo.html'),
      },
    },
  },
});
