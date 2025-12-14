import {
  getAnalysisResult,
  getDashboardData,
  getFundBasicInfo,
  getFundNavHistory,
  getFundQuote,
  getReportResult,
  refreshDashboardData,
} from '../services/dataService.js';

// 提供给 Vue 组件的简单封装，便于后续迁移时复用 DataService
export function useDataService() {
  return {
    getAnalysisResult,
    getDashboardData,
    getFundBasicInfo,
    getFundNavHistory,
    getFundQuote,
    getReportResult,
    refreshDashboardData,
  };
}
