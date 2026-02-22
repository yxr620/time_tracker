/**
 * 意图解析器
 * 从用户自然语言中提取时间范围，支持相对时间和绝对日期
 */

import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths,
} from 'date-fns';
import type { DateRange } from '../../types/analysis';

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
const WEEK_OPTS = { weekStartsOn: 1 } as const;

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
      const d = subDays(now(), 2);
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },
  {
    pattern: /昨天|yesterday/i,
    resolver: () => {
      const d = subDays(now(), 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },
  {
    pattern: /今天|today/i,
    resolver: () => {
      const d = now();
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },
  {
    pattern: /上周|上一周|last\s*week/i,
    resolver: () => {
      const d = subWeeks(now(), 1);
      return { start: startOfWeek(d, WEEK_OPTS), end: endOfWeek(d, WEEK_OPTS) };
    },
  },
  {
    pattern: /本周|这周|this\s*week/i,
    resolver: () => ({
      start: startOfWeek(now(), WEEK_OPTS),
      end: endOfDay(now()),
    }),
  },
  {
    pattern: /上个月|上月|last\s*month/i,
    resolver: () => {
      const d = subMonths(now(), 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    },
  },
  {
    pattern: /本月|这个月|this\s*month/i,
    resolver: () => ({
      start: startOfMonth(now()),
      end: endOfDay(now()),
    }),
  },
  {
    pattern: /最近\s*(\d+)\s*天/,
    resolver: (m) => ({
      start: startOfDay(subDays(now(), parseInt(m[1]))),
      end: endOfDay(now()),
    }),
  },
  {
    pattern: /最近\s*(\d+)\s*周/,
    resolver: (m) => ({
      start: startOfDay(subWeeks(now(), parseInt(m[1]))),
      end: endOfDay(now()),
    }),
  },

  // ── 绝对日期：YYYY年MM月DD日 / YYYY年MM月DD号（允许空格） ──────
  {
    pattern: /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,
    resolver: (m, q) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (hasWeekCtx(q)) return { start: startOfWeek(d, WEEK_OPTS), end: endOfWeek(d, WEEK_OPTS) };
      if (hasMonthCtx(q)) return { start: startOfMonth(d), end: endOfMonth(d) };
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },

  // ── 绝对日期：YYYY-MM-DD ─────────────────────────────────────────
  {
    pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/,
    resolver: (m, q) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (hasWeekCtx(q)) return { start: startOfWeek(d, WEEK_OPTS), end: endOfWeek(d, WEEK_OPTS) };
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },

  // ── 绝对日期：MM月DD日（无年份，自动推断，允许空格） ─────────────
  {
    pattern: /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,
    resolver: (m, q) => {
      const month0 = parseInt(m[1]) - 1;
      const day = parseInt(m[2]);
      const d = new Date(inferYear(month0, day), month0, day);
      if (hasWeekCtx(q)) return { start: startOfWeek(d, WEEK_OPTS), end: endOfWeek(d, WEEK_OPTS) };
      return { start: startOfDay(d), end: endOfDay(d) };
    },
  },

  // ── 绝对月份：YYYY年MM月（无具体日，允许空格） ───────────────────
  {
    pattern: /(\d{4})\s*年\s*(\d{1,2})\s*月(?![\d日号])/,
    resolver: (m) => {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
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
      start: startOfDay(subDays(now(), 30)),
      end: endOfDay(now()),
    },
    matched: false,
  };
}
