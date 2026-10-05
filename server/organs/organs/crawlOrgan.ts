/**
 * Crawl Organ adapter — wires crawlEngine to organRouter.
 * Actions: start, get_session, list_sessions, scrape_fast, queue_status
 */
import { readPublicPage } from "../../tools/publicPageReader";
import { startCrawl, getCrawlSession, listCrawlSessions } from "../../crawl/crawlEngine";

export async function executeCrawlOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "read_public_page": return readPublicPage(String(p.url || ""));
    case "start": {
      const job = await startCrawl(
        String(p.url ?? ""), String(p.session_id ?? crypto.randomUUID()),
        Number(p.maxDepth ?? 1), Number(p.maxPages ?? 5),
        { screenshot: Boolean(p.screenshot), domainOnly: Boolean(p.domainOnly ?? true) }
      );
      return { job_id: job.id, pages: job.results.length, status: job.status };
    }
    case "scrape_fast": {
      const job = await startCrawl(String(p.url ?? ""), crypto.randomUUID(), 0, 1, { screenshot: false });
      const result = job.results[0];
      return { text: result?.text ?? "", title: result?.title ?? "", url: p.url };
    }
    case "get_session":     return getCrawlSession(String(p.job_id ?? ""));
    case "list_sessions":   return { sessions: listCrawlSessions().slice(-10) };
    default:
      throw new Error(`Crawl organ: unknown action '${action}'`);
  }
}
