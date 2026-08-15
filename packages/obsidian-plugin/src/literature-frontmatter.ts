const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

type LiteratureArticle = {
  url: string;
  title: string;
  description?: string;
  author?: string;
  published?: string;
  image?: string;
};

export function buildLiteratureFrontmatter({
  template,
  article,
  created,
}: {
  template: string;
  article: LiteratureArticle;
  created: string;
}): string {
  return (
    template
      .replace(/{title}/g, () => toYamlString(article.title))
      .replace(/{url}/g, () => toYamlString(article.url))
      .replace(/{author}/g, () => toAuthorLinks(article.author))
      .replace(/{created}/g, () => created)
      .replace(/{published}/g, () => toPublished(article.published))
      .replace(/{description}/g, () =>
        toOptionalYamlString(article.description),
      )
      .replace(/{image}/g, () => toOptionalYamlString(article.image))
      // 値が空のキーに行末の空白が残るため落とす
      .replace(/[ \t]+$/gm, '')
  );
}

/**
 * Obsidian Web Clipper と同じく、著者はノートへのリンクのリストにする。
 * 値をキーの次の行から並べるため、置換結果が改行から始まる。
 */
function toAuthorLinks(author?: string): string {
  const names = (author ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  return names.map((name) => `\n  - ${toYamlString(`[[${name}]]`)}`).join('');
}

/**
 * 公開日時の書式はサイト任せなので、そのまま書くと YAML が壊れることがある。
 * ISO 8601 の時だけ引用符を外し、created と同じく Obsidian の日付プロパティにする。
 */
function toPublished(published?: string): string {
  if (!published) return '';
  return ISO_DATE_TIME.test(published) ? published : toYamlString(published);
}

function toYamlString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function toOptionalYamlString(value?: string): string {
  return value ? toYamlString(value) : '';
}
