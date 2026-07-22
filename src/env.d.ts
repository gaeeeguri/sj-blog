/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly HEALTH_WEBHOOK_SECRET: string;
  readonly GITHUB_TOKEN: string;
  readonly GITHUB_OWNER: string;
  readonly GITHUB_REPO: string;
  readonly GITHUB_BRANCH?: string;
}
