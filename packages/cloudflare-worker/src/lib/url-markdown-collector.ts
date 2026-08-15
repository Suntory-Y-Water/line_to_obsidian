import { extractMarkdown } from './article-extractor';
import { normalizeMetaText } from './meta-text';

// Bot 判定で 403 を返すサイトがあるため、通常のブラウザとして名乗る。
// マイナー以下を 0.0.0 にし、macOS のバージョンを 10_15_7 に固定するのは
// Chrome 自身の User-Agent 削減と同じ形にするため
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

type Article = {
  url: string;
  title: string;
  description?: string;
  author?: string;
  published?: string;
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
  extractedTitle,
  markdown,
  url,
}: {
  html: string;
  extractedTitle?: string;
  markdown: string;
  url: string;
}): string {
  const candidates = [
    isXPost(url) ? extractLeadingHeading(markdown) : undefined,
    extractOgpMeta(html, 'og:title'),
    extractedTitle,
    extractHtmlTitle(html),
    extractFirstHeading(markdown),
    extractPathTail(url),
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return extractHost(url);
}

export async function fetchArticleMarkdown({
  url,
  fetchImpl = globalThis.fetch,
}: {
  url: string;
  fetchImpl?: typeof fetch;
}): Promise<Article | null> {
  const html = await fetchHtml({ url, fetchImpl });
  if (html === null) return null;

  const extracted = await extractMarkdown({ html, url });
  if (!extracted) return null;

  const description =
    extracted.description ?? extractOgpMeta(html, 'og:description');
  const author = resolveAuthor({ extractedAuthor: extracted.author, html });

  return {
    url,
    title: normalizeMetaText(
      resolveTitle({
        html,
        extractedTitle: extracted.title,
        markdown: extracted.markdown,
        url,
      }),
    ),
    description: description ? normalizeMetaText(description) : undefined,
    author: author ? normalizeMetaText(author) : undefined,
    published:
      extracted.published ?? extractOgpMeta(html, 'article:published_time'),
    image: extracted.image ?? extractOgpMeta(html, 'og:image'),
    markdown: extracted.markdown,
  };
}

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
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: HTTP ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch HTML for ${url}:`, err);
    return null;
  }
}

function resolveAuthor({
  extractedAuthor,
  html,
}: {
  extractedAuthor?: string;
  html: string;
}): string | undefined {
  const candidate =
    extractedAuthor?.trim() || extractOgpMeta(html, 'article:author')?.trim();
  return candidate ? toAuthorName(candidate) : undefined;
}

// article:author にプロフィールページの URL を入れるサイトがあるため、その場合は末尾の
// セグメントを名前として扱う。frontmatter 側でリンクにするので URL のままだと使えない
function toAuthorName(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return value;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? parsed.hostname;
  } catch {
    return value;
  }
}

function isXPost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'x.com' ||
      hostname === 'twitter.com' ||
      hostname.endsWith('.x.com') ||
      hostname.endsWith('.twitter.com')
    );
  } catch {
    return false;
  }
}

/**
 * X はどの投稿でも og:title が「表示名 (@ハンドル) on X」になり、投稿の内容を含まない。
 * 本文の先頭行が記事見出しとして抽出されるので、そちらをタイトルに使う。
 */
function extractLeadingHeading(markdown: string): string | undefined {
  const firstLine = markdown.split('\n').find((line) => line.trim());
  const match = firstLine
    ?.trim()
    .match(/^(?:[-*+][ \t]+|\d+\.[ \t]+)?#{1,6}[ \t]+(.+)$/);
  return match?.[1].trim();
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
