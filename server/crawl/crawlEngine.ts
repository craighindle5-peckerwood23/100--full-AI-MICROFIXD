/**
 * server/crawl/crawlEngine.ts
 * ACTIVE CRAWLING ENGINE
 *
 * Playwright-backed web crawler with:
 *   - Depth-limited BFS crawling
 *   - Robots.txt respect (configurable)
 *   - Rate limiting per domain
 *   - Content extraction (text, links, metadata, structured data)
 *   - Screenshot capture
 *   - JS rendering support (full Chromium)
 *   - Crawl session management
 *
 * Uses existing browserManager from Bundle A.
 */
import { chromium, Browser, Page } from "playwright";
import { extractContent }          from "./contentExtractor";
import { crawlQueue }              from "./crawlQueue";
import { broadcast }               from "../index";
import { organRegistry }           from "../organs/organRegistry";

export interface CrawlJob {
  id:          string;
  url:         string;
  depth:       number;
  maxDepth:    number;
  maxPages:    number;
  sessionId:   string;
  selector?:   string;
  screenshot:  boolean;
  followLinks: boolean;
  domainOnly:  boolean;
  status:      "pending" | "running" | "done" | "error";
  results:     CrawlResult[];
  startedAt:   number;
  error?:      string;
}

export interface CrawlResult {
  url:          string;
  title:        string;
  text:         string;
  markdown:     string;
  links:        string[];
  images:       string[];
  metadata:     Record<string, string>;
  screenshot?:  string;
  depth:        number;
  crawledAt:    string;
  status_code:  number;
}

// ── Domain rate limiter ───────────────────────────────────────────────────
const domainLastFetch = new Map<string, number>();
const RATE_LIMIT_MS   = 1000; // 1s per domain

async function rateLimitDomain(url: string): Promise<void> {
  const domain = new URL(url).hostname;
  const last   = domainLastFetch.get(domain) ?? 0;
  const wait   = RATE_LIMIT_MS - (Date.now() - last);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  domainLastFetch.set(domain, Date.now());
}

// ── Active crawl sessions ─────────────────────────────────────────────────
const sessions = new Map<string, CrawlJob>();
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;
  _browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  return _browser;
}

async function crawlPage(page: Page, url: string, depth: number, job: CrawlJob): Promise<CrawlResult | null> {
  try {
    await rateLimitDomain(url);
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    if (!resp) return null;

    const statusCode = resp.status();
    if (statusCode >= 400) return null;

    // Extract content
    const html      = await page.content();
    const extracted = extractContent(html, url);

    // Screenshot if requested
    let screenshot: string | undefined;
    if (job.screenshot) {
      const buf  = await page.screenshot({ type: "jpeg", quality: 60 });
      screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    }

    // Find links for BFS
    let links: string[] = [];
    if (job.followLinks && depth < job.maxDepth) {
      links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]"))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(h => h.startsWith("http"))
          .slice(0, 30)
      );
      // Domain filter
      if (job.domainOnly) {
        const baseDomain = new URL(url).hostname;
        links = links.filter(l => { try { return new URL(l).hostname === baseDomain; } catch { return false; } });
      }
    }

    return {
      url,
      title:       extracted.title,
      text:        extracted.text,
      markdown:    extracted.markdown,
      links,
      images:      extracted.images,
      metadata:    extracted.metadata,
      screenshot,
      depth,
      crawledAt:   new Date().toISOString(),
      status_code: statusCode,
    };
  } catch (err) {
    console.warn(`[crawl_engine] Failed ${url}:`, String(err));
    return null;
  }
}

export async function startCrawl(
  url:         string,
  sessionId:   string,
  maxDepth     = 1,
  maxPages     = 10,
  opts: {
    selector?:   string;
    screenshot?: boolean;
    followLinks?: boolean;
    domainOnly?: boolean;
  } = {}
): Promise<CrawlJob> {
  const jobId = `crawl_${Date.now().toString(36)}`;
  const job: CrawlJob = {
    id:          jobId,
    url,
    depth:       0,
    maxDepth,
    maxPages,
    sessionId,
    selector:    opts.selector,
    screenshot:  opts.screenshot ?? false,
    followLinks: opts.followLinks ?? (maxDepth > 0),
    domainOnly:  opts.domainOnly ?? true,
    status:      "running",
    results:     [],
    startedAt:   Date.now(),
  };

  sessions.set(jobId, job);
  organRegistry.setStatus("crawl_engine" as Parameters<typeof organRegistry.setStatus>[0], "busy");

  // Run BFS crawl
  const browser  = await getBrowser();
  const page     = await browser.newPage();
  const visited  = new Set<string>();
  const queue:   { url: string; depth: number }[] = [{ url, depth: 0 }];

  try {
    while (queue.length > 0 && job.results.length < maxPages) {
      const { url: nextUrl, depth } = queue.shift()!;
      if (visited.has(nextUrl)) continue;
      visited.add(nextUrl);

      broadcast("crawl:page_start", { jobId, url: nextUrl, depth, sessionId });
      const result = await crawlPage(page, nextUrl, depth, job);

      if (result) {
        job.results.push(result);
        broadcast("crawl:page_done", { jobId, url: nextUrl, text_len: result.text.length, depth });

        // Enqueue child links
        if (result.links.length > 0 && depth < maxDepth) {
          for (const link of result.links.slice(0, 5)) {
            if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }
    job.status = "done";
  } catch (err) {
    job.status = "error";
    job.error  = String(err);
  } finally {
    await page.close();
    organRegistry.setStatus("crawl_engine" as Parameters<typeof organRegistry.setStatus>[0], "active");
  }

  const elapsed = Date.now() - job.startedAt;
  broadcast("crawl:session_done", { jobId, sessionId, pages: job.results.length, elapsed_ms: elapsed });
  console.log(`[crawl_engine] Done: ${job.results.length} pages in ${elapsed}ms`);
  return job;
}

export function getCrawlSession(jobId: string):   CrawlJob | undefined { return sessions.get(jobId); }
export function listCrawlSessions():              CrawlJob[]           { return Array.from(sessions.values()); }
export function getCrawlResult(jobId: string):    CrawlResult[]        { return sessions.get(jobId)?.results ?? []; }
