/**
 * src/branding/BrandProvider.tsx
 *
 * Applies brand.config.ts to the running app:
 *  - exposes the config to any component via useBrand()
 *  - sets document.title and the <meta> description/og tags at runtime
 *  - writes brand colors onto :root as CSS custom properties, so any
 *    component (now or added later) can use var(--brand-primary) etc.
 *    instead of a hardcoded Tailwind color class.
 *
 * Mount this once, near the top of the component tree (see src/App.tsx).
 */
import React, { createContext, useContext, useEffect } from "react";
import { brand, type BrandConfig } from "./brand.config";

const BrandContext = createContext<BrandConfig>(brand);

export function useBrand(): BrandConfig {
  return useContext(BrandContext);
}

function applyDomBranding(config: BrandConfig) {
  if (typeof document === "undefined") return;

  document.title = config.productName;

  const setMeta = (selector: string, attr: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, content);
  };
  setMeta('meta[name="description"]', "content", config.tagline);
  setMeta('meta[property="og:title"]', "content", config.productName);
  setMeta('meta[property="og:description"]', "content", config.tagline);

  const root = document.documentElement;
  root.style.setProperty("--brand-primary", config.colors.primary);
  root.style.setProperty("--brand-accent", config.colors.accent);
  root.style.setProperty("--brand-background", config.colors.background);
  root.style.setProperty("--brand-surface", config.colors.surface);
  root.style.setProperty("--brand-border", config.colors.border);
  root.style.setProperty("--brand-text", config.colors.text);
  root.style.setProperty("--brand-text-muted", config.colors.textMuted);
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyDomBranding(brand);
  }, []);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
