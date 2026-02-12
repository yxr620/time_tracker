import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';

// ============ 常量 ============

const ITEM_HEIGHT = 36;
const VISIBLE_COUNT = 7;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 252
const SCROLL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2); // 108

// 注入隐藏滚动条的 CSS（仅执行一次）
if (typeof document !== 'undefined' && !document.getElementById('_wtp_css')) {
  const s = document.createElement('style');
  s.id = '_wtp_css';
  s.textContent = '.wtp-col::-webkit-scrollbar{display:none}';
  document.head.appendChild(s);
}

// ============ 静态数据 ============

const HOURS: readonly { value: string; label: string }[] = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});

const MINUTES: readonly { value: string; label: string }[] = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});

const generateDateItems = (): { value: string; label: string }[] => {
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');
  const yesterdayStr = today.subtract(1, 'day').format('YYYY-MM-DD');
  const tomorrowStr = today.add(1, 'day').format('YYYY-MM-DD');

  return Array.from({ length: 31 }, (_, i) => {
    const d = today.add(i - 15, 'day');
    const dateStr = d.format('YYYY-MM-DD');
    let label: string;
    if (dateStr === todayStr) label = `今天 ${d.format('MM/DD')}`;
    else if (dateStr === yesterdayStr) label = `昨天 ${d.format('MM/DD')}`;
    else if (dateStr === tomorrowStr) label = `明天 ${d.format('MM/DD')}`;
    else label = d.format('MM/DD ddd');
    return { value: dateStr, label };
  });
};

// ============ ScrollColumn（原生 scroll-snap 滚轮列）============

interface ScrollColumnProps {
  items: readonly { value: string; label: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
  isDark: boolean;
  fontSize?: number;
  fontFamily?: string;
}

const ScrollColumn: React.FC<ScrollColumnProps> = React.memo(({
  items, selectedValue, onChange, isDark,
  fontSize = 18, fontFamily,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);
  const initializedRef = useRef(false);

  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const dimColor = isDark ? '#475569' : '#cbd5e1';

  const selectedIndex = useMemo(
    () => Math.max(0, items.findIndex(i => i.value === selectedValue)),
    [items, selectedValue]
  );

  // 同步滚动位置到选中值
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = selectedIndex * ITEM_HEIGHT;

    if (!initializedRef.current) {
      // 首次挂载：等待布局完成后设置滚动位置
      const init = () => {
        if (el.scrollHeight > PICKER_HEIGHT) {
          el.scrollTop = target;
          initializedRef.current = true;
        } else {
          requestAnimationFrame(init);
        }
      };
      requestAnimationFrame(init);
      return;
    }

    // 值被外部修改时，同步滚动位置（避免干扰用户正在进行的滚动）
    if (Math.abs(el.scrollTop - target) > ITEM_HEIGHT * 0.5) {
      programmaticRef.current = true;
      el.scrollTop = target;
      requestAnimationFrame(() => { programmaticRef.current = false; });
    }
  }, [selectedIndex]);

  // 滚动结束后读取位置并提交值
  const commitScroll = useCallback(() => {
    if (programmaticRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped].value !== selectedValue) {
      onChange(items[clamped].value);
    }
  }, [items, selectedValue, onChange]);

  // 监听 scroll 事件，用去抖动检测滚动结束（等待 scroll-snap 吸附完成）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(commitScroll, 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [commitScroll]);

  return (
    <div
      ref={scrollRef}
      className="wtp-col"
      style={{
        flex: '1 1 0%',
        height: `${PICKER_HEIGHT}px`,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      } as React.CSSProperties}
    >
      <div style={{ height: `${SCROLL_PADDING}px`, flexShrink: 0 }} />
      {items.map((item) => (
        <div
          key={item.value}
          style={{
            height: `${ITEM_HEIGHT}px`,
            scrollSnapAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${fontSize}px`,
            fontFamily,
            fontWeight: item.value === selectedValue ? 700 : 400,
            color: item.value === selectedValue ? textColor : dimColor,
            transition: 'color 0.15s, font-weight 0.15s',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {item.label}
        </div>
      ))}
      <div style={{ height: `${SCROLL_PADDING}px`, flexShrink: 0 }} />
    </div>
  );
});

ScrollColumn.displayName = 'ScrollColumn';

// ============ WheelTimePicker ============

interface WheelTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  isDark: boolean;
}

export const WheelTimePicker: React.FC<WheelTimePickerProps> = ({ value, onChange, isDark }) => {
  const dateItems = useMemo(() => generateDateItems(), []);
  // 用 ref 持有最新 value，使回调函数引用稳定
  const valueRef = useRef(value);
  valueRef.current = value;

  const dateVal = dayjs(value).format('YYYY-MM-DD');
  const hourVal = dayjs(value).format('HH');
  const minuteVal = dayjs(value).format('mm');

  const updateDate = useCallback((v: string) => {
    const cur = dayjs(valueRef.current);
    onChange(dayjs(v).hour(cur.hour()).minute(cur.minute()).second(0).millisecond(0).toDate());
  }, [onChange]);

  const updateHour = useCallback((v: string) => {
    const cur = dayjs(valueRef.current);
    onChange(cur.hour(parseInt(v, 10)).second(0).millisecond(0).toDate());
  }, [onChange]);

  const updateMinute = useCallback((v: string) => {
    const cur = dayjs(valueRef.current);
    onChange(cur.minute(parseInt(v, 10)).second(0).millisecond(0).toDate());
  }, [onChange]);

  const textColor = isDark ? '#f1f5f9' : '#1e293b';

  return (
    <div style={{ position: 'relative' }}>
      {/* 选中行高亮条 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '8px',
        right: '8px',
        height: `${ITEM_HEIGHT}px`,
        transform: 'translateY(-50%)',
        background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
        borderRadius: '12px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* 三列滚轮 */}
      <div style={{
        display: 'flex',
        height: `${PICKER_HEIGHT}px`,
        position: 'relative',
        overflow: 'hidden',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
      }}>
        <ScrollColumn
          items={dateItems}
          selectedValue={dateVal}
          onChange={updateDate}
          isDark={isDark}
          fontSize={16}
        />
        <ScrollColumn
          items={HOURS}
          selectedValue={hourVal}
          onChange={updateHour}
          isDark={isDark}
          fontSize={20}
          fontFamily="Monaco, Menlo, monospace"
        />
        <ScrollColumn
          items={MINUTES}
          selectedValue={minuteVal}
          onChange={updateMinute}
          isDark={isDark}
          fontSize={20}
          fontFamily="Monaco, Menlo, monospace"
        />
      </div>

      {/* 冒号分隔符 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 'calc(66.6% - 4px)',
        transform: 'translateY(-50%)',
        fontSize: '20px',
        fontWeight: 700,
        fontFamily: 'Monaco, Menlo, monospace',
        color: textColor,
        pointerEvents: 'none',
        zIndex: 10,
      }}>:</div>
    </div>
  );
};
