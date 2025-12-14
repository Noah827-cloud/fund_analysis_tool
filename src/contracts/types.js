// @ts-check

/**
 * 内部数据契约（JSDoc 版）
 * - 不引入 TypeScript 也能让 IDE 基于 JSDoc 做类型提示
 * - Mock/Adapter/DataService 可逐步引用这些类型，保持返回结构一致
 */

export const CONTRACT_VERSION = 'v1.1';

export const ERROR_CODES = {
  OK: 'OK',
  INVALID_PARAMS: 'INVALID_PARAMS',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * @template T
 * @typedef {Object} Envelope
 * @property {string|number} code
 * @property {string} message
 * @property {T} data
 * @property {string} [traceId]
 */

/**
 * @typedef {Object} AssetAllocation
 * @property {number} stock
 * @property {number} bond
 * @property {number} cash
 */

/**
 * @typedef {Record<string, number>} IndustryDistribution
 */

/**
 * @typedef {Object} Holding
 * @property {string} code
 * @property {string} name
 * @property {string} type 类型（优先来自 FundBasicInfo.type；为空时可由用户维护）
 * @property {number} nav
 * @property {number} change
 * @property {number} changePercent
 * @property {number} holdShares
 * @property {number} holdValue
 * @property {number} buyPrice
 * @property {number} profit
 * @property {number} profitPercent
 * @property {string} industry 行业/风格/主题标签（如 港股/蓝筹股/中小盘/白酒/新能源）
 */

/**
 * @typedef {Object} PortfolioSummary
 * @property {number} totalAssets
 * @property {number} todayProfit
 * @property {number} totalProfit
 * @property {number} profitRate
 * @property {Holding[]} funds
 * @property {AssetAllocation} assetAllocation
 * @property {IndustryDistribution} industryDistribution
 */

/**
 * @typedef {'30d'|'90d'|'1y'|'3y'|'since'} FundHistoryRange
 */

/**
 * @typedef {Object} FundBasicInfo
 * @property {string} fundCode
 * @property {string} name
 * @property {string} [type]
 * @property {string} [inceptionDate]   // YYYY-MM-DD
 * @property {string} [company]
 * @property {string} [riskLevel]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} FundQuote
 * @property {string} fundCode
 * @property {number} nav
 * @property {string} navDate           // YYYY-MM-DD
 * @property {number} change
 * @property {number} changePercent     // 百分比点
 * @property {string} updatedAt         // ISO
 * @property {string} [source]
 * @property {number} [estimatedNav]
 * @property {number} [estimatedChangePercent]
 */

/**
 * @typedef {Object} NavHistoryPoint
 * @property {string} date              // YYYY-MM-DD
 * @property {number} nav
 * @property {number} returnPct         // 区间收益（相对前一点，百分比点）
 * @property {number} cumulativePct     // 累计收益（相对起点，百分比点）
 */

/**
 * @typedef {Object} NavHistory
 * @property {string} fundCode
 * @property {FundHistoryRange} range
 * @property {NavHistoryPoint[]} points
 */

/**
 * @typedef {'week'|'month'|'quarter'|'year'} ReportPeriod
 */

/**
 * @typedef {Object} ReportMetricsRaw
 * @property {number} profitCny
 * @property {number} profitRatePct
 * @property {number} annualReturnPct
 * @property {number} maxDrawdownPct
 * @property {number|null} sharpeRatio
 */

/**
 * @typedef {Object} ReportSeries
 * @property {string[]} labels
 * @property {number[]} periodReturnPct
 * @property {number[]} cumulativePct
 */

/**
 * @typedef {Object} ReportHoldings
 * @property {string[]} funds
 * @property {number[]} startValueCny
 * @property {number[]} endValueCny
 */

/**
 * @typedef {Object} ReportResult
 * @property {ReportPeriod} period
 * @property {string} date
 * @property {ReportMetricsRaw} metrics
 * @property {ReportSeries} series
 * @property {ReportHoldings} holdings
 */

/**
 * @typedef {Object} AnalysisMetricsRaw
 * @property {number} nav
 * @property {number} navChangePct
 * @property {number} yearReturnPct
 * @property {number|null} sharpeRatio
 * @property {number} maxDrawdownPct
 */

/**
 * @typedef {Object} AnalysisSeries
 * @property {string[]} dates
 * @property {number[]} fundCumulativePct
 * @property {number[]} benchmarkCumulativePct
 * @property {number[]} drawdownPct
 * @property {number[]} monthlyReturnPct
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} fundCode
 * @property {AnalysisMetricsRaw} metrics
 * @property {AnalysisSeries} series
 */

/**
 * @typedef {'profit'|'loss'|'price'|'nav'} AlertType
 * @typedef {'above'|'below'} AlertCondition
 * @typedef {'percent'|'amount'} AlertUnit
 * @typedef {'active'|'paused'|'triggered'} AlertStatus
 */

/**
 * @typedef {Object} Alert
 * @property {number|string} id
 * @property {string} fundCode
 * @property {string} fundName
 * @property {AlertType} type
 * @property {AlertCondition} condition
 * @property {number} targetValue
 * @property {number} currentValue
 * @property {AlertUnit} unit
 * @property {AlertStatus} status
 * @property {string} createdAt
 * @property {string|null} lastTriggered
 */

/**
 * @typedef {'user'|'ai'} ChatSender
 */

/**
 * @typedef {Object} ChatMessage
 * @property {number|string} id
 * @property {ChatSender} sender
 * @property {string} text
 */
