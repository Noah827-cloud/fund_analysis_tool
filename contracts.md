# 内部数据契约（Internal Contract）v1.3

本文件定义“基金分析工具”内部使用的数据模型与返回约定，用于：

- 前端页面/Pinia/Composable/DataService 之间保持统一字段与类型
- Mock 与真实接口（第三方 API / 自建后端）通过 Adapter/Transformer 映射到同一模型
- 降低未来接入真实数据、增加多用户、引入后端时的返工成本

> 说明：内部契约不依赖具体第三方 API 的字段；第三方返回只负责映射到本契约。

---

## 1. 基本约定

### 1.1 数值单位
- 金额：人民币（CNY），字段为 `number`，单位为“元”
- 百分比：字段为 `number`，取值范围 `[-100, +∞)`，单位为“百分比点”（例如 `6.53` 表示 `6.53%`）
- 份额：字段为 `number`
- 净值（NAV）：字段为 `number`，通常展示保留 4 位小数

### 1.2 时间与日期
- 日期：`YYYY-MM-DD`（如 `2025-12-13`）
- 时间戳：优先使用 ISO 字符串（如 `2025-12-13T09:00:00+08:00`）

### 1.3 通用 Envelope
所有“对外数据访问层”（DataService/后端 API）建议统一返回 Envelope：

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

- `code`: `string | number`，业务码（`OK`、`INVALID_PARAMS`、`AUTH_REQUIRED`…）
- `message`: `string`，面向用户或开发者的描述
- `data`: `T`，业务数据
- `traceId`: `string`（可选），链路追踪标识

---

## 2. 行情（Market）

### 2.1 FundBasicInfo（基金基础信息，最小集）
```ts
{
  fundCode: string,
  name: string,
  type?: string,
  inceptionDate?: string,   // YYYY-MM-DD
  company?: string,
  riskLevel?: string,
  tags?: string[]
}
```

### 2.2 FundIndustryConfig（F10 行业配置，按季度）
```ts
{
  fundCode: string,
  asOfDate: string,         // YYYY-MM-DD（季度末）
  industries: Array<{
    name: string,
    pct: number             // 百分比点（%）
  }>,
  source?: string
}
```

> 说明：本接口描述“基金持仓的行业配置”（常见为宏观行业分类，如 制造业/金融业…），用于分析/展示，不直接等同于 `Holding.industry`（主题/风格标签，如 新能源/电池/科技…）。若第三方不提供行业配置，可返回空数组。

### 2.3 FundTopHoldings（重仓股票 TopN，按季度）
```ts
{
  fundCode: string,
  asOfDate: string,         // YYYY-MM-DD（报告期）
  holdings: Array<{
    stockCode: string,
    stockName: string,
    weightPct: number,      // 占净值比例（%）
    sharesWan: number,      // 持股数（万股）
    marketValueWan: number  // 持仓市值（万元）
  }>,
  source?: string
}
```

> 说明：用于持仓分析页展示“重仓股票与比例”。数据通常按季披露，因此建议缓存 12h～24h。

### 2.4 FundTopHoldingsComparison（重仓股票季度对比）
```ts
{
  fundCode: string,
  current: { asOfDate: string, holdings: FundTopHoldings['holdings'] },
  previous: { asOfDate: string, holdings: FundTopHoldings['holdings'] },
  changes: {
    added: Array<{ stockCode: string, stockName: string, currWeightPct: number | null }>,
    removed: Array<{ stockCode: string, stockName: string, prevWeightPct: number | null }>,
    changed: Array<{ stockCode: string, stockName: string, prevWeightPct: number | null, currWeightPct: number | null, deltaWeightPct: number | null }>
  },
  source?: string
}
```

> 说明：用于“持仓分析”页展示较上季度新增/移除/占比变化。上游无上季度数据时可返回空列表。

### 2.5 FundAssetAllocation（基金资产配置，按季度）
```ts
{
  fundCode: string,
  asOfDate: string, // YYYY-MM-DD（最新季度末）
  quarters: Array<{
    date: string,    // YYYY-MM-DD（季度末）
    stockPct: number,
    bondPct: number,
    cashPct: number,
    otherPct: number
  }>,
  source?: string
}
```

> 说明：来自基金季报披露（非实时），用于分析页“资产配置”展示与季度对比。

### 2.6 FundGrandTotal（同类平均/基准指数对比序列）
```ts
{
  fundCode: string,
  startDate: string,
  endDate: string,
  series: Array<{
    name: string, // 本基金 / 同类平均 / 基准指数（如 沪深300）
    points: Array<{ date: string, valuePct: number }>
  }>,
  source?: string
}
```

> 说明：用于“同类对比”页展示近阶段（通常约 6 个月）的累计收益对比，可用于推导波动率/最大回撤等指标。

### 2.7 FundQuote（最新行情）
```ts
{
  fundCode: string,
  nav: number,              // 最新单位净值（或估算净值）
  navDate: string,          // YYYY-MM-DD（净值对应日期）
  change: number,           // 单位净值变动（= nav - prevNav）
  changePercent: number,    // 百分比点（%）
  updatedAt: string,        // ISO 时间戳（抓取/计算时间）
  source?: string,          // 数据源标识（mock/ttfund/...）
  estimatedNav?: number,    // 可选：盘中估算净值
  estimatedChangePercent?: number
}
```

### 2.8 NavHistoryRequest / NavHistory（历史净值与收益序列）
```ts
{
  fundCode: string,
  range: '30d' | '90d' | '1y' | '3y' | 'since',
  endDate?: string // YYYY-MM-DD，默认今日
}
```

```ts
{
  fundCode: string,
  range: '30d' | '90d' | '1y' | '3y' | 'since',
  points: Array<{
    date: string,           // YYYY-MM-DD，升序
    nav: number,            // 单位净值
    returnPct: number,      // 区间收益（相对前一点，百分比点）
    cumulativePct: number   // 累计收益（相对起点，百分比点）
  }>
}
```

> 说明：`points` 建议包含起点（returnPct=0,cumulativePct=0），因此长度通常为 “天数+1”。

---

## 3. 仪表盘（Dashboard）

### 3.1 PortfolioSummary
```ts
{
  totalAssets: number,
  todayProfit: number,
  totalProfit: number,
  profitRate: number,
  funds: Holding[],
  assetAllocation: AssetAllocation,
  industryDistribution: IndustryDistribution
}
```

### 3.2 Holding（持仓 - 展示模型）
```ts
{
  code: string,
  name: string,
  type: string              // 类型（优先来自 FundBasicInfo.type；为空时可由用户维护）
  nav: number,
  change: number,
  changePercent: number,
  holdShares: number,
  holdValue: number,
  buyPrice: number,
  profit: number,
  profitPercent: number,
  industry: string          // 行业/风格/主题标签（如 港股/蓝筹股/中小盘/白酒/新能源）
}
```

### 3.3 AssetAllocation / IndustryDistribution
```ts
type AssetAllocation = { stock: number, bond: number, cash: number }
type IndustryDistribution = Record<string, number>  // 行业/风格标签 -> 占比%
```

> 说明：`industryDistribution` 是基于 `funds[].industry` 聚合得出；若未来接入真实 API，可将 API 返回的行业/主题/标签字段映射到 `industry`，否则由用户在新增/编辑时维护。

---

## 4. 分析（Analysis）

### 4.1 AnalysisRequest
```ts
{
  fundCode: string,
  horizon: '1y' | '3y' | 'since'
}
```

### 4.2 AnalysisResult
```ts
{
  fundCode: string,
  metrics: AnalysisMetrics,
  series: AnalysisSeries
}
```

### 4.3 AnalysisMetrics（推荐使用“原始数值”）
```ts
{
  nav: number,
  navChangePct: number,
  yearReturnPct: number,
  sharpeRatio: number | null,
  maxDrawdownPct: number,          // 负值
  volatilityPct?: number,          // 年化波动率（%）
  maxDrawdownRecoveryDays?: number | null, // 最大回撤修复天数（未修复为 null）
  similarRank?: number | null,     // 同类排名（越小越好）
  similarTotal?: number | null,    // 同类总数
  similarPercentile?: number | null // 同类百分位（0-100，越大越好）
}
```

### 4.4 AnalysisSeries
```ts
{
  dates: string[],                 // 366 个点（含起点 0）
  fundCumulativePct: number[],     // 366 个点（累计收益%）
  benchmarkCumulativePct: number[],
  drawdownPct: number[],           // 366 个点（回撤%）
  monthlyReturnPct: number[]       // 12 个点（月度收益%）
}
```

---

## 5. 报告（Reports）

### 5.1 ReportRequest
```ts
{
  period: 'week' | 'month' | 'quarter' | 'year',
  date: string // YYYY-MM-DD
}
```

### 5.2 ReportResult
```ts
{
  period: 'week' | 'month' | 'quarter' | 'year',
  date: string,
  metrics: ReportMetrics,
  series: ReportSeries,
  holdings: ReportHoldings
}
```

### 5.3 ReportMetrics（推荐原始数值）
```ts
{
  profitCny: number,
  profitRatePct: number,
  annualReturnPct: number,
  maxDrawdownPct: number,     // 负值
  sharpeRatio: number | null
}
```

### 5.4 ReportSeries / ReportHoldings
```ts
{
  labels: string[],
  periodReturnPct: number[],      // 周度=日收益，月度=周收益，季度=月收益，年度=季度收益
  cumulativePct: number[]
}
```

```ts
{
  funds: string[],
  startValueCny: number[],
  endValueCny: number[]
}
```

---

## 6. 提醒（Alerts）

### 6.1 Alert
```ts
{
  id: number | string,
  fundCode: string,
  fundName: string,
  type: 'profit' | 'loss' | 'price' | 'nav',
  condition: 'above' | 'below',
  targetValue: number,
  currentValue: number,
  unit: 'percent' | 'amount',
  status: 'active' | 'paused' | 'triggered',
  createdAt: string,
  lastTriggered: string | null
}
```

---

## 7. 聊天（Chat）

### 7.1 ChatMessage
```ts
{
  id: number | string,
  sender: 'user' | 'ai',
  text: string
}
```

---

## 8. 错误码（建议）
- `OK`
- `INVALID_PARAMS`
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMITED`
- `UPSTREAM_ERROR`
- `TIMEOUT`
- `UNKNOWN_ERROR`

---

## 9. 备注（现状与差距）
- 当前部分 store 使用“展示字符串”（如 `+¥12,450`、`+18.23%`）作为 UI 直接渲染，后续接入真实 API 时建议同时保留 `metricsRaw` 以统一数值类型。
- 当前 DataService + Adapter 已覆盖 Dashboard/Analysis/Reports/Alerts/Chat 的“统一入口”，后续切换为真实后端/第三方数据源只需替换 adapter 实现。
- v1.1 新增 `FundQuote/NavHistory`，用于“真实行情接入前”的契约占位：即使真实数据源字段不确定，也能先稳定前端调用面。
