# 项目运行与依赖要求

## 环境

- Node.js >= 18（建议使用当前本地版本）
- npm（已使用 npm 管理依赖）

## 依赖（核心）

- 前端框架：Vite（多页）、Vue 3、Pinia（状态管理）
- 样式与动画：Tailwind CSS、Anime.js
- 图表：ECharts

## 可选：本机后端（真实行情代理 + SQLite）

- 后端框架：Fastify（含 CORS）
- SQLite：`sql.js`（WASM 版 SQLite，避免 Node v22 下 native sqlite 编译风险）

## 构建与启动

- 安装依赖：`npm install`
- 开发预览：`npm run dev`
- 开发预览（前后端一起启动）：`VITE_FUND_ADAPTER=api npm run dev:full`
- 仅启动本机 API：`npm run dev:api`（默认 `http://127.0.0.1:8787`）
- 生产构建：`npm run build`
- 构建预览：`npm run preview`
- 启动本机 API（非 watch）：`npm run start:api`
- 重建样式（Tailwind）：`npm run css`
- 代码风格：`npm run format` / `npm run format:check`
- 代码检查：`npm run lint`
- 冒烟验证：`npm run smoke`（构建 + dist 资源引用检查）
- 一键检查：`npm run check`（format:check + lint + smoke）
- 说明：项目已设置 `package.json` `"type": "module"`，Vite 配置与插件按 ESM 模式运行。
- alerts：已 Vue 化（入口 alerts.html，对应 `src/pages/alerts.js` / `src/pages/alerts.vue`）
- chat：已 Vue 化（入口 chat.html，对应 `src/pages/chat.js` / `src/pages/chat.vue`）
- reports：已 Vue 化（入口 reports.html，对应 `src/pages/reports.js` / `src/pages/reports.vue`）
- index：已 Vue 化（入口 index.html，对应 `src/pages/index.js` / `src/pages/index.vue`）
- analysis：已 Vue 化（入口 analysis.html，对应 `src/pages/analysis.js` / `src/pages/analysis.vue`）
- alerts 使用 Pinia store：`src/stores/useAlertsStore.js`
- chat 使用 Pinia store：`src/stores/useChatStore.js`
- reports 使用 Pinia store：`src/stores/useReportsStore.js`
- analysis 使用 Pinia store：`src/stores/useAnalysisStore.js`

## 工具链（质量保障）

- ESLint：`eslint.config.js`（Vue SFC 支持、忽略 dist 等产物）
- Prettier：`.prettierrc.json` / `.prettierignore`
- 冒烟脚本：`scripts/smoke.mjs`（校验 dist 页面与 assets 引用一致）
- CI：`.github/workflows/ci.yml`（push/PR 自动运行 `npm run check`）

## 迁移与扩展计划（简要）

- 渐进式将各页面迁移为 Vue 组件，复用现有 ECharts/Anime 逻辑。
- 数据访问层抽象为 composable（useDataService/useAuth/useAlerts 等），与后端 API 契约一致；已添加 useDataService 基础文件。
- 引入 Pinia 管理基金池、预警、用户态等全局状态；已添加 useDashboardStore 基础文件。
- Logger：新增轻量 logger（时间戳/级别），用于 request/dataService 与页面排错。
- Vue Demo：新增 vue-demo.vue 作为 Pinia + DataService 验证页。
