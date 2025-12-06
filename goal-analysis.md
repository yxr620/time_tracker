# 目标深度分析 - 技术文档

## 功能概述

目标深度分析模块提供超越简单 Top 10 分布的目标洞察能力，核心功能包括：

- **智能聚类**：自动将相似目标归为同一簇
- **健康状态追踪**：活跃/放缓/停滞三种状态
- **趋势可视化**：目标簇时间投入趋势
- **未关联事件建议**：识别可能相关的无目标记录

## 核心算法

### 目标聚类

使用 **Union-Find** 数据结构 + **Jaccard 相似度** 实现目标聚类：

```
相似度计算流程:
1. 分词 (tokenize)
   - 中文: 提取连续汉字，生成 bigram
   - 英文: 按空格/符号分割，转小写
   - 过滤停用词 (app, 的, 了 等)

2. Jaccard 相似度
   similarity = |A ∩ B| / |A ∪ B|

3. Union-Find 聚类
   相似度 >= 阈值 → 合并到同一簇
```

**阈值设置**：
| 模式 | 阈值 | 适用场景 |
|------|------|----------|
| loose | 0.2 | 宽松匹配 |
| standard | 0.35 | 默认 |
| strict | 0.5 | 严格匹配 |

### 健康状态判定

```
活跃 (active):   最后活动 ≤ 7 天
放缓 (slowing):  最后活动 7-14 天
停滞 (stalled):  最后活动 > 14 天
```

## 文件结构

```
src/
├── types/
│   └── goalAnalysis.ts           # 类型定义
├── services/analysis/
│   ├── goalCluster.ts            # 聚类算法
│   └── goalAnalysisProcessor.ts  # 数据处理
└── components/GoalAnalysisPage/
    ├── GoalAnalysisPage.tsx      # UI 组件
    └── GoalAnalysisPage.css      # 样式
```

## 主要类型

```typescript
interface GoalCluster {
  id: string;
  name: string;           // 代表性目标名
  goals: Goal[];          // 簇内所有目标
  entries: TimeEntry[];   // 关联的时间记录
  totalDuration: number;  // 总时长 (ms)
}

interface ClusterStats {
  clusterId: string;
  totalDuration: number;
  activeDays: number;
  lastActiveDate: string;
  healthStatus: 'active' | 'slowing' | 'stalled';
}
```

## 显示优化

- 趋势图仅展示 **Top 8** 目标簇，其余合并为「其他 (N个)」
- 按 `totalDuration` 降序排列
- 健康状态汇总卡片提供快速概览

## 已知限制

1. **短词匹配问题**：极短的目标名（如 "vldb"）可能无法与较长的相关目标（如 "vldb投稿"）正确聚类
2. **Link 按钮**：未关联事件的「关联」功能为 TODO 占位，暂不修改数据库

## 扩展方向

- [ ] 手动调整聚类
- [ ] 自定义相似度阈值
- [ ] 未关联事件实际关联功能
- [ ] 导出目标分析报告
