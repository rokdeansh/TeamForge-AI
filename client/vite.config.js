import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor';
          if (id.includes('/@radix-ui/')) return 'radix-vendor';
          if (id.includes('/@dnd-kit/')) return 'dnd-vendor';
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/testSetup.js'] },
});
