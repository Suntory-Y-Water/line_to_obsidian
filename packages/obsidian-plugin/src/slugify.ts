// 3040-309F: ひらがな / 30A0-30FF: カタカナ / 4E00-9FFF: 漢字
const REMOVE_PATTERN = /[^\w぀-ゟ゠-ヿ一-鿿-]/g;

export function slugify(text: string, maxLength = 50): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(REMOVE_PATTERN, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength);
}

/**
 * ハングルやキリル文字のタイトルは slugify で全て削除され空文字になる。
 * そのまま使うと拡張子だけの `.md` が生まれるため、URL のホスト名に退避する。
 */
export function buildLiteratureFileBaseName(
  title: string,
  url: string,
): string {
  const fromTitle = slugify(title);
  if (fromTitle) return fromTitle;

  try {
    const host = new URL(url).hostname.replace(/\./g, '-');
    return slugify(host) || 'article';
  } catch {
    return 'article';
  }
}
