/**
 * Playwright Organ — delegates to browserManager
 * Actions: navigate, click, fill, scrape, screenshot, evaluate, state
 */
import { browserManager } from "../../playwright/browserManager";

export async function executePlaywrightOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "navigate":   return browserManager.navigate(String(p.url ?? ""));
    case "click":      return browserManager.click(String(p.selector ?? "body"));
    case "fill":       return browserManager.fill(String(p.selector ?? ""), String(p.value ?? ""));
    case "scrape":     return browserManager.scrape(String(p.url ?? ""), String(p.selector ?? "body"));
    case "screenshot": return { screenshot: await browserManager.screenshot(Boolean(p.fullPage)) };
    case "evaluate":   return { result: await browserManager.evaluate(String(p.js ?? "null")) };
    case "state":
    case "status":
    case "health":      return browserManager.getCurrentState();
    case "links":      return { links: await browserManager.findLinks(p.url ? String(p.url) : undefined) };
    default:
      return browserManager.getCurrentState();
  }
}
