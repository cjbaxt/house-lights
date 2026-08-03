// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ["**/public/data/**"],
      },
    },
    define: {
      'import.meta.env.PUBLIC_VERCEL_ANALYTICS_ID':
        JSON.stringify(process.env.VERCEL_ANALYTICS_ID),
    },
  },
});
