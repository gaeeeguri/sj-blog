# sj-blog

Personal blog. Static site, no backend — [Astro](https://astro.build) + [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4.

Content lives as markdown across three collections in `src/content/`:

- `posts/` — regular blog posts
- `fitness/` — training log entries
- `clothing/` — clothing notes/reviews

Each collection's frontmatter schema is defined in `src/content.config.ts`.

## Commands

All commands run from the repo root:

| Command          | Action                                      |
| ---------------- | -------------------------------------------- |
| `yarn install`    | Install dependencies                        |
| `yarn dev`        | Start local dev server at `localhost:4321`  |
| `yarn build`      | Build the static site to `./dist/`          |
| `yarn preview`    | Preview the production build locally        |
| `yarn astro add`  | Add an Astro integration                    |
| `yarn dlx shadcn@latest add <component>` | Add a shadcn/ui component |

## Adding content

Drop a new markdown file into the relevant `src/content/<collection>/` directory with frontmatter matching that collection's schema (see `src/content.config.ts`). New collections can be added the same way.
