import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "house lights",
      description: "Documentation for house lights — Amsterdam arts event tracker.",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/cjbaxt/house-lights" },
      ],
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Architecture", slug: "architecture" },
            { label: "Repository structure", slug: "repo-structure" },
          ],
        },
        {
          label: "Scrapers",
          items: [
            { label: "How scrapers work", slug: "scrapers/index" },
            { label: "Writing a scraper", slug: "scrapers/writing-a-scraper" },
            { label: "BaseScraper reference", slug: "scrapers/base-scraper" },
          ],
        },
        {
          label: "Database",
          items: [
            { label: "Schema reference", slug: "database/schema" },
            { label: "Running migrations", slug: "database/migrations" },
            { label: "Row-level security", slug: "database/rls" },
          ],
        },
        {
          label: "Frontend",
          items: [
            { label: "Overview", slug: "frontend/index" },
            { label: "API routes", slug: "frontend/api-routes" },
            { label: "Authentication", slug: "frontend/auth" },
          ],
        },
        {
          label: "Deployment",
          items: [
            { label: "Environment variables", slug: "deployment/environment-variables" },
            { label: "Vercel", slug: "deployment/vercel" },
            { label: "CI / CD", slug: "deployment/ci-cd" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
      favicon: "/favicon.png",
    }),
  ],
});
