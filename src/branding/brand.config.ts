/**
 * src/branding/brand.config.ts
 *
 * Single source of truth for everything a reseller/white-label customer
 * needs to change to make this product look like their own — without
 * touching component code.
 *
 * How to re-skin this product for a customer today (single-tenant-per-
 * deployment model):
 *   1. Set the VITE_BRAND_* environment variables below at build time
 *      (in .env, or in your hosting provider's Environment tab — see
 *      render.yaml). No code changes required for name/tagline/colors.
 *   2. Replace /public/brand-logo.svg with the customer's logo (same
 *      filename, any aspect ratio — it's rendered inside a fixed box).
 *   3. Rebuild (`npm run build`) and redeploy.
 *
 * This covers one brand per running instance. Serving many different
 * brands from a single running instance (e.g. by domain or by logged-in
 * account) requires per-tenant storage, which is the accounts/auth layer —
 * see docs/gap-audit-and-roadmap.md item 1 for that roadmap.
 */

export interface BrandColors {
  /** Primary accent used for active states, highlights, focus rings. */
  primary: string;
  /** Secondary accent used for secondary call-to-actions and badges. */
  accent: string;
  /** Main app background (dark-mode base). */
  background: string;
  /** Raised surface background (panels, cards, the top bar). */
  surface: string;
  /** Border color on raised surfaces. */
  border: string;
  /** Primary text color on dark background. */
  text: string;
  /** Muted/secondary text color. */
  textMuted: string;
}

export interface BrandConfig {
  /** Full product name shown in page titles, boot sequence, about screens. */
  productName: string;
  /** Short name/wordmark shown in compact UI chrome (top bar, favicon alt text). */
  shortName: string;
  /** One-line description used in <meta> tags and share previews. */
  tagline: string;
  /** Badge text shown in the always-visible top bar identity pill. */
  topBarBadge: string;
  /** Kernel/version label spoken and shown during the boot sequence. */
  bootKernelLabel: string;
  /** Footer / about-panel version string. */
  versionLabel: string;
  /** Support contact shown in Settings / error states. */
  supportEmail: string;
  /** Path to the logo asset, served from /public. Swap the file, keep the path. */
  logoPath: string;
  colors: BrandColors;
}

const DEFAULT_COLORS: BrandColors = {
  primary:    "#22d3ee", // cyan-400 — matches the existing UI today
  accent:     "#a78bfa", // violet-400
  background: "#000000",
  surface:    "#0d1117",
  border:     "#21262d",
  text:       "#e6edf3",
  textMuted:  "#7d8590",
};

function env(name: string, fallback: string): string {
  // import.meta.env is the Vite-provided, build-time-substituted env object.
  // Falls back safely if a var is unset so a plain `npm run build` with no
  // .env still produces the default brand rather than blank strings.
  const value = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const brand: BrandConfig = {
  productName:     env("VITE_BRAND_PRODUCT_NAME", "Microfixd OS"),
  shortName:       env("VITE_BRAND_SHORT_NAME", "Microfixd"),
  tagline:         env("VITE_BRAND_TAGLINE", "Synthetic Intelligence Operating System"),
  topBarBadge:     env("VITE_BRAND_TOPBAR_BADGE", "◈ MICROFIXD L7"),
  bootKernelLabel: env("VITE_BRAND_BOOT_KERNEL_LABEL", "Microfixd Kernel v6.2.0"),
  versionLabel:    env("VITE_BRAND_VERSION_LABEL", "Microfixd v7 · L7 Arcana"),
  supportEmail:    env("VITE_BRAND_SUPPORT_EMAIL", "support@example.com"),
  logoPath:        env("VITE_BRAND_LOGO_PATH", "/brand-logo.svg"),
  colors: {
    primary:    env("VITE_BRAND_COLOR_PRIMARY", DEFAULT_COLORS.primary),
    accent:     env("VITE_BRAND_COLOR_ACCENT", DEFAULT_COLORS.accent),
    background: env("VITE_BRAND_COLOR_BACKGROUND", DEFAULT_COLORS.background),
    surface:    env("VITE_BRAND_COLOR_SURFACE", DEFAULT_COLORS.surface),
    border:     env("VITE_BRAND_COLOR_BORDER", DEFAULT_COLORS.border),
    text:       env("VITE_BRAND_COLOR_TEXT", DEFAULT_COLORS.text),
    textMuted:  env("VITE_BRAND_COLOR_TEXT_MUTED", DEFAULT_COLORS.textMuted),
  },
};
