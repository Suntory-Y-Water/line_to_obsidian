/**
 * YAML frontmatter用に文字列をサニタイズ
 * Obsidianでフロントマターがバグらないように、問題のある文字を除去・置換する
 *
 * @param value - サニタイズ対象の文字列
 * @returns サニタイズ済みの文字列
 */
export function sanitizeForFrontmatter(value: string): string {
  return (
    value
      // Unicode正規化（全角英数字→半角）
      .normalize('NFKC')
      // 改行コードを全て半角スペースに置換
      .replace(/\r\n|\r|\n/g, ' ')
      // タブを削除
      .replace(/\t/g, '')
      // バッククォート（`）を除去
      .replace(/`/g, '')
      // コロン（:）を全角コロンに置換（YAMLのキーバリュー区切りと混同されないように）
      .replace(/:/g, '：')
      // 連続する空白を1つにまとめる
      .replace(/\s+/g, ' ')
      // 前後の空白を削除
      .trim()
  );
}
