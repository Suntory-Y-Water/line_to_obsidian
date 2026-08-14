import { DOMParser, parseHTML } from 'linkedom';

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
}): Promise<{ title: string; markdown: string } | null> {
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
    return { title: result.title ?? '', markdown: result.content };
  } catch (err) {
    console.error(`Defuddle extraction failed for ${url}:`, err);
    return null;
  } finally {
    restoreGlobal('window', hadWindow, previousWindow);
    restoreGlobal('DOMParser', hadDomParser, previousDomParser);
  }
}

function restoreGlobal(key: string, existed: boolean, value: unknown): void {
  if (existed) {
    (globalThis as Record<string, unknown>)[key] = value;
  } else {
    delete (globalThis as Record<string, unknown>)[key];
  }
}
