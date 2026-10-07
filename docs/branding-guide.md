# White-label branding guide

This build now has a real branding layer. Re-skinning it for a customer is a
config change and an asset swap — not a code change.

## What's branded today

| Touchpoint | Source |
|---|---|
| Browser tab title, `<meta>` description/og tags | `src/branding/BrandProvider.tsx` (set at runtime) |
| Boot sequence screen (kernel name, product name, spoken line) | `src/components/os/BootSequence.tsx` |
| Top bar identity badge | `src/components/os/TopBar.tsx` |
| Side panel version label | `src/components/os/SidePanel.tsx` |
| CSS color variables (`--brand-primary`, `--brand-accent`, `--brand-background`, `--brand-surface`, `--brand-border`, `--brand-text`, `--brand-text-muted`) | written onto `:root` at runtime, available to any component |
| Backend branding API (`GET /api/branding`) | `server/branding.ts`, mounted in `server/index.ts` — public, read-only, no secrets |
| Logo asset | `public/brand-logo.svg` |

## How to re-skin for a customer

1. Copy `.env.example` to `.env` (or set the same variables in your hosting
   provider's Environment tab — see `render.yaml`).
2. Fill in the `VITE_BRAND_*` block:
   - `VITE_BRAND_PRODUCT_NAME`, `VITE_BRAND_SHORT_NAME`, `VITE_BRAND_TAGLINE`
   - `VITE_BRAND_TOPBAR_BADGE`, `VITE_BRAND_BOOT_KERNEL_LABEL`, `VITE_BRAND_VERSION_LABEL`
   - `VITE_BRAND_SUPPORT_EMAIL`
   - `VITE_BRAND_COLOR_PRIMARY` / `_ACCENT` / `_BACKGROUND` / `_SURFACE` / `_BORDER` / `_TEXT` / `_TEXT_MUTED`
   - Leave any of these blank to keep the built-in default shown in
     `src/branding/brand.config.ts`.
3. Replace `public/brand-logo.svg` with the customer's logo, keeping the
   same filename (or set `VITE_BRAND_LOGO_PATH` to a different path).
4. Rebuild and redeploy (`npm run build` — Vite substitutes `VITE_*` vars at
   build time, so a running dev server or already-built `dist/` won't pick
   up changes until you rebuild).

No component file needs to change for a standard re-skin.

## What this layer does NOT do yet

This is a **single brand per running instance** model: one deployment, one
set of environment variables, one look. It does not let one running server
serve different brands to different logged-in customers (e.g.
`customerA.yourdomain.com` showing Customer A's logo while
`customerB.yourdomain.com` shows Customer B's). That requires:

- Per-tenant storage of the brand config (a `tenants` table keyed by
  domain or account, instead of environment variables)
- A way to resolve "which tenant is this request for" (by domain, subdomain,
  or logged-in account)
- Serving `GET /api/branding` (and the built frontend) per-tenant instead of
  from one static build

That is the natural next piece of the accounts/auth layer (see
`docs/gap-audit-and-roadmap.md`, item 1) — once real tenant accounts exist,
`/api/branding` can look up the config by tenant ID instead of
`process.env`, and this same `BrandProvider`/`useBrand()` React code keeps
working unchanged on the frontend (only its data source moves from "static
env vars" to "whichever tenant is logged in").

## Things a template file alone can't carry

Two static files still have the default name baked in literally, because
they aren't read by the running app (so an env var can't reach them):

- `metadata.json` — platform/package metadata, edit by hand per customer if
  you use it for app-store-style packaging.
- `package.json`'s `"name"` field — purely an internal npm package name, not
  user-visible; safe to leave as-is, or change per fork if you prefer.
