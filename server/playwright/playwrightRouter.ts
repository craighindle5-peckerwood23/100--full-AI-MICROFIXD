/**
 * server/playwright/playwrightRouter.ts
 * REST API for all Playwright browser actions.
 * React UI calls these from useBrowser() hook.
 *
 * POST /api/playwright/navigate        { url }
 * POST /api/playwright/click           { selector }
 * POST /api/playwright/fill            { selector, value }
 * POST /api/playwright/fill-submit     { selector, value, submitSelector }
 * POST /api/playwright/evaluate        { js }
 * POST /api/playwright/scrape          { url, selector? }
 * GET  /api/playwright/text            ?selector=body
 * GET  /api/playwright/html            ?selector=body
 * GET  /api/playwright/screenshot
 * GET  /api/playwright/links           ?url=
 * GET  /api/playwright/state
 * POST /api/playwright/stop
 */
import { Router } from "express";
import { browserManager } from "./browserManager";
import { broadcast } from "../events";

export const playwrightRouter = Router();

function emit(action: string, result: unknown): void {
  broadcast("playwright:action", { action, result, ts: new Date().toISOString() });
}

playwrightRouter.post("/navigate", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const result = await browserManager.navigate(url);
    emit("navigate", result);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/click", async (req, res) => {
  const { selector } = req.body;
  if (!selector) return res.status(400).json({ error: "selector required" });
  try {
    const result = await browserManager.click(selector);
    emit("click", result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/fill", async (req, res) => {
  const { selector, value } = req.body;
  if (!selector || value === undefined) return res.status(400).json({ error: "selector + value required" });
  try {
    const result = await browserManager.fill(selector, value);
    emit("fill", result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/fill-submit", async (req, res) => {
  const { selector, value, submitSelector } = req.body;
  try {
    const result = await browserManager.fillAndSubmit(selector, value, submitSelector);
    emit("fill_and_submit", result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/evaluate", async (req, res) => {
  const { js } = req.body;
  if (!js) return res.status(400).json({ error: "js required" });
  try {
    const result = await browserManager.evaluate(js);
    emit("evaluate", result);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/scrape", async (req, res) => {
  const { url, selector = "body" } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const result = await browserManager.scrape(url, selector);
    emit("scrape", { url, chars: result.text.length });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.get("/text", async (req, res) => {
  const selector = String(req.query.selector ?? "body");
  try {
    const text = await browserManager.getText(selector);
    res.json({ success: true, text });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.get("/html", async (req, res) => {
  const selector = String(req.query.selector ?? "body");
  try {
    const html = await browserManager.getHtml(selector);
    res.json({ success: true, html });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.get("/screenshot", async (req, res) => {
  const fullPage = req.query.fullPage === "true";
  try {
    const screenshot = await browserManager.screenshot(fullPage);
    emit("screenshot", { fullPage });
    res.json({ success: true, screenshot });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.get("/links", async (req, res) => {
  const url = req.query.url ? String(req.query.url) : undefined;
  try {
    const links = await browserManager.findLinks(url);
    res.json({ success: true, links });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.get("/state", async (req, res) => {
  try {
    const state = await browserManager.getCurrentState();
    res.json({ success: true, ...state });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

playwrightRouter.post("/stop", async (req, res) => {
  await browserManager.stop();
  res.json({ success: true, message: "Browser stopped." });
});

// Explicit operator action: credentials never enter model prompts, memory or telemetry.
playwrightRouter.post("/login", async (req,res)=>{
  const {url,username,password,usernameSelector,passwordSelector,submitSelector,successSelector}=req.body;
  try {
    const result=await browserManager.login({url,username,password,usernameSelector,passwordSelector,submitSelector,successSelector});
    res.json({success:true,...result});
  } catch {res.status(400).json({success:false,error:"Login failed; verify HTTPS URL, selectors and credentials. MFA/CAPTCHA may require manual verification."});}
});

playwrightRouter.post("/login-snippet", (req,res)=>{
  const {url,usernameSelector,passwordSelector,submitSelector}=req.body;
  try {
    if(new URL(url).protocol!=="https:" || ![usernameSelector,passwordSelector,submitSelector].every(v=>typeof v==="string"&&v.length))throw new Error();
    const literal=(v:string)=>JSON.stringify(v);
    const snippet=`await page.goto(${literal(url)});\nawait page.locator(${literal(usernameSelector)}).fill(process.env.LOGIN_USERNAME);\nawait page.locator(${literal(passwordSelector)}).fill(process.env.LOGIN_PASSWORD);\nawait page.locator(${literal(submitSelector)}).click();\n// Verify a signed-in page element; handle MFA/CAPTCHA manually.`;
    res.json({success:true,snippet});
  } catch {res.status(400).json({success:false,error:"HTTPS URL and login selectors required"});}
});
