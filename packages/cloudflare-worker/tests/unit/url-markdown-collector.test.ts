import { describe, expect, it, vi } from 'vitest';
import {
  extractOgpMeta,
  fetchArticleMarkdown,
  isUrlOnly,
  resolveTitle,
} from '../../src/lib/url-markdown-collector';

function buildArticleHtml({
  head = '',
  body = '<article><h1>記事タイトル</h1><p>本文です。段落として認識される程度の長さを持たせています。</p></article>',
}: {
  head?: string;
  body?: string;
} = {}): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

function createFetchStub({
  html = buildArticleHtml(),
  status = 200,
  throws = false,
}: {
  html?: string;
  status?: number;
  throws?: boolean;
} = {}) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (throws) {
      throw new TypeError('Network error');
    }
    return new Response(html, {
      status,
      headers: { 'content-type': 'text/html' },
    });
  });
}

describe('URL単体判定', () => {
  describe('記事として取得する', () => {
    it('半角英数字だけのURLの時、取得対象になること', () => {
      expect(isUrlOnly('https://zenn.dev/foo/articles/bar')).toBe(true);
    });

    it('パスに日本語を含むURLの時、取得対象になること', () => {
      expect(isUrlOnly('https://ja.wikipedia.org/wiki/日本')).toBe(true);
    });

    it('クエリ文字列に日本語を含むURLの時、取得対象になること', () => {
      expect(isUrlOnly('https://example.com/search?q=検索語')).toBe(true);
    });

    it('パーセントエンコード済みのURLの時、取得対象になること', () => {
      expect(
        isUrlOnly('https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC'),
      ).toBe(true);
    });

    it('ドメインだけで末尾にスラッシュが無いURLの時、取得対象になること', () => {
      expect(isUrlOnly('https://example.com')).toBe(true);
    });

    it('フラグメントが付いたURLの時、取得対象になること', () => {
      expect(isUrlOnly('https://example.com/article#section-2')).toBe(true);
    });

    it('前後に空白や改行が付いているだけの時、取得対象になること', () => {
      expect(isUrlOnly('  https://example.com/article\n')).toBe(true);
    });
  });

  describe('記事として取得しない', () => {
    it('文章の中にURLが1つ混じっている時、取得対象にならないこと', () => {
      expect(isUrlOnly('これ面白い https://example.com/article')).toBe(false);
    });

    it('URLが2つ並んでいる時、取得対象にならないこと', () => {
      expect(isUrlOnly('https://a.example.com/x https://b.example.com/y')).toBe(
        false,
      );
    });

    it('改行を挟んでURLが2行ある時、取得対象にならないこと', () => {
      expect(
        isUrlOnly('https://a.example.com/x\nhttps://b.example.com/y'),
      ).toBe(false);
    });

    it('全角スペースで文章とURLが区切られている時、取得対象にならないこと', () => {
      expect(isUrlOnly('メモ　https://example.com/article')).toBe(false);
    });

    it('URLを含まない文章の時、取得対象にならないこと', () => {
      expect(isUrlOnly('明日の会議は10時')).toBe(false);
    });

    it('httpでもhttpsでもないスキームの時、取得対象にならないこと', () => {
      expect(isUrlOnly('ftp://example.com/file.zip')).toBe(false);
    });

    it('URLとして解釈できない文字列の時、取得対象にならないこと', () => {
      expect(isUrlOnly('example.com/article')).toBe(false);
    });
  });
});

describe('OGPメタデータの抽出', () => {
  it('property属性が先にある時、その内容が取れること', () => {
    const html = '<meta property="og:title" content="記事タイトル">';

    expect(extractOgpMeta(html, 'og:title')).toBe('記事タイトル');
  });

  it('content属性が先にある時も、その内容が取れること', () => {
    const html = '<meta content="記事タイトル" property="og:title">';

    expect(extractOgpMeta(html, 'og:title')).toBe('記事タイトル');
  });

  it('property属性とcontent属性の間に別の属性がある時も、その内容が取れること', () => {
    const html =
      '<meta property="og:title" data-rh="true" content="記事タイトル">';

    expect(extractOgpMeta(html, 'og:title')).toBe('記事タイトル');
  });

  it('name属性で書かれている時も、その内容が取れること', () => {
    const html = '<meta name="og:title" content="記事タイトル">';

    expect(extractOgpMeta(html, 'og:title')).toBe('記事タイトル');
  });

  it('実体参照を含む時、元の文字に戻されること', () => {
    const html = '<meta property="og:title" content="Foo &amp; Bar">';

    expect(extractOgpMeta(html, 'og:title')).toBe('Foo & Bar');
  });

  it('該当するメタタグが無い時、undefinedが返ること', () => {
    const html = '<meta property="og:description" content="説明">';

    expect(extractOgpMeta(html, 'og:title')).toBeUndefined();
  });
});

describe('記事タイトルの決定', () => {
  it('og:titleがある時、その値が使われること', () => {
    const html =
      '<meta property="og:title" content="OGPタイトル"><title>タグのタイトル</title>';

    const result = resolveTitle({
      html,
      extractedTitle: '抽出タイトル',
      markdown: '# 本文の見出し',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('OGPタイトル');
  });

  it('og:titleが無く抽出結果のタイトルがある時、その値が使われること', () => {
    const html = '<title>タグのタイトル</title>';

    const result = resolveTitle({
      html,
      extractedTitle: '抽出タイトル',
      markdown: '# 本文の見出し',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('抽出タイトル');
  });

  it('og:titleも抽出結果も無くtitleタグがある時、titleタグの値が使われること', () => {
    const html = '<title>タグのタイトル</title>';

    const result = resolveTitle({
      html,
      markdown: '# 本文の見出し',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('タグのタイトル');
  });

  it('HTML由来の候補が無い時、本文の先頭見出しが使われること', () => {
    const result = resolveTitle({
      html: '<html><body>本文だけ</body></html>',
      markdown: '本文の書き出し\n\n## 本文の見出し\n\n続き',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('本文の見出し');
  });

  it('先頭見出しも無い時、URLのパス末尾が使われること', () => {
    const result = resolveTitle({
      html: '',
      markdown: '見出しのない本文',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('1234');
  });

  it('パス末尾に拡張子が付いている時、拡張子を除いた名前が使われること', () => {
    const result = resolveTitle({
      html: '',
      markdown: '見出しのない本文',
      url: 'https://example.com/notes/1234.html',
    });

    expect(result).toBe('1234');
  });

  it('パスを持たないURLの時、ホスト名が使われること', () => {
    const result = resolveTitle({
      html: '',
      markdown: '見出しのない本文',
      url: 'https://example.com/',
    });

    expect(result).toBe('example.com');
  });

  it('候補がすべて空白のみの時、ホスト名が使われること', () => {
    const html = '<meta property="og:title" content="   "><title>  </title>';

    const result = resolveTitle({
      html,
      extractedTitle: '  ',
      markdown: '#    \n',
      url: 'https://example.com/',
    });

    expect(result).toBe('example.com');
  });
});

describe('記事の取得', () => {
  describe('正常系', () => {
    it('HTMLが取得できた時、タイトルと本文とOGP情報を含む記事が返ること', async () => {
      const fetchImpl = createFetchStub({
        html: buildArticleHtml({
          head: '<meta property="og:title" content="記事タイトル"><meta property="og:description" content="記事の説明"><meta property="og:image" content="https://example.com/cover.png">',
        }),
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result).toMatchObject({
        url: 'https://example.com/notes/1234',
        title: '記事タイトル',
        description: '記事の説明',
        author: undefined,
        image: 'https://example.com/cover.png',
      });
      expect(result?.markdown).toContain('本文です');
    });

    it('リクエストにUser-Agentが付与されること', async () => {
      const fetchImpl = createFetchStub();

      await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      const [, init] = fetchImpl.mock.calls[0];
      expect(new Headers(init?.headers).get('user-agent')).toMatch(/Mozilla/);
    });

    it('タイトルにコロンが含まれる時、frontmatterを壊さない文字列に整形されること', async () => {
      const fetchImpl = createFetchStub({
        html: buildArticleHtml({
          head: '<meta property="og:title" content="速報: Rust 2.0 リリース">',
        }),
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result?.title).toBe('速報： Rust 2.0 リリース');
    });

    it('説明文に改行が含まれる時、frontmatterを壊さない文字列に整形されること', async () => {
      const fetchImpl = createFetchStub({
        html: buildArticleHtml({
          head: '<meta property="og:description" content="1行目\n2行目">',
        }),
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result?.description).toBe('1行目 2行目');
    });
  });

  describe('取得に失敗した場合', () => {
    it('403が返った時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({ status: 403 });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result).toBeNull();
    });

    it('通信エラーになった時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({ throws: true });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result).toBeNull();
    });

    it('本文を抽出できなかった時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({
        html: buildArticleHtml({ body: '' }),
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        fetchImpl,
      });

      expect(result).toBeNull();
    });
  });
});
