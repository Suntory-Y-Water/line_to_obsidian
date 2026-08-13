import Cloudflare from 'cloudflare';
import { sanitizeForFrontmatter } from './frontmatter-sanitizer';

// OGP を返さないサイトが Bot 判定で 403 を返すため、通常のブラウザとして名乗る
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

type Article = {
  url: string;
  title: string;
  description?: string;
  author?: string;
  image?: string;
  markdown: string;
};

export function isUrlOnly(text: string): boolean {
  const trimmed = text.trim();
  if (/\s/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractOgpMeta(
  html: string,
  property: string,
): string | undefined {
  const metaTags = html.match(/<meta\s[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const key = getAttribute(tag, 'property') ?? getAttribute(tag, 'name');
    if (key?.toLowerCase() !== property.toLowerCase()) continue;

    const content = getAttribute(tag, 'content');
    if (content) return decodeEntities(content);
  }

  return undefined;
}

export function resolveTitle({
  html,
  markdown,
  url,
}: {
  html: string | null;
  markdown: string;
  url: string;
}): string {
  const candidates = [
    html ? extractOgpMeta(html, 'og:title') : undefined,
    html ? extractHtmlTitle(html) : undefined,
    extractFirstHeading(markdown),
    extractPathTail(url),
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return extractHost(url);
}

/**
 * Browser Rendering は Markdown の先頭に title と meta を持つ frontmatter を付けて返す。
 * Obsidian 側でも frontmatter を組み立てるため、残すと二重定義になる。
 *
 * 本文冒頭の水平線を frontmatter と誤認しないよう、区切り線の中身が
 * `キー:` の形をしていることまで確認する。
 */
export function stripLeadingFrontmatter(markdown: string): string {
  const match = markdown.match(/^\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/);
  if (!match) return markdown;

  const hasYamlKey = match[1]
    .split(/\r?\n/)
    .some((line) => /^[A-Za-z_"'][^:]*:/.test(line));
  if (!hasYamlKey) return markdown;

  return markdown.slice(match[0].length).trimStart();
}

export async function fetchArticleMarkdown({
  url,
  env,
  fetchImpl = globalThis.fetch,
}: {
  url: string;
  env: CloudflareBindings;
  fetchImpl?: typeof fetch;
}): Promise<Article | null> {
  const html = await fetchHtml({ url, fetchImpl });

  const client = new Cloudflare({
    apiToken: env.CLOUDFLARE_API_TOKEN,
    fetch: fetchImpl,
  });

  let rawMarkdown: string;
  try {
    rawMarkdown = await client.browserRendering.markdown.create({
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      url,
      rejectResourceTypes: ['stylesheet', 'image', 'media', 'font'],
      rejectRequestPattern: [
        '/^.*\\.(css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/',
      ],
      addScriptTag: [
        {
          content: `document.querySelectorAll('aside, header, footer').forEach(el => el.remove());`,
        },
      ],
    });
  } catch (err) {
    console.error(`Browser Rendering failed for ${url}:`, err);
    return null;
  }

  const markdown = stripLeadingFrontmatter(rawMarkdown);
  if (!markdown.trim()) {
    return null;
  }

  const description = html ? extractOgpMeta(html, 'og:description') : undefined;
  const author = html ? extractOgpMeta(html, 'article:author') : undefined;

  return {
    url,
    title: sanitizeForFrontmatter(resolveTitle({ html, markdown, url })),
    description: description ? sanitizeForFrontmatter(description) : undefined,
    author: author ? sanitizeForFrontmatter(author) : undefined,
    image: html ? extractOgpMeta(html, 'og:image') : undefined,
    markdown,
  };
}

// OGP はあくまで補助情報なので、取得できなくても Browser Rendering には進む
async function fetchHtml({
  url,
  fetchImpl,
}: {
  url: string;
  fetchImpl: typeof fetch;
}): Promise<string | null> {
  try {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch HTML for ${url}:`, err);
    return null;
  }
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  if (!match) return undefined;
  return match[2] ?? match[3] ?? match[4];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]) : undefined;
}

function extractFirstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#{1,6}[ \t]+(.+)$/m);
  return match?.[1];
}

function extractPathTail(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const tail = segments[segments.length - 1];
    return tail?.replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return undefined;
  }
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
