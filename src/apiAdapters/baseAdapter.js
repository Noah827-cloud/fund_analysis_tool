// @ts-check

/**
 * Adapter interface (JSDoc)
 * 真实 API / 第三方 API / Mock 都应映射到内部契约的同一返回结构。
 *
 * @typedef {import('../contracts/types.js').Envelope<any>} Envelope
 * @typedef {import('../contracts/types.js').PortfolioSummary} PortfolioSummary
 * @typedef {import('../contracts/types.js').FundHistoryRange} FundHistoryRange
 * @typedef {import('../contracts/types.js').FundBasicInfo} FundBasicInfo
 * @typedef {import('../contracts/types.js').FundIndustryConfig} FundIndustryConfig
 * @typedef {import('../contracts/types.js').FundTopHoldings} FundTopHoldings
 * @typedef {import('../contracts/types.js').FundTopHoldingsComparison} FundTopHoldingsComparison
 * @typedef {import('../contracts/types.js').FundAssetAllocation} FundAssetAllocation
 * @typedef {import('../contracts/types.js').FundGrandTotal} FundGrandTotal
 * @typedef {import('../contracts/types.js').FundQuote} FundQuote
 * @typedef {import('../contracts/types.js').NavHistory} NavHistory
 * @typedef {import('../contracts/types.js').AnalysisResult} AnalysisResult
 * @typedef {import('../contracts/types.js').ReportResult} ReportResult
 * @typedef {import('../contracts/types.js').Alert} Alert
 * @typedef {import('../contracts/types.js').ChatMessage} ChatMessage
 */

/**
 * @typedef {Object} FundAdapter
 * @property {(options?: { force?: boolean }) => Promise<PortfolioSummary>} getPortfolioSummary
 * @property {(params: { fundCode: string }) => Promise<FundBasicInfo>} getFundBasicInfo
 * @property {(params: { fundCode: string }) => Promise<FundIndustryConfig>} getFundIndustryConfig
 * @property {(params: { fundCode: string }) => Promise<FundTopHoldings>} getFundTopHoldings
 * @property {(params: { fundCode: string }) => Promise<FundTopHoldingsComparison>} getFundTopHoldingsComparison
 * @property {(params: { fundCode: string }) => Promise<FundAssetAllocation>} getFundAssetAllocation
 * @property {(params: { fundCode: string }) => Promise<FundGrandTotal>} getFundGrandTotal
 * @property {(params: { fundCode: string }) => Promise<FundQuote>} getFundQuote
 * @property {(params: { fundCode: string, range: FundHistoryRange, endDate?: string }) => Promise<NavHistory>} getFundNavHistory
 * @property {(params: { fundCode: string, horizon?: '1y'|'3y'|'since' }) => Promise<AnalysisResult>} getAnalysisResult
 * @property {(params: { period: 'week'|'month'|'quarter'|'year', date: string }) => Promise<ReportResult>} getReportResult
 * @property {(options?: { force?: boolean }) => Promise<Alert[]>} getAlerts
 * @property {(params: { fundCode: string, fundName: string, type: Alert['type'], condition: Alert['condition'], targetValue: number, unit: Alert['unit'] }) => Promise<Alert>} createAlert
 * @property {(params: { id: Alert['id'], patch: Partial<Alert> }) => Promise<Alert>} updateAlert
 * @property {(params: { id: Alert['id'] }) => Promise<boolean>} deleteAlert
 * @property {(params: { message: string, history?: ChatMessage[] }) => Promise<ChatMessage>} chatComplete
 */

export {};
