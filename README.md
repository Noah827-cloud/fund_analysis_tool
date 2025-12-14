# 智能基金分析工具

一个功能完备的基金分析与可视化前端，已完成本地化依赖和 Vite 多页构建，并完成 Vue 3 + Pinia 多页面迁移。

## 当前进展

- 依赖本地化：Tailwind/ECharts/Anime.js 走 npm 包构建，无外网 CDN 依赖。
- Vite 多页入口：`index` / `analysis` / `alerts` / `chat` / `reports` 均为 ES Module 入口，打包输出到 `dist/`。
- 数据服务抽象：`src/services/dataService.js` 提供统一数据入口（缓存/超时/日志/延迟），并通过 `src/apiAdapters/` 支持 Mock/真实接口切换（Dashboard/Analysis/Reports 已接入）。
- 内联脚本模块化：主页、分析页、提醒、聊天、报告等页面脚本拆分至 `src/pages/`，移除内联逻辑。
- 组件化与状态管理：Vue 3 + Pinia 已覆盖 dashboard/alerts/chat/reports/analysis 页面，便于后续接入真实 API。
- 数据持久化：dashboard/alerts 已支持 localStorage 持久化，刷新不丢失（后续可演进为 SQLite/后端）。
- 内部数据契约：`contracts.md` / `src/contracts/types.js`（v1.1），补齐 Market/Analysis/Reports 模型（含 `FundQuote/NavHistory`），便于 mock/真实接口切换。
- 行情接口占位：DataService/Adapter 已提供 `getFundBasicInfo/getFundQuote/getFundNavHistory`（当前为 mock 实现，后续可替换为真实数据源/后端代理）。
- Dashboard 解耦：localStorage 仅保存用户持仓（份额/成本），行情 Quote 与收益趋势 NavHistory 通过 DataService 拉取并合并（区间切换由 store 驱动）。
- 跨页联动：Alerts/Analysis 的基金下拉自动合并 Dashboard 持仓，支持对用户新增基金一键“设置提醒/深度分析”并正确预填。
- 提醒数据入口：Alerts 已通过 DataService/Adapter 统一读写（当前为 mock/localStorage 实现，后续可切换后端）。
- 日志与验证：新增 `src/utils/logger.js`（统一日志），`src/pages/vue-demo.vue`（Pinia + DataService 验证页）。
- 持久化补齐：Chat 对话、Reports 周期/日期选择已 localStorage 持久化，刷新不丢。
- 性能优化：ECharts 改为按需引入并拆分 vendor chunk（`vendor-echarts`），减少首屏体积与构建告警。
- 首页一致性：类型分布按基金 `type` 动态统计（优先来自 `FundBasicInfo.type`，为空时可手动维护）；新增基金支持编辑/删除；行业字段可维护并驱动行业分布。
- 页面迁移：`alerts.html` 已改为 Vue 入口（`src/pages/alerts.vue`），去除原内联脚本，构建通过。
- 页面迁移：`chat.html` 已改为 Vue 入口（`src/pages/chat.vue`），去除原内联脚本，构建通过。
- 页面迁移：`reports.html` 已改为 Vue 入口（`src/pages/reports.vue`），去除原内联脚本，构建通过。
- 页面迁移：`index.html` 已改为 Vue 入口（`src/pages/index.vue`），去除原内联脚本，构建通过。
- 页面迁移：`analysis.html` 已改为 Vue 入口（`src/pages/analysis.vue`），去除原内联脚本，构建通过。
- 状态管理：Pinia store 覆盖 dashboard/alerts/chat/reports/analysis。
- 状态管理：alerts 页使用 Pinia store（`src/stores/useAlertsStore.js`）管理提醒列表。

## 功能

- 仪表盘：资产/收益概览，持仓列表，资产配置、行业分布、收益趋势图。
- 分析页：业绩/收益/风险/对比图表，标签切换。
- 提醒页：提醒列表、筛选排序、历史记录，新增/切换/删除提醒。
- 聊天页：预置问答与打字动画，清空对话。
- 报告页：周期切换、收益/持仓变化图，报告生成占位。

## 技术栈

- Vite（多页）
- Vue 3 + Pinia
- Tailwind CSS
- ECharts
- Anime.js

## 快速开始

```bash
npm install
npm run dev       # 开发预览（http://localhost:5173/）
npm run build     # 生产构建
npm run preview   # 预览 dist
```

## 工具链（质量保障）

- 代码风格：`npm run format` / `npm run format:check`（Prettier）
- 静态检查：`npm run lint`（ESLint + Vue SFC）
- 一键检查：`npm run check`（format:check + lint + smoke）
- 冒烟验证：`npm run smoke`（构建 + `dist` 资源引用检查）
- CI：GitHub Actions 在 push/PR 自动运行 `npm run check`

## 进度日志

- 详细变更记录请见 `progress.md`。
- 2025-11-29：完成 index/analysis/alerts/chat/reports 全部页面 Vue 化与 Pinia store 覆盖，构建/预览通过。
- 2025-11-29：补齐空态/错误态、图表切换重绘，并为 dashboard/alerts 增加 localStorage 持久化。
- 2025-12-12：首页收益趋势区间切换与序列对齐（末值对齐累计收益），饼图标签展示比例优化。
- 2025-12-13：新增 `apiAdapters` 与 DataService 扩展，Analysis/Reports store 已通过 DataService 获取契约数据，便于未来接入真实 API。
- 2025-12-13：首页基金详情弹窗支持一键“设置提醒/深度分析”（带 fundCode 预填）。
- 2025-12-13：首页刷新不重置持仓：刷新按钮仅模拟行情变化，不覆盖 localStorage 中的用户新增基金。
- 2025-12-13：修复 build 期静态资源路径（hero 背景图纳入 Vite 资产管线），dist 预览与生产部署一致。
- 2025-12-13：内部契约升级 v1.1，新增 `FundQuote/NavHistory`；DataService/MockAdapter 补齐行情接口占位（为真实行情接入做准备）。
- 2025-12-13：Dashboard 持仓/行情解耦闭环：localStorage 仅存持仓，Quote/NavHistory 通过 DataService 拉取并合并，首页收益趋势区间切换由 store 驱动。
- 2025-12-13：跨页基金联动：alerts/analysis 的基金列表自动合并 dashboard 持仓，首页跳转预填支持用户新增基金。
- 2025-12-13：持久化补齐：chat 对话与 reports 的周期/日期选择 localStorage 保留，刷新不丢。
- 2025-12-13：ECharts 性能优化：按需引入（core/charts/components）并拆分 vendor（echarts/vue/pinia/anime），构建告警消除。
- 2025-12-13：首页一致性优化：类型分布与持仓类型一致；`type` 优先来自 `FundBasicInfo.type`（API/基础信息），仅当返回为空时才手动维护；行业/风格标签（蓝筹/中小盘/港股等）来自 `Holding.industry` 并驱动行业分布。

## 目录结构

- `index.html` / `analysis.html` / `alerts.html` / `chat.html` / `reports.html` - 多页入口
- `src/pages/` - 各页面脚本入口（index.js、analysis.js、alerts.js、chat.js、reports.js）
- `src/services/` - 数据服务与请求封装（dataService.js、mockData.js、request.js）
- `src/apiAdapters/` - 数据适配器层（mock/第三方/后端可切换）
- `src/assets/` - 静态资产（走 Vite 资产管线，如 hero 背景图）
- `src/composables/` - 通用 composable（useDataService 等）
- `src/stores/` - Pinia stores（dashboard/alerts/chat/reports/analysis）
- `src/utils/logger.js` - 轻量日志工具
- `src/contracts/types.js` - JSDoc 版内部契约类型定义（供 IDE/后续 Adapter 引用）
- `src/pages/vue-demo.vue` - Vue + Pinia + DataService 验证页面（展示总资产/今日收益，支持刷新调用 DataService）
- `src/pages/alerts.vue` / `src/pages/alerts.js` - Vue 版本提醒页面
  - `src/stores/useAlertsStore.js` - 提醒状态管理
- `src/pages/chat.vue` / `src/pages/chat.js` - Vue 版本聊天页面
  - `src/stores/useChatStore.js` - 聊天状态管理
- `src/pages/reports.vue` / `src/pages/reports.js` - Vue 版本报告页面
  - `src/stores/useReportsStore.js` - 报告周期与指标状态管理
- `src/pages/index.vue` / `src/pages/index.js` - Vue 版本首页
- `src/pages/analysis.vue` / `src/pages/analysis.js` - Vue 版本分析页面
  - `src/stores/useAnalysisStore.js` - 分析页标签/指标状态管理
- `requirements.md` - 环境与依赖说明
- `contracts.md` - 内部数据契约（字段/类型/单位/错误码）
- `progress.md` - 进度记录
- `resources/` - 静态资源（Tailwind 构建产物等）
- `tailwind.input.css` / `tailwind.config.js` / `postcss.config.js` - 样式构建配置
- `vite.config.js` - Vite 配置（多入口与相对路径）

## 备注

- 构建时可能有 chunk 体积提示，属正常；如需进一步优化可按需拆包或懒加载图表模块。
- 项目使用 ESM（package.json 设置 `type: module`），Vite 配置/插件以 ESM 方式加载。
