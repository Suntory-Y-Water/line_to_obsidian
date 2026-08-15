// ファイルシステムが受け付けない文字と、Obsidian がリンク記法に使う文字
const UNUSABLE_CHARS = /[\\/:*?"<>|#^[\]]|\p{Cc}/gu;

const MAX_LENGTH = 100;
// ext4 などファイル名を 255 バイトで制限するファイルシステムがある。
// 重複時に付ける連番と拡張子の分を残して切る
const MAX_BYTES = 200;

/**
 * ハングルや絵文字のタイトルでも中身が残るよう、使えない文字だけを落とす。
 * それでも空になる場合は拡張子だけのファイルが生まれるため、URL のホスト名に退避する。
 */
export function buildLiteratureFileBaseName(
  title: string,
  url: string,
): string {
  const fromTitle = toFileName(title);
  if (fromTitle) return fromTitle;

  try {
    const host = new URL(url).hostname.replace(/\./g, '-');
    return toFileName(host) || 'article';
  } catch {
    return 'article';
  }
}

function toFileName(text: string): string {
  const cleaned = text
    .replace(UNUSABLE_CHARS, '')
    .replace(/ +/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '');

  return truncate(cleaned).replace(/[.\s]+$/, '');
}

function truncate(text: string): string {
  let result = [...text].slice(0, MAX_LENGTH).join('');

  while (new TextEncoder().encode(result).length > MAX_BYTES) {
    result = [...result].slice(0, -1).join('');
  }

  return result;
}
