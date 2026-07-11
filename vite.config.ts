import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['three'],
  },
  build: {
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three/examples/jsm/postprocessing')) {
            return 'three-postprocessing';
          }
          if (id.includes('node_modules/three')) {
            return 'three';
          }
        },
      },
    },
  },
});
