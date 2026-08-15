/**
 * frontmatter へ載せる前に、改行や制御文字だけを取り除く。
 * 全角スペースや半角中黒はページの表記をそのまま残したいので変換しない。
 */
export function normalizeMetaText(value: string): string {
  return value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/ +/g, ' ')
    .trim();
}
