/**
 * 記事要約生成用のプロンプトを生成する。
 *
 * @returns AI用プロンプト文字列
 *
 * @example
 * const prompt = generateArticleSummaryPrompt();
 * // Browser Rendering APIに渡す
 */
export function generateArticleSummaryPrompt(): string {
  return `
あなたは技術記事のキュレーターです。
以下のURLのページを読み、記事本文のみを対象に次の要件で出力してください。

summary:
  - 日本語で300文字以上、日本語検定レベル1相当の文章を作成する。
  - 読者が「この記事を読むべきかどうか」を判断できる情報を含める。
  - 次の4点を必ず含める:
    1) 記事で扱っている具体的なサービス・技術名
    2) 読み終わった読者が「何ができるようになるか」（具体的な成果・ユースケース）
    3) 記事が解決しようとしている課題・背景（例: 積読の期待値ズレ / 情報収集フロー改善など）
    4) 記事内で紹介されているコアなアイデア・実装上の工夫・注意点を1つ以上
  - 「〜が紹介されています」で終わらず、行動に結びつく情報を含める。

tags:
  - 記事で扱っている主な技術・サービス・概念を表すタグ。
  - 最大5個。
  - 各タグは1語、日本語の場合はそのまま使用する。英語の場合はUpperCamelCase（PascalCase）で設定する。
    - 日本語で定義されている人物・名称の場合はそのまま指定しても良い。
    - 声優「水瀬いのり」を「InoriMinase」にする必要はなく、「水瀬いのり」のままで良い。
  - ベンダー名だけでなく、できるだけ具体的な技術・サービス名を採用する。
  - 例: CloudflareWorkers, BrowserRendering, WorkersAI, MarkdownExtraction
`.trim();
}
