/**
 * server/github/githubRouter.ts
 * GitHub REST API router.
 * Token from VITE_GITHUB_TOKEN env var — never from request body.
 *
 * GET  /api/github/repo/:owner/:repo
 * GET  /api/github/branches/:owner/:repo
 * POST /api/github/push            { repo, branch, files: [{path, content}], message }
 * POST /api/github/create-branch   { repo, branch, sha }
 */
import { Router } from "express";

export const githubRouter = Router();

const TOKEN = process.env.VITE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

function headers() {
  return {
    "Authorization": `token ${TOKEN}`,
    "Accept":        "application/vnd.github.v3+json",
    "User-Agent":    "Microfixd/7.0",
    "Content-Type":  "application/json",
  };
}

async function ghFetch(method: string, path: string, body?: unknown) {
  const resp = await fetch(`https://api.github.com${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${(data as {message?:string}).message}`);
  return data;
}

githubRouter.get("/repo/:owner/:repo", async (req, res) => {
  try {
    const data = await ghFetch("GET", `/repos/${req.params.owner}/${req.params.repo}`);
    res.json({ success: true, repo: data });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

githubRouter.get("/branches/:owner/:repo", async (req, res) => {
  try {
    const data = await ghFetch("GET", `/repos/${req.params.owner}/${req.params.repo}/branches`);
    res.json({ success: true, branches: data });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

githubRouter.post("/push", async (req, res) => {
  const { repo, branch, files, message = "Microfixd auto-commit" } = req.body;
  if (!repo || !files?.length) return res.status(400).json({ error: "repo + files required" });
  const results: { path: string; success: boolean; error?: string }[] = [];
  for (const file of files) {
    try {
      // Check existing SHA
      let sha: string | undefined;
      try {
        const existing = await ghFetch("GET", `/repos/${repo}/contents/${file.path}?ref=${branch}`) as {sha:string};
        sha = existing.sha;
      } catch {}
      const content = Buffer.from(file.content).toString("base64");
      await ghFetch("PUT", `/repos/${repo}/contents/${file.path}`, {
        message: `${message}: ${file.path}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      });
      results.push({ path: file.path, success: true });
    } catch (err) {
      results.push({ path: file.path, success: false, error: String(err) });
    }
    await new Promise(r => setTimeout(r, 300)); // rate limit safety
  }
  res.json({ success: results.every(r => r.success), results });
});

githubRouter.post("/create-branch", async (req, res) => {
  const { repo, branch, sha } = req.body;
  if (!repo || !branch || !sha) return res.status(400).json({ error: "repo + branch + sha required" });
  try {
    await ghFetch("POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
    res.json({ success: true });
  } catch (err) {
    if (String(err).includes("422")) return res.json({ success: true, note: "Branch already exists" });
    res.status(500).json({ success: false, error: String(err) });
  }
});
