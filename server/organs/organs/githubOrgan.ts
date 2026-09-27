/**
 * GitHub Organ — repo operations
 * Actions: get_repo, list_branches, push_files, create_branch, get_file
 */
const TOKEN  = process.env.VITE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
const GHEADS = { "Authorization": `token ${TOKEN}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "Microfixd/7.0", "Content-Type": "application/json" };

async function gh(method: string, path: string, body?: unknown) {
  const r = await fetch(`https://api.github.com${path}`, { method, headers: GHEADS, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json();
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(d as { message?: string }).message}`);
  return d;
}

export async function executeGithubOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "get_repo":      return gh("GET", `/repos/${p.repo}`);
    case "list_branches": return gh("GET", `/repos/${p.repo}/branches`);
    case "create_branch": return gh("POST", `/repos/${p.repo}/git/refs`, { ref: `refs/heads/${p.branch}`, sha: p.sha });
    case "get_file":      return gh("GET", `/repos/${p.repo}/contents/${p.path}?ref=${p.branch ?? "main"}`);
    case "push_file": {
      const { repo, branch, path: fp, content, message, sha } = p;
      return gh("PUT", `/repos/${repo}/contents/${fp}`, {
        message, branch, sha,
        content: Buffer.from(String(content)).toString("base64"),
      });
    }
    default:
      throw new Error(`GitHub organ: unknown action '${action}'`);
  }
}
