// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const isStatic = process.env.PUBLIC_STATIC_DATA === "true";

export default defineConfig({
  integrations: [react()],
  ...(isStatic ? { base: "/house-lights", outDir: "dist" } : {}),
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  },
});
