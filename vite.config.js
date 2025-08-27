import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['apexcharts', 'react-apexcharts'],
          maps: ['leaflet', 'react-leaflet'],
          ui: ['@headlessui/react', 'framer-motion', 'lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // Backend is actually running on port 5000
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
