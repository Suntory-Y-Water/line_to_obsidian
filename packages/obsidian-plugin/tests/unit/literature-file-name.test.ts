import { describe, expect, it } from 'vitest';
import { buildLiteratureFileBaseName } from '../../src/literature-file-name';

const ARTICLE_URL = 'https://example.com/notes/1234';

describe('記事ノートのファイル名', () => {
  it('日本語タイトルの時、そのままファイル名に使われること', () => {
    const result = buildLiteratureFileBaseName('日本語のタイトル', ARTICLE_URL);

    expect(result).toBe('日本語のタイトル');
  });

  it('英語タイトルの時、大文字と空白がそのまま残ること', () => {
    const result = buildLiteratureFileBaseName(
      'Rust 2.0 Release Notes',
      ARTICLE_URL,
    );

    expect(result).toBe('Rust 2.0 Release Notes');
  });

  it('括弧や中黒を含むタイトルの時、記号が残ること', () => {
    const result = buildLiteratureFileBaseName(
      '「戦争映画オールタイム・ベスト」洋画編　『プライベート･ライアン』は5位',
      ARTICLE_URL,
    );

    expect(result).toBe(
      '「戦争映画オールタイム・ベスト」洋画編　『プライベート･ライアン』は5位',
    );
  });

  it('ファイル名に使えない記号を含むタイトルの時、取り除かれること', () => {
    const result = buildLiteratureFileBaseName('a/b:c*d?e', ARTICLE_URL);

    expect(result).toBe('abcde');
  });

  it('Obsidianのリンク記法に使う記号を含むタイトルの時、取り除かれること', () => {
    const result = buildLiteratureFileBaseName(
      '[[記事]] #tag ^block',
      ARTICLE_URL,
    );

    expect(result).toBe('記事 tag block');
  });

  it('100文字を超えるタイトルの時、切り詰められること', () => {
    const result = buildLiteratureFileBaseName('a'.repeat(120), ARTICLE_URL);

    expect(result).toBe('a'.repeat(100));
  });

  it('日本語で200バイトを超えるタイトルの時、バイト数で切り詰められること', () => {
    const result = buildLiteratureFileBaseName('あ'.repeat(100), ARTICLE_URL);

    expect(result).toBe('あ'.repeat(66));
  });

  it('末尾がドットのタイトルの時、ドットが取り除かれること', () => {
    const result = buildLiteratureFileBaseName('記事タイトル...', ARTICLE_URL);

    expect(result).toBe('記事タイトル');
  });

  it('ハングルのタイトルの時、そのまま残ること', () => {
    const result = buildLiteratureFileBaseName('한국어 제목', ARTICLE_URL);

    expect(result).toBe('한국어 제목');
  });

  it('絵文字だけのタイトルの時、そのまま残ること', () => {
    const result = buildLiteratureFileBaseName('🎉🎊', ARTICLE_URL);

    expect(result).toBe('🎉🎊');
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
