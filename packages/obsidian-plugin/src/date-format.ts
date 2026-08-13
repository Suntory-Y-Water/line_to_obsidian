import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/**
 * タイムスタンプ(ミリ秒)をJSTのISO形式文字列に変換
 *
 * @param timestamp - UNIX タイムスタンプ(ミリ秒)
 * @returns ISO形式の日付文字列(例: 2025-12-07T15:30:00+09:00)
 */
export function formatTimestampToJST(timestamp: number): string {
  // タイムスタンプからJSTのTZDateを作成
  const jstDate = new TZDate(timestamp, 'Asia/Tokyo');

  // ISO 8601形式でフォーマット
  return format(jstDate, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
