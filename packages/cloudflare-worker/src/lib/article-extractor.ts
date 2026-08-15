import { DOMParser, parseHTML } from 'linkedom';

export type ExtractedArticle = {
  title: string;
  markdown: string;
  description?: string;
  author?: string;
  published?: string;
  image?: string;
};

/**
 * defuddle が同梱する turndown はブラウザ向けビルドで、読み込み時に window.DOMParser の有無で
 * HTML パーサーを決める。Workers にはどちらも無いため、defuddle の評価より先に linkedom の
 * 実装を渡す必要がある。他のライブラリがブラウザ判定に使うため、抽出が終わったら元に戻す。
 */
export async function extractMarkdown({
  html,
  url,
}: {
  html: string;
  url: string;
}): Promise<ExtractedArticle | null> {
  const hadWindow = 'window' in globalThis;
  const previousWindow = (globalThis as Record<string, unknown>).window;
  const hadDomParser = 'DOMParser' in globalThis;
  const previousDomParser = (globalThis as Record<string, unknown>).DOMParser;

  Object.assign(globalThis, { window: globalThis, DOMParser });

  try {
    const { default: Defuddle } = await import('defuddle/full');
    const { document } = parseHTML(html);
    const result = new Defuddle(document, { url, markdown: true }).parse();

    if (!result.content?.trim()) return null;
    return {
      title: result.title ?? '',
      markdown: result.content,
      description: emptyToUndefined(result.description),
      author: emptyToUndefined(result.author),
      published: emptyToUndefined(result.published),
      image: emptyToUndefined(result.image),
    };
  } catch (err) {
    console.error(`Defuddle extraction failed for ${url}:`, err);
    return null;
  } finally {
    restoreGlobal('window', hadWindow, previousWindow);
    restoreGlobal('DOMParser', hadDomParser, previousDomParser);
  }
}

// defuddle は見つからなかった項目を空文字で返す
function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function restoreGlobal(key: string, existed: boolean, value: unknown): void {
  if (existed) {
    (globalThis as Record<string, unknown>)[key] = value;
  } else {
    delete (globalThis as Record<string, unknown>)[key];
  }
}
