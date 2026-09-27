import { api } from "./serverApi";

export interface CrawlStartResult {
  success:    boolean;
  job_id?:    string;
  pages?:     number;
  queued?:    boolean;
  queue_id?:  string;
  results?:   unknown[];
}

export const CrawlApi = {
  start: (url: string, opts: {
    maxDepth?: number; maxPages?: number;
    screenshot?: boolean; domainOnly?: boolean;
  } = {}) => api<CrawlStartResult>("POST", "/crawl/start", { url, ...opts }),

  session:  (jobId: string)  => api("GET",    `/crawl/session/${jobId}`),
  sessions: ()               => api("GET",    "/crawl/sessions"),
  queue:    ()               => api("GET",    "/crawl/queue"),
  pause:    ()               => api("POST",   "/crawl/queue/pause",  {}),
  resume:   ()               => api("POST",   "/crawl/queue/resume", {}),
  cancel:   (queueId: string) => api("DELETE", `/crawl/queue/${queueId}`),
};

export const ToolsApi = {
  list:    ()                                          => api("GET",  "/tools"),
  run:     (message: string, systemPrompt?: string)    => api("POST", "/tools/run",     { message, system_prompt: systemPrompt }),
  execute: (toolName: string, args: unknown)           => api("POST", "/tools/execute", { tool_name: toolName, arguments: args }),
};
