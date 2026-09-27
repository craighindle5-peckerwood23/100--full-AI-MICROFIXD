/**
 * server/playwright/browserManager.ts
 * Browser session lifecycle manager.
 * Singleton: one browser, multiple pages, persistent across requests.
 * Supports headless mode (default) or headed mode for visual debugging.
 */
import { chromium, Browser, BrowserContext, Page } from "playwright";

class BrowserManager {
  private browser:  Browser | null = null;
  private context:  BrowserContext | null = null;
  private page:     Page | null = null;
  private _started  = false;

  async start(headless = true): Promise<void> {
    if (this._started) return;
    console.log(`[browser] Launching Chromium (headless=${headless})...`);
    this.browser = await chromium.launch({
      headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.context = await this.browser.newContext({
      userAgent: "Mozilla/5.0 (Linux; Android 16) Microfixd/7.0",
      viewport:  { width: 1280, height: 800 },
    });
    this.page    = await this.context.newPage();
    this._started = true;
    console.log(`[browser] Chromium ready.`);
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page    = null;
      this._started = false;
    }
  }

  async getPage(): Promise<Page> {
    if (!this._started) await this.start();
    if (!this.page) throw new Error("No active browser page.");
    return this.page;
  }

  isStarted(): boolean { return this._started; }

  // ── Actions ──────────────────────────────────────────────────────────────

  async navigate(url: string): Promise<{ title: string; url: string; status: number }> {
    const page = await this.getPage();
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return {
      title:  await page.title(),
      url:    page.url(),
      status: resp?.status() ?? 0,
    };
  }

  async getText(selector = "body"): Promise<string> {
    const page = await this.getPage();
    try {
      return await page.locator(selector).innerText({ timeout: 5000 });
    } catch {
      return await page.evaluate(() => document.body.innerText);
    }
  }

  async getHtml(selector = "body"): Promise<string> {
    const page = await this.getPage();
    return page.locator(selector).innerHTML({ timeout: 5000 });
  }

  async click(selector: string): Promise<{ success: boolean; error?: string }> {
    const page = await this.getPage();
    try {
      await page.click(selector, { timeout: 5000 });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async fill(selector: string, value: string): Promise<{ success: boolean; error?: string }> {
    const page = await this.getPage();
    try {
      await page.fill(selector, value, { timeout: 5000 });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async screenshot(fullPage = false): Promise<string> {
    const page = await this.getPage();
    const buf  = await page.screenshot({ type: "jpeg", quality: 80, fullPage });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  }

  async evaluate(js: string): Promise<unknown> {
    const page = await this.getPage();
    return page.evaluate(js);
  }

  async scrape(url: string, selector = "body"): Promise<{ text: string; url: string; title: string }> {
    await this.navigate(url);
    const text  = await this.getText(selector);
    const page  = await this.getPage();
    const title = await page.title();
    return { text, url: page.url(), title };
  }

  async findLinks(url?: string): Promise<string[]> {
    if (url) await this.navigate(url);
    const page = await this.getPage();
    return page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.startsWith("http"))
        .slice(0, 50)
    );
  }

  async fillAndSubmit(selector: string, value: string, submitSelector: string): Promise<{ success: boolean }> {
    await this.fill(selector, value);
    const result = await this.click(submitSelector);
    await this.getPage().then(p => p.waitForLoadState("networkidle").catch(() => {}));
    return { success: result.success };
  }

  async getCurrentState(): Promise<{ url: string; title: string; status: string }> {
    if (!this._started) return { url: "", title: "", status: "idle" };
    const page = await this.getPage();
    return {
      url:    page.url(),
      title:  await page.title(),
      status: "active",
    };
  }
}

export const browserManager = new BrowserManager();

// Auto-start browser when server boots
browserManager.start().catch(console.error);
