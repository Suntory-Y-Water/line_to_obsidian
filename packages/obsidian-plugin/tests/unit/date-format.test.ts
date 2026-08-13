import { describe, expect, it } from 'vitest';
import { formatTimestampToJST } from '../../src/date-format';

describe('日本時間への変換', () => {
  it('UTCでは前日になる深夜のタイムスタンプの時、日本時間の日付が返ること', () => {
    const timestamp = Date.UTC(2026, 7, 12, 22, 30, 0);

    const result = formatTimestampToJST(timestamp);

    expect(result).toBe('2026-08-13T07:30:00+09:00');
  });

  it('UTC正午のタイムスタンプの時、日本時間の21時が返ること', () => {
    const timestamp = Date.UTC(2026, 7, 13, 12, 0, 0);

    const result = formatTimestampToJST(timestamp);

    expect(result).toBe('2026-08-13T21:00:00+09:00');
  });
});
