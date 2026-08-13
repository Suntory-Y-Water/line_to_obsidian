import { describe, expect, it } from 'vitest';
import { buildLiteratureFileBaseName } from '../../src/slugify';

const ARTICLE_URL = 'https://example.com/notes/1234';

describe('記事ノートのファイル名', () => {
  it('日本語タイトルの時、そのままファイル名に使われること', () => {
    const result = buildLiteratureFileBaseName('日本語のタイトル', ARTICLE_URL);

    expect(result).toBe('日本語のタイトル');
  });

  it('英語タイトルの時、小文字のハイフン区切りになること', () => {
    const result = buildLiteratureFileBaseName(
      'Rust 2.0 Release Notes',
      ARTICLE_URL,
    );

    expect(result).toBe('rust-20-release-notes');
  });

  it('ファイル名に使えない記号を含むタイトルの時、取り除かれること', () => {
    const result = buildLiteratureFileBaseName('a/b:c*d?e', ARTICLE_URL);

    expect(result).toBe('abcde');
  });

  it('50文字を超えるタイトルの時、切り詰められること', () => {
    const result = buildLiteratureFileBaseName('あ'.repeat(60), ARTICLE_URL);

    expect(result).toBe('あ'.repeat(50));
  });

  it('ハングルだけのタイトルの時、拡張子だけのファイル名にならないこと', () => {
    const result = buildLiteratureFileBaseName('한국어 제목', ARTICLE_URL);

    expect(result).toBe('example-com');
  });

  it('絵文字だけのタイトルの時、拡張子だけのファイル名にならないこと', () => {
    const result = buildLiteratureFileBaseName('🎉🎊', ARTICLE_URL);

    expect(result).toBe('example-com');
  });

  it('空文字のタイトルの時、拡張子だけのファイル名にならないこと', () => {
    const result = buildLiteratureFileBaseName('', ARTICLE_URL);

    expect(result).toBe('example-com');
  });

  it('タイトルもURLも手がかりにならない時、既定の名前が使われること', () => {
    const result = buildLiteratureFileBaseName('', 'not-a-url');

    expect(result).toBe('article');
  });
});
