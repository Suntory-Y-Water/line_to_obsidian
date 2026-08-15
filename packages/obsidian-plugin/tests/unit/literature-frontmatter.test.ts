import { describe, expect, it } from 'vitest';
import { buildLiteratureFrontmatter } from '../../src/literature-frontmatter';

const TEMPLATE =
  'title: {title}\nsource: {url}\nauthor: {author}\npublished: {published}\ncreated: {created}\ndescription: {description}\nimage: {image}\ntags: [literature, line]';

const CREATED = '2026-08-14T23:40:06+09:00';

function build(
  article: Parameters<typeof buildLiteratureFrontmatter>[0]['article'],
): string {
  return buildLiteratureFrontmatter({
    template: TEMPLATE,
    article,
    created: CREATED,
  });
}

describe('記事ノートのFrontmatter', () => {
  it('全ての項目が揃っている時、値が引用符で囲まれること', () => {
    const result = build({
      url: 'https://www.news-postseven.com/archives/20260814_2124592.html',
      title: '洋画編　『プライベート･ライアン』は5位',
      author: '週刊ポスト編集部',
      published: '2026-08-14T07:01:00+09:00',
      description: '戦後81年になる2026年、この夏に観たい究極の戦争映画。',
      image: 'https://www.news-postseven.com/cover.jpg',
    });

    expect(result).toBe(
      [
        'title: "洋画編　『プライベート･ライアン』は5位"',
        'source: "https://www.news-postseven.com/archives/20260814_2124592.html"',
        'author:',
        '  - "[[週刊ポスト編集部]]"',
        'published: 2026-08-14T07:01:00+09:00',
        `created: ${CREATED}`,
        'description: "戦後81年になる2026年、この夏に観たい究極の戦争映画。"',
        'image: "https://www.news-postseven.com/cover.jpg"',
        'tags: [literature, line]',
      ].join('\n'),
    );
  });

  it('タイトルにコロンが含まれる時、そのまま残ること', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: '速報: Rust 2.0 リリース',
    });

    expect(result).toContain('title: "速報: Rust 2.0 リリース"');
  });

  it('タイトルに引用符が含まれる時、エスケープされること', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: '"引用" と \\ バックスラッシュ',
    });

    expect(result).toContain('title: "\\"引用\\" と \\\\ バックスラッシュ"');
  });

  it('タイトルに置換で意味を持つ記号が含まれる時、そのまま残ること', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: "値段は $& と $' です",
    });

    expect(result).toContain(`title: "値段は $& と $' です"`);
  });

  it('公開日時がISO 8601でない時、引用符で囲まれること', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: '記事',
      published: '2026年8月14日 7:01',
    });

    expect(result).toContain('published: "2026年8月14日 7:01"');
  });

  it('著者が複数いる時、リンクのリストになること', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: '記事',
      author: '山田太郎, 佐藤花子',
    });

    expect(result).toContain(
      ['author:', '  - "[[山田太郎]]"', '  - "[[佐藤花子]]"'].join('\n'),
    );
  });

  it('著者や説明が無い時、キーだけが残り行末に空白が付かないこと', () => {
    const result = build({
      url: 'https://example.com/notes/1234',
      title: '記事',
    });

    expect(result).toContain('\nauthor:\npublished:\n');
    expect(result).toContain('\ndescription:\nimage:\n');
  });
});
