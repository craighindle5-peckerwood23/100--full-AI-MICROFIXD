import { useState, useCallback } from "react";
import { Playwright } from "../lib/serverApi";

export interface BrowserState {
  url:        string;
  title:      string;
  status:     "idle" | "loading" | "active" | "error";
  screenshot: string | null;
  log:        { action: string; result: string; ts: string }[];
  error:      string | null;
}

export function useBrowser() {
  const [state, setState] = useState<BrowserState>({
    url: "", title: "", status: "idle", screenshot: null, log: [], error: null,
  });

  const addLog = (action: string, result: string) =>
    setState(s => ({ ...s, log: [...s.log.slice(-49), { action, result, ts: new Date().toISOString() }] }));

  const navigate = useCallback(async (url: string) => {
    setState(s => ({ ...s, status: "loading", error: null }));
    try {
      const r = await Playwright.navigate(url) as { title: string; url: string };
      setState(s => ({ ...s, status: "active", url: r.url, title: r.title }));
      addLog("navigate", r.url);
      await refreshScreenshot();
    } catch (err) {
      setState(s => ({ ...s, status: "error", error: String(err) }));
    }
  }, []);

  const click = useCallback(async (selector: string) => {
    try {
      await Playwright.click(selector);
      addLog("click", selector);
      await refreshScreenshot();
    } catch (err) { addLog("click_error", String(err)); }
  }, []);

  const fill = useCallback(async (selector: string, value: string) => {
    try {
      await Playwright.fill(selector, value);
      addLog("fill", `${selector} = "${value}"`);
    } catch (err) { addLog("fill_error", String(err)); }
  }, []);

  const scrape = useCallback(async (url: string) => {
    setState(s => ({ ...s, status: "loading" }));
    try {
      const r = await Playwright.scrape(url) as { text: string; title: string };
      addLog("scrape", `${r.title} — ${r.text.length} chars`);
      setState(s => ({ ...s, status: "active" }));
      await refreshScreenshot();
      return r.text;
    } catch (err) {
      setState(s => ({ ...s, status: "error", error: String(err) }));
      return null;
    }
  }, []);

  const refreshScreenshot = useCallback(async () => {
    try {
      const r = await Playwright.screenshot();
      setState(s => ({ ...s, screenshot: r.screenshot }));
    } catch {}
  }, []);

  const evaluate = useCallback(async (js: string) => {
    try {
      const r = await Playwright.evaluate(js) as { result: unknown };
      addLog("evaluate", JSON.stringify(r.result));
      return r.result;
    } catch (err) { addLog("evaluate_error", String(err)); return null; }
  }, []);

  return { state, navigate, click, fill, scrape, evaluate, refreshScreenshot };
}
