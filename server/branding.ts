/**
 * server/branding.ts
 * Server-side mirror of src/branding/brand.config.ts.
 *
 * The frontend reads VITE_BRAND_* via import.meta.env at build time; the
 * server reads the exact same variable names via process.env at runtime
 * (Node doesn't go through Vite's define/substitution step, so the "VITE_"
 * prefix is just a naming convention here, not a functional requirement).
 *
 * This keeps one config surface — set VITE_BRAND_* once in your
 * environment and both the built frontend and this backend route agree on
 * the active brand. Used by GET /api/branding (server/index.ts) so any
 * external tool, email template, or future admin UI can fetch brand values
 * without duplicating them.
 */

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function getBrandConfig() {
  return {
    productName:     env("VITE_BRAND_PRODUCT_NAME", "Microfyxd OS"),
    shortName:       env("VITE_BRAND_SHORT_NAME", "Microfixd"),
    tagline:         env("VITE_BRAND_TAGLINE", "Synthetic Intelligence Operating System"),
    topBarBadge:     env("VITE_BRAND_TOPBAR_BADGE", "◈ MICROFIXD L7"),
    bootKernelLabel: env("VITE_BRAND_BOOT_KERNEL_LABEL", "Microfyxd Zero-Trust Kernel v6.2.0"),
    versionLabel:    env("VITE_BRAND_VERSION_LABEL", "Microfixd v7 · L7 Arcana"),
    supportEmail:    env("VITE_BRAND_SUPPORT_EMAIL", "support@example.com"),
    logoPath:        env("VITE_BRAND_LOGO_PATH", "/brand-logo.svg"),
    colors: {
      primary:    env("VITE_BRAND_COLOR_PRIMARY", "#22d3ee"),
      accent:     env("VITE_BRAND_COLOR_ACCENT", "#a78bfa"),
      background: env("VITE_BRAND_COLOR_BACKGROUND", "#000000"),
      surface:    env("VITE_BRAND_COLOR_SURFACE", "#0d1117"),
      border:     env("VITE_BRAND_COLOR_BORDER", "#21262d"),
      text:       env("VITE_BRAND_COLOR_TEXT", "#e6edf3"),
      textMuted:  env("VITE_BRAND_COLOR_TEXT_MUTED", "#7d8590"),
    },
  };
}
