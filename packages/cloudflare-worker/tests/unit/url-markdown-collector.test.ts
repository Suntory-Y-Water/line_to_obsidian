import { describe, expect, it, vi } from 'vitest';
import {
  extractOgpMeta,
  fetchArticleMarkdown,
  isUrlOnly,
  resolveTitle,
  stripLeadingFrontmatter,
} from '../../src/lib/url-markdown-collector';

const CLOUDFLARE_API_ORIGIN = 'https://api.cloudflare.com';

function createEnv(): CloudflareBindings {
  return {
    CLOUDFLARE_API_TOKEN: 'test-token',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
  } as CloudflareBindings;
}

/**
 * Cloudflare SDK は import 時に fetch を捕まえるため global.fetch の差し替えが効かない。
 * HTML 取得と Browser Rendering の両方をこのスタブ1つで賄い、宛先で振り分ける。
 */
function createFetchStub({
  html,
  htmlStatus = 200,
  htmlThrows = false,
  markdown = '# 見出し\n\n本文',
  markdownStatus = 200,
}: {
  html?: string;
  htmlStatus?: number;
  htmlThrows?: boolean;
  markdown?: string;
  markdownStatus?: number;
}) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith(CLOUDFLARE_API_ORIGIN)) {
      if (markdownStatus !== 200) {
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 1, message: 'ng' }],
          }),
          {
            status: markdownStatus,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ success: true, result: markdown }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (htmlThrows) {
      throw new TypeError('Network error');
    }
    return new Response(html ?? '', {
      status: htmlStatus,
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

describe('先頭frontmatterの除去', () => {
  it('Browser Renderingが付けたfrontmatterで始まる時、その部分が除かれること', () => {
    const markdown = [
      '---',
      'title: Webサービスの終わらせ方',
      'meta:',
      '  "og:title": Webサービスの終わらせ方',
      '---',
      '',
      '## 作るより消すほうが大変',
      '',
      '本文です',
    ].join('\n');

    expect(stripLeadingFrontmatter(markdown)).toBe(
      '## 作るより消すほうが大変\n\n本文です',
    );
  });

  it('frontmatterの前に空行がある時も、その部分が除かれること', () => {
    const markdown = '\n\n---\ntitle: 記事\n---\n\n本文です';

    expect(stripLeadingFrontmatter(markdown)).toBe('本文です');
  });

  it('frontmatterが無い時、本文がそのまま返ること', () => {
    const markdown = '# 記事タイトル\n\n本文です';

    expect(stripLeadingFrontmatter(markdown)).toBe(
      '# 記事タイトル\n\n本文です',
    );
  });

  it('本文の途中に水平線がある時、そこは除かれないこと', () => {
    const markdown = '# 記事タイトル\n\n前半\n\n---\n\n後半';

    expect(stripLeadingFrontmatter(markdown)).toBe(
      '# 記事タイトル\n\n前半\n\n---\n\n後半',
    );
  });

  it('先頭が水平線でその後にYAMLらしき行が無い時、除かれないこと', () => {
    const markdown = '---\n\n本文です\n\n---\n\n続き';

    expect(stripLeadingFrontmatter(markdown)).toBe(
      '---\n\n本文です\n\n---\n\n続き',
    );
  });

  it('閉じの区切り線が無い時、除かれないこと', () => {
    const markdown = '---\ntitle: 記事\n\n本文です';

    expect(stripLeadingFrontmatter(markdown)).toBe(
      '---\ntitle: 記事\n\n本文です',
    );
  });
});

describe('記事タイトルの決定', () => {
  it('og:titleがある時、その値が使われること', () => {
    const html =
      '<meta property="og:title" content="OGPタイトル"><title>タグのタイトル</title>';

    const result = resolveTitle({
      html,
      markdown: '# 本文の見出し',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('OGPタイトル');
  });

  it('og:titleが無くtitleタグがある時、titleタグの値が使われること', () => {
    const html = '<title>タグのタイトル</title>';

    const result = resolveTitle({
      html,
      markdown: '# 本文の見出し',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('タグのタイトル');
  });

  it('og:titleもtitleタグも無い時、本文の先頭見出しが使われること', () => {
    const result = resolveTitle({
      html: '<html><body>本文だけ</body></html>',
      markdown: '本文の書き出し\n\n## 本文の見出し\n\n続き',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('本文の見出し');
  });

  it('先頭見出しも無い時、URLのパス末尾が使われること', () => {
    const result = resolveTitle({
      html: null,
      markdown: '見出しのない本文',
      url: 'https://example.com/notes/1234',
    });

    expect(result).toBe('1234');
  });

  it('パス末尾に拡張子が付いている時、拡張子を除いた名前が使われること', () => {
    const result = resolveTitle({
      html: null,
      markdown: '見出しのない本文',
      url: 'https://example.com/notes/1234.html',
    });

    expect(result).toBe('1234');
  });

  it('パスを持たないURLの時、ホスト名が使われること', () => {
    const result = resolveTitle({
      html: null,
      markdown: '見出しのない本文',
      url: 'https://example.com/',
    });

    expect(result).toBe('example.com');
  });

  it('候補がすべて空白のみの時、ホスト名が使われること', () => {
    const html = '<meta property="og:title" content="   "><title>  </title>';

    const result = resolveTitle({
      html,
      markdown: '#    \n',
      url: 'https://example.com/',
    });

    expect(result).toBe('example.com');
  });
});

describe('記事の取得', () => {
  describe('正常系', () => {
    it('HTMLと本文の両方が取得できた時、タイトルと本文を含む記事が返ること', async () => {
      const fetchImpl = createFetchStub({
        html: '<meta property="og:title" content="記事タイトル"><meta property="og:description" content="記事の説明">',
        markdown: '# 記事タイトル\n\n本文です',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result).toEqual({
        url: 'https://example.com/notes/1234',
        title: '記事タイトル',
        description: '記事の説明',
        author: undefined,
        image: undefined,
        markdown: '# 記事タイトル\n\n本文です',
      });
    });

    it('本文がfrontmatterで始まる時、それを除いた本文が返ること', async () => {
      const fetchImpl = createFetchStub({
        html: '<meta property="og:title" content="記事タイトル">',
        markdown:
          '---\ntitle: 記事タイトル\nmeta:\n  "og:title": 記事タイトル\n---\n\n## 見出し\n\n本文です',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.markdown).toBe('## 見出し\n\n本文です');
    });

    it('frontmatterを除くと本文が空になる時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({
        html: '<meta property="og:title" content="記事タイトル">',
        markdown: '---\ntitle: 記事タイトル\n---\n',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result).toBeNull();
    });

    it('HTML取得のリクエストにUser-Agentが付与されること', async () => {
      const fetchImpl = createFetchStub({ html: '<title>タイトル</title>' });

      await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      const [, init] = fetchImpl.mock.calls[0];
      expect(new Headers(init?.headers).get('user-agent')).toMatch(/Mozilla/);
    });

    it('タイトルにコロンが含まれる時、frontmatterを壊さない文字列に整形されること', async () => {
      const fetchImpl = createFetchStub({
        html: '<meta property="og:title" content="速報: Rust 2.0 リリース">',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.title).toBe('速報： Rust 2.0 リリース');
    });

    it('説明文に改行が含まれる時、frontmatterを壊さない文字列に整形されること', async () => {
      const fetchImpl = createFetchStub({
        html: '<meta property="og:description" content="1行目\n2行目">',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.description).toBe('1行目 2行目');
    });
  });

  describe('OGPの取得に失敗した場合', () => {
    it('HTML取得が403で失敗した時も、本文を含む記事が返ること', async () => {
      const fetchImpl = createFetchStub({
        htmlStatus: 403,
        markdown: '# 記事タイトル\n\n本文です',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.markdown).toBe('# 記事タイトル\n\n本文です');
    });

    it('HTML取得が通信エラーになった時も、本文を含む記事が返ること', async () => {
      const fetchImpl = createFetchStub({
        htmlThrows: true,
        markdown: '# 記事タイトル\n\n本文です',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.markdown).toBe('# 記事タイトル\n\n本文です');
    });

    it('HTML取得に失敗した時、タイトルは本文の先頭見出しから決まること', async () => {
      const fetchImpl = createFetchStub({
        htmlStatus: 403,
        markdown: '# 記事タイトル\n\n本文です',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result?.title).toBe('記事タイトル');
    });
  });

  describe('本文の取得に失敗した場合', () => {
    it('Browser Renderingがエラーを返した時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({
        html: '<title>タイトル</title>',
        markdownStatus: 500,
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result).toBeNull();
    });

    it('Browser Renderingが空文字を返した時、記事は作られないこと', async () => {
      const fetchImpl = createFetchStub({
        html: '<title>タイトル</title>',
        markdown: '   ',
      });

      const result = await fetchArticleMarkdown({
        url: 'https://example.com/notes/1234',
        env: createEnv(),
        fetchImpl,
      });

      expect(result).toBeNull();
    });
  });
});
