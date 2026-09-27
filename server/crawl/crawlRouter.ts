/**
 * server/crawl/crawlRouter.ts
 * REST endpoints for the Active Crawling Organ.
 *
 * POST /api/crawl/start         { url, maxDepth?, maxPages?, screenshot?, domainOnly? }
 * GET  /api/crawl/session/:id   — Get crawl session + results
 * GET  /api/crawl/sessions      — List all crawl sessions
 * GET  /api/crawl/queue         — Queue status
 * POST /api/crawl/queue/pause   — Pause queue
 * POST /api/crawl/queue/resume  — Resume queue
 * DELETE /api/crawl/queue/:id   — Cancel queued job
 */
import { Router }      from "express";
import { startCrawl, getCrawlSession, listCrawlSessions } from "./crawlEngine";
import { crawlQueue }  from "./crawlQueue";

export const crawlRouter = Router();

crawlRouter.post("/start", async (req, res) => {
  const { url, maxDepth = 1, maxPages = 10, screenshot = false, domainOnly = true, selector, session_id } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  const sid = session_id ?? crypto.randomUUID();
  try {
    // For large crawls: enqueue; for quick crawls: run directly
    if (maxPages <= 3) {
      const job = await startCrawl(url, sid, maxDepth, maxPages, { screenshot, domainOnly, selector });
      res.json({ success: true, job_id: job.id, pages: job.results.length, results: job.results });
    } else {
      const queued = crawlQueue.enqueue(url, { maxDepth, maxPages, screenshot, domainOnly, selector, session_id: sid });
      // Start async
      startCrawl(url, sid, maxDepth, maxPages, { screenshot, domainOnly, selector }).then(job => {
        crawlQueue.dequeue();
      }).catch(console.error);
      res.json({ success: true, queued: true, queue_id: queued.id, session_id: sid });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

crawlRouter.get("/session/:id", (req, res) => {
  const session = getCrawlSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ success: true, session });
});

crawlRouter.get("/sessions", (req, res) => {
  const sessions = listCrawlSessions().map(s => ({
    id: s.id, url: s.url, status: s.status,
    pages: s.results.length, elapsed_ms: Date.now() - s.startedAt,
  }));
  res.json({ sessions });
});

crawlRouter.get("/queue", (req, res) => {
  res.json({ pending: crawlQueue.getPending(), running: crawlQueue.getRunning(), size: crawlQueue.size(), paused: crawlQueue.isPaused() });
});

crawlRouter.post("/queue/pause",  (req, res) => { crawlQueue.pause();  res.json({ success: true, status: "paused" }); });
crawlRouter.post("/queue/resume", (req, res) => { crawlQueue.resume(); res.json({ success: true, status: "resumed" }); });
crawlRouter.delete("/queue/:id",  (req, res) => {
  const success = crawlQueue.cancel(req.params.id);
  res.json({ success, id: req.params.id });
});
