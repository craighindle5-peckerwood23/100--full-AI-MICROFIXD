/**
 * server/crawl/contentExtractor.ts
 * Extracts clean text, markdown, metadata, links, images from raw HTML.
 * Removes: nav, footer, ads, scripts, styles.
 * Converts to: plain text + markdown-like format.
 */

export interface ExtractedContent {
  title:    string;
  text:     string;
  markdown: string;
  images:   string[];
  metadata: Record<string, string>;
  wordCount: number;
}

export function extractContent(html: string, baseUrl: string): ExtractedContent {
  // Simple regex-based extraction (no DOM in Node worker)
  const title     = extractTag(html, "title") ?? extractMeta(html, "og:title") ?? new URL(baseUrl).hostname;
  const desc      = extractMeta(html, "description") ?? extractMeta(html, "og:description") ?? "";
  const author    = extractMeta(html, "author") ?? "";
  const canonical = extractMeta(html, "canonical") ?? baseUrl;

  // Remove noise elements
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract images
  const images = Array.from(cleaned.matchAll(/src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp|gif))"/gi))
    .map(m => m[1])
    .slice(0, 20);

  // Convert headings to markdown
  let markdown = cleaned
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Plain text
  const text = markdown.replace(/#{1,6}\s+/g, "").replace(/- /g, "").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    title:    title.replace(/<[^>]+>/g, "").trim(),
    text:     text.slice(0, 50_000),
    markdown: markdown.slice(0, 60_000),
    images,
    wordCount,
    metadata: {
      description: desc,
      author,
      canonical,
      url: baseUrl,
    },
  };
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<link[^>]+rel=["']${name}["'][^>]+href=["']([^"']+)["']`, "i"),
  ];
  for (const p of patterns) {
    const match = html.match(p);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}
