/**
 * 意图解析器
 * 从用户自然语言中提取时间范围，支持相对时间和绝对日期
 */

import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { DateRange } from '../../types/analysis';

dayjs.extend(isoWeek);

export interface ParseResult {
  range: DateRange;
  /** true = 明确匹配到了时间表达；false = 走了 fallback 默认值 */
  matched: boolean;
}

interface TimePattern {
  pattern: RegExp;
  /** fullQuery 用于检测"那周/那月"等附加上下文 */
  resolver: (match: RegExpMatchArray, fullQuery: string) => DateRange;
}

const now = () => new Date();

/** 查询中是否提到了"周"上下文（指某个绝对日期所在的那周） */
const hasWeekCtx = (q: string) => /[那这当][一]?周|所[在]?周/.test(q);
/** 查询中是否提到了"月"上下文 */
const hasMonthCtx = (q: string) => /[那这当][一]?月(?![日号\d])/.test(q);

/** 推断不含年份的月日所属年份（如果结果在未来则用去年） */
function inferYear(month0: number, day: number): number {
  const year = now().getFullYear();
  const d = new Date(year, month0, day);
  return d > now() ? year - 1 : year;
}

const patterns: TimePattern[] = [
  // ── 相对时间 ─────────────────────────────────────────────────────
  {
    pattern: /前天/,
    resolver: () => {
      const d = dayjs(now()).subtract(2, 'day');
      return { start: d.startOf('day').toDate(), end: d.endOf('day').toDate() };
    },
  },
  {
    pattern: /昨天|yesterday/i,
    resolver: () => {
      const d = dayjs(now()).subtract(1, 'day');
      return { start: d.startOf('day').toDate(), end: d.endOf('day').toDate() };
    },
  },
  {
    pattern: /今天|today/i,
    resolver: () => {
      const d = now();
      return { start: dayjs(d).startOf('day').toDate(), end: dayjs(d).endOf('day').toDate() };
    },
  },
  {
    pattern: /上周|上一周|last\s*week/i,
    resolver: () => {
      const d = dayjs(now()).subtract(1, 'week');
      return { start: d.startOf('isoWeek').toDate(), end: d.endOf('isoWeek').toDate() };
    },
  },
  {
    pattern: /本周|这周|this\s*week/i,
    resolver: () => ({
      start: dayjs(now()).startOf('isoWeek').toDate(),
      end: dayjs(now()).endOf('day').toDate(),
    }),
  },
  {
    pattern: /上个月|上月|last\s*month/i,
    resolver: () => {
      const d = dayjs(now()).subtract(1, 'month');
      return { start: d.startOf('month').toDate(), end: d.endOf('month').toDate() };
    },
  },
  {
    pattern: /本月|这个月|this\s*month/i,
    resolver: () => ({
      start: dayjs(now()).startOf('month').toDate(),
      end: dayjs(now()).endOf('day').toDate(),
    }),
  },
  {
    pattern: /最近\s*(\d+)\s*天/,
    resolver: (m) => ({
      start: dayjs(now()).subtract(parseInt(m[1]), 'day').startOf('day').toDate(),
      end: dayjs(now()).endOf('day').toDate(),
    }),
  },
  {
    pattern: /最近\s*(\d+)\s*周/,
    resolver: (m) => ({
      start: dayjs(now()).subtract(parseInt(m[1]), 'week').startOf('day').toDate(),
      end: dayjs(now()).endOf('day').toDate(),
    }),
  },

  // ── 绝对日期：YYYY年MM月DD日 / YYYY年MM月DD号（允许空格） ──────
  {
    pattern: /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,
    resolver: (m, q) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (hasWeekCtx(q)) return { start: dayjs(d).startOf('isoWeek').toDate(), end: dayjs(d).endOf('isoWeek').toDate() };
      if (hasMonthCtx(q)) return { start: dayjs(d).startOf('month').toDate(), end: dayjs(d).endOf('month').toDate() };
      return { start: dayjs(d).startOf('day').toDate(), end: dayjs(d).endOf('day').toDate() };
    },
  },

  // ── 绝对日期：YYYY-MM-DD ─────────────────────────────────
  {
    pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/,
    resolver: (m, q) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (hasWeekCtx(q)) return { start: dayjs(d).startOf('isoWeek').toDate(), end: dayjs(d).endOf('isoWeek').toDate() };
      return { start: dayjs(d).startOf('day').toDate(), end: dayjs(d).endOf('day').toDate() };
    },
  },

  // ── 绝对日期：MM月DD日（无年份，自动推断，允许空格） ─────────────
  {
    pattern: /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,
    resolver: (m, q) => {
      const month0 = parseInt(m[1]) - 1;
      const day = parseInt(m[2]);
      const d = new Date(inferYear(month0, day), month0, day);
      if (hasWeekCtx(q)) return { start: dayjs(d).startOf('isoWeek').toDate(), end: dayjs(d).endOf('isoWeek').toDate() };
      return { start: dayjs(d).startOf('day').toDate(), end: dayjs(d).endOf('day').toDate() };
    },
  },

  // ── 绝对月份：YYYY年MM月（无具体日，允许空格） ───────────────────
  {
    pattern: /(\d{4})\s*年\s*(\d{1,2})\s*月(?![\d日号])/,
    resolver: (m) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1);
      return { start: dayjs(d).startOf('month').toDate(), end: dayjs(d).endOf('month').toDate() };
    },
  },
];

/**
 * 从自然语言中提取时间范围
 * @returns `{ range, matched }` — matched=false 表示走了 fallback，建议触发 LLM 二次解析
 */
export function parseTimeRange(query: string): ParseResult {
  for (const { pattern, resolver } of patterns) {
    const match = query.match(pattern);
    if (match) return { range: resolver(match, query), matched: true };
  }
  // fallback：最近 30 天（比 7 天更有用，且会触发 LLM 二次解析兜底）
  return {
    range: {
      start: dayjs(now()).subtract(30, 'day').startOf('day').toDate(),
      end: dayjs(now()).endOf('day').toDate(),
    },
    matched: false,
  };
}
