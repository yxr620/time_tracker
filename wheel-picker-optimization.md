# 时间选择器滚轮优化方案

> **当前状态**：已实现基于 CSS scroll-snap 的原生滚动滚轮，已添加触觉反馈  
> **版本**：v1.1 - 2026-02-12  
> **组件位置**：`src/components/TimeTracker/WheelTimePicker.tsx`

---

## 目录

- [当前实现总结](#当前实现总结)
- [与原生滚轮的差距分析](#与原生滚轮的差距分析)
- [优化方案详解](#优化方案详解)
- [优先级推荐](#优先级推荐)

---

## 当前实现总结

### 技术方案
- **核心技术**：CSS `scroll-snap-type: y mandatory` + 原生滚动
- **惯性滚动**：✅ 浏览器原生动量物理引擎
- **滚动性能**：✅ GPU 加速、零 JS 计算开销
- **触摸体验**：✅ 支持快速甩动、滚动中点击暂停、微调

### 关键参数
```typescript
const ITEM_HEIGHT = 36;           // 单项高度
const VISIBLE_COUNT = 7;          // 可见项数
const PICKER_HEIGHT = 252;        // 滚轮总高度
const SCROLL_PADDING = 108;       // 上下填充（3.5项）
```

### 列配置
- **日期列**：±15 天（31 项），字体 16px
- **小时列**：00-23（24 项），等宽字体 20px
- **分钟列**：00-59（60 项），等宽字体 20px

---

## 与原生滚轮的差距分析

| 维度 | iOS/Android 原生 | 当前实现 | 差距评分 |
|------|-----------------|---------|---------|
| 惯性滚动 | ✅ 原生物理引擎 | ✅ 浏览器原生 | ⭐⭐⭐⭐⭐ 优秀 |
| 触觉反馈 | ✅ 每项震动 | ✅ 已实现（Light） | ⭐⭐⭐ 可用 |
| 滚动中确认 | ✅ 立即生效 | ⚠️ 延迟 120ms | ⭐⭐⭐ 可用 |
| 视觉反馈 | ✅ 实时高亮 | ⚠️ 去抖延迟 | ⭐⭐⭐⭐ 良好 |
| 3D 透视 | ✅（iOS） | ❌ 平面 | ⭐⭐⭐ 可选 |
| 边界弹性 | ✅ Rubber-band | ✅ 浏览器默认 | ⭐⭐⭐⭐ 良好 |
| 无障碍 | ✅ VoiceOver | ❌ 无 ARIA | ⭐⭐ 缺失 |

---

## 优化方案详解

### 🔥 P0 优先级 - 必须实现

#### 1. 触觉反馈（Haptic Feedback）

**问题**：滚动时没有震动，缺少物理实感

**原生行为**：
- iOS UIPickerView：每滚动经过一项时震动（UIImpactFeedbackGenerator.light）
- Android NumberPicker：快速滚动吸附时震动

**实现方案**：

```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const ScrollColumn: React.FC<ScrollColumnProps> = ({ ... }) => {
  const lastIndexRef = useRef(-1);

  const onScroll = useCallback(() => {
    if (programmaticRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    
    // 计算当前最接近中心的项索引
    const currentIdx = Math.round(el.scrollTop / ITEM_HEIGHT);
    
    // 跨越边界时触发震动
    if (currentIdx !== lastIndexRef.current && lastIndexRef.current !== -1) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Web 端不支持，静默失败
      });
    }
    lastIndexRef.current = currentIdx;
    
    // 原有的去抖提交逻辑
    clearTimeout(timer);
    timer = setTimeout(commitScroll, 120);
  }, [commitScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);
};
```

**依赖**：
```bash
npm install @capacitor/haptics
npx cap sync
```

**复杂度**：⭐ 低  
**体验提升**：⭐⭐⭐⭐⭐ 极高  
**预计工期**：30 分钟

---

#### 2. 滚动中点击确认立即生效

**问题**：快速滚动后直接点确认，会提交旧值（因为 commitScroll 有 120ms 去抖）

**原生行为**：滚动动画中点确认，立即读取当前最接近中心的项并提交

**实现方案**：

**步骤 1：WheelTimePicker 暴露强制同步方法**

```typescript
import { forwardRef, useImperativeHandle } from 'react';

export interface WheelTimePickerRef {
  forceCommit: () => void;
}

export const WheelTimePicker = forwardRef<WheelTimePickerRef, WheelTimePickerProps>(
  ({ value, onChange, isDark }, ref) => {
    const dateColRef = useRef<ScrollColumnRef>(null);
    const hourColRef = useRef<ScrollColumnRef>(null);
    const minuteColRef = useRef<ScrollColumnRef>(null);

    useImperativeHandle(ref, () => ({
      forceCommit: () => {
        // 强制所有列立即同步当前滚动位置
        dateColRef.current?.forceCommit();
        hourColRef.current?.forceCommit();
        minuteColRef.current?.forceCommit();
      }
    }));

    return (
      <div>
        <ScrollColumn ref={dateColRef} {...} />
        <ScrollColumn ref={hourColRef} {...} />
        <ScrollColumn ref={minuteColRef} {...} />
      </div>
    );
  }
);
```

**步骤 2：ScrollColumn 暴露 forceCommit**

```typescript
export interface ScrollColumnRef {
  forceCommit: () => void;
}

const ScrollColumn = forwardRef<ScrollColumnRef, ScrollColumnProps>(
  ({ items, selectedValue, onChange, ... }, ref) => {
    useImperativeHandle(ref, () => ({
      forceCommit: () => {
        const el = scrollRef.current;
        if (!el) return;
        const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(idx, items.length - 1));
        if (items[clamped].value !== selectedValue) {
          onChange(items[clamped].value);
        }
      }
    }));
    
    // ... 其余代码
  }
);
```

**步骤 3：TimeEntryForm 调用强制同步**

```typescript
const TimeEntryForm: React.FC = () => {
  const startPickerRef = useRef<WheelTimePickerRef>(null);
  const endPickerRef = useRef<WheelTimePickerRef>(null);

  const handleConfirmStart = () => {
    startPickerRef.current?.forceCommit(); // 强制同步
    setStartTime(startDraftValue);
    setSelectedDate(dayjs(startDraftValue).format('YYYY-MM-DD'));
    setStartPickerVisible(false);
  };

  return (
    <>
      <IonModal isOpen={startPickerVisible} ...>
        <IonButton onClick={handleConfirmStart}>确定</IonButton>
        <WheelTimePicker ref={startPickerRef} ... />
      </IonModal>
    </>
  );
};
```

**复杂度**：⭐⭐ 中  
**体验提升**：⭐⭐⭐⭐ 高  
**预计工期**：1 小时

---

### ⚡ P1 优先级 - 建议实现

#### 3. 实时视觉反馈优化

**问题**：选中项高亮依赖状态更新，有 120ms 延迟；非选中项透明度不够自然

**实现方案：基于 Intersection Observer 实时计算**

```typescript
const ScrollColumn: React.FC<ScrollColumnProps> = ({ ... }) => {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const containerRect = scrollRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        const centerY = containerRect.top + containerRect.height / 2;

        entries.forEach(entry => {
          const elem = entry.target as HTMLDivElement;
          const rect = entry.boundingClientRect;
          const itemCenterY = rect.top + rect.height / 2;
          const distance = Math.abs(itemCenterY - centerY);
          
          // 距离中心越远，透明度越低
          const maxDistance = ITEM_HEIGHT * 3;
          const opacity = Math.max(0.3, 1 - distance / maxDistance);
          
          // 选中项加粗
          const fontWeight = distance < ITEM_HEIGHT / 2 ? 700 : 400;
          
          elem.style.opacity = String(opacity);
          elem.style.fontWeight = String(fontWeight);
        });
      },
      {
        root: scrollRef.current,
        threshold: Array.from({ length: 21 }, (_, i) => i * 0.05)
      }
    );

    itemRefs.current.forEach(elem => observer.observe(elem));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div ref={scrollRef}>
      {items.map(item => (
        <div
          key={item.value}
          ref={el => el && itemRefs.current.set(item.value, el)}
          style={{
            transition: 'opacity 0.1s, font-weight 0.1s'
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
```

**复杂度**：⭐⭐⭐ 中  
**体验提升**：⭐⭐⭐ 中  
**预计工期**：2 小时

---

#### 4. 无障碍支持（a11y）

**问题**：屏幕阅读器用户无法使用滚轮

**实现方案**：

```typescript
const ScrollColumn: React.FC<ScrollColumnProps> = ({ items, selectedValue, onChange, ... }) => {
  const [focusedIndex, setFocusedIndex] = useState(
    items.findIndex(i => i.value === selectedValue)
  );

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const newIdx = index - 1;
      setFocusedIndex(newIdx);
      onChange(items[newIdx].value);
      // 滚动到该项
      scrollRef.current?.scrollTo({
        top: newIdx * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      const newIdx = index + 1;
      setFocusedIndex(newIdx);
      onChange(items[newIdx].value);
      scrollRef.current?.scrollTo({
        top: newIdx * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    }
  }, [items, onChange]);

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label="时间选择"
      aria-activedescendant={`item-${selectedValue}`}
    >
      {items.map((item, index) => (
        <div
          key={item.value}
          id={`item-${item.value}`}
          role="option"
          aria-selected={item.value === selectedValue}
          tabIndex={index === focusedIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setFocusedIndex(index)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
```

**复杂度**：⭐⭐⭐ 中  
**体验提升**：⭐⭐⭐⭐（对视障用户）  
**预计工期**：2 小时

---

#### 5. 日期列文字宽度稳定

**问题**："今天 02/12" vs "02/15 Mon" 宽度不一致，滚动时视觉抖动

**实现方案**：

```typescript
// 在 ScrollColumn 组件的样式中添加
const itemStyle = {
  fontSize: `${fontSize}px`,
  fontFamily,
  fontVariantNumeric: 'tabular-nums', // 等宽数字
  minWidth: '120px',                   // 固定最小宽度
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
  // ... 其他样式
};
```

**复杂度**：⭐ 低  
**体验提升**：⭐⭐  
**预计工期**：10 分钟

---

### P2 优先级 - 可选优化

#### 6. 边缘 padding 使用 scroll-padding

**当前**：用空 `<div>` 填充顶部/底部  
**优化**：使用 CSS `scroll-padding` 属性

```typescript
const ScrollColumn: React.FC<ScrollColumnProps> = ({ ... }) => {
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.style.scrollPadding = `${SCROLL_PADDING}px`;
    }
  }, []);

  return (
    <div ref={scrollRef} style={{ scrollPadding: `${SCROLL_PADDING}px` }}>
      {/* 移除顶部空 div */}
      {items.map(item => <div key={item.value}>...</div>)}
      {/* 移除底部空 div */}
    </div>
  );
};
```

**注意**：需测试在 iOS Safari 和 Android Chrome 的兼容性

**复杂度**：⭐ 低  
**体验提升**：⭐⭐  
**预计工期**：30 分钟

---

#### 7. iOS 风格 3D 圆柱透视效果

**效果**：项排列在 3D 圆柱面上，选中项在正面，其他项向后倾斜

**实现方案**：

```typescript
const ScrollColumn: React.FC<ScrollColumnProps> = ({ ... }) => {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    setScrollTop(scrollRef.current?.scrollTop || 0);
    // ... 其他逻辑
  }, []);

  return (
    <div
      ref={scrollRef}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1200px',
      }}
    >
      {items.map((item, index) => {
        const offset = index * ITEM_HEIGHT - scrollTop;
        const centerOffset = offset - PICKER_HEIGHT / 2 + ITEM_HEIGHT / 2;
        const rotateX = (centerOffset / ITEM_HEIGHT) * 5; // 5度/项

        return (
          <div
            key={item.value}
            style={{
              transform: `rotateX(${rotateX}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.1s',
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
};
```

**注意**：实时计算 transform 可能影响性能，需优化为 CSS 变量 + requestAnimationFrame

**复杂度**：⭐⭐⭐⭐ 高  
**体验提升**：⭐⭐⭐（视觉震撼但可选）  
**预计工期**：半天

---

### P3 优先级 - 不推荐

#### 8. 自定义物理引擎

**目标**：完全控制减速曲线、弹性回弹等物理特性

**方案**：监听 touch 事件，自己计算速度和位置  
**参考**：better-scroll、iscroll 库的实现

**不推荐原因**：
- 复杂度极高（需实现速度跟踪、动量计算、边界弹性）
- 失去浏览器 GPU 优化（原生滚动在合成层运行）
- 维护成本高
- 当前浏览器原生滚动已足够流畅

**复杂度**：⭐⭐⭐⭐⭐ 极高  
**体验提升**：⭐⭐（投入产出比低）

---

#### 9. 虚拟滚动

**目标**：只渲染可见区域的项，减少 DOM 节点

**当前状态**：分钟列 60 项全部渲染，性能尚可  
**适用场景**：列表项超过 200 个，或低端设备卡顿时

**方案**：使用 react-window 或手写虚拟滚动

**不推荐原因**：
- 当前 60 项性能无瓶颈
- 虚拟滚动与 scroll-snap 结合有额外复杂度
- 增加代码维护成本

**复杂度**：⭐⭐⭐⭐ 高  
**体验提升**：⭐⭐（暂不需要）

---

#### 10. 滚动音效

**效果**：Android 风格，滚动时播放轻微点击声

**实现方案**：

```typescript
const tickAudio = new Audio('/assets/tick.mp3');
tickAudio.volume = 0.1;

const onScroll = useCallback(() => {
  const currentIdx = Math.round(el.scrollTop / ITEM_HEIGHT);
  if (currentIdx !== lastIndexRef.current) {
    tickAudio.currentTime = 0;
    tickAudio.play().catch(() => {});
  }
  lastIndexRef.current = currentIdx;
}, []);
```

**不推荐原因**：
- 可能让用户感到烦躁
- 需要提供开关设置
- 音频资源额外加载

**复杂度**：⭐ 低  
**体验提升**：⭐（可能负面效果）

---

## 优先级推荐

### 实施路线图

#### Phase 1 - 核心体验（P0）
**目标**：达到原生滚轮 90% 的体验  
**工期**：1.5 小时

- [x] 触觉反馈（30 分钟）— ✅ 已实现，效果一般（ImpactStyle.Light）
- [ ] 滚动中点击确认立即生效（1 小时）

#### Phase 2 - 完善细节（P1）
**目标**：提升精致度和可访问性  
**工期**：5 小时

- [ ] 日期列文字宽度稳定（10 分钟）
- [ ] 实时视觉反馈优化（2 小时）
- [ ] 无障碍支持（2 小时）

#### Phase 3 - 锦上添花（P2）
**目标**：视觉效果提升  
**工期**：按需

- [ ] 边缘 padding 优化（30 分钟）
- [ ] 3D 圆柱透视效果（半天，可选）

---

## 测试清单

### 功能测试
- [ ] 快速滑动后惯性滚动流畅
- [ ] 滚动中点击屏幕立即停止
- [ ] 滚动中点确认按钮，值正确提交
- [ ] 跨越每一项时触发震动（移动端）
- [ ] 键盘上下箭头可操作（无障碍）
- [ ] 屏幕阅读器正确朗读当前值

### 性能测试
- [ ] 快速滚动分钟列（01→59）无掉帧
- [ ] iOS Safari 滚动流畅度
- [ ] Android Chrome 滚动流畅度
- [ ] 低端设备（如 iPhone SE 2）测试

### 兼容性测试
- [ ] iOS 15+
- [ ] Android 10+
- [ ] 深色模式显示正常
- [ ] 横屏模式布局正常

---

## 技术债务记录

### 依赖项
- `@capacitor/haptics` - 触觉反馈（✅ 已安装 v7.0.3）

### 已知限制
1. Web 端不支持震动 API（需优雅降级）
2. scroll-snap 在部分旧版浏览器不支持（iOS < 11, Android < 69）
3. 3D transform 可能影响低端设备性能

### 未来考虑
- 考虑接入用户偏好设置（震动开关、音效开关）
- 支持自定义项高度（当前硬编码 36px）
- 支持横向滚轮（年月选择器）

---

## 参考资料

### 官方文档
- [CSS scroll-snap - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)
- [Capacitor Haptics API](https://capacitorjs.com/docs/apis/haptics)
- [ARIA Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)

### 开源参考
- [react-mobile-picker](https://github.com/adcentury/react-mobile-picker) - 当前使用（已替换）
- [better-scroll](https://github.com/ustbhuangyi/better-scroll) - 自定义物理引擎参考
- [react-window](https://github.com/bvaughn/react-window) - 虚拟滚动参考

---

**文档维护者**：GitHub Copilot  
**最后更新**：2026-02-12  
**下次审查**：实现 Phase 1 后更新
