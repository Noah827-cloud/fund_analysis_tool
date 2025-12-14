# 实施计划（更新版）

## 当前状态（2025-12-13）
### 已完成
- 多页应用：Vite 多入口构建（`index/analysis/alerts/chat/reports/vue-demo`），`dev/build/preview` 可用。
- 组件化：Vue 3 + Pinia 已覆盖全部页面，页面脚本位于 `src/pages/`，移除原内联脚本。
- 数据层：新增 `src/services/dataService.js`（缓存/延迟/日志），并引入 `src/apiAdapters/`（MockAdapter + 工厂），Analysis/Reports/Dashboard 已走同一数据管线。
- 契约：新增 `contracts.md` 与 `src/contracts/types.js`，明确内部字段/单位/错误码，便于 mock/真实接口切换。
- 体验：空态/错误态/图表重绘问题已处理；图表 tooltip/百分比格式已标准化；指标与曲线/序列已对齐。
- 持久化：Dashboard/Alerts 已用 localStorage 持久化；首页刷新不会覆盖本地新增基金；并支持从首页基金详情一键跳转预填 alerts/analysis。
- Dashboard 解耦：localStorage 仅保存用户持仓（份额/成本），行情与收益趋势由 DataService 拉取 `FundQuote/NavHistory` 后合并生成视图数据。
- 跨页联动：Alerts/Analysis 的基金下拉自动合并 Dashboard 持仓，新添加基金可直接“设置提醒/深度分析”并正确预填。
- 构建一致性：背景图等静态资源已纳入 Vite 资产管线，dist 预览与生产部署一致。
- 工具链：已增加 ESLint/Prettier + 冒烟验证（build + dist 资源引用检查）+ CI（push/PR 自动跑 `npm run check`）。
- 持久化补齐：Chat 对话、Reports 周期/日期选择已用 localStorage 保留，刷新不丢。
- 性能优化：ECharts 改为按需引入（core/charts/components）并通过 manualChunks 拆分 vendor（`vendor-echarts/vue/pinia/anime`），构建不再输出大体积告警。
- Dashboard 一致性：类型分布按基金 `type` 统计；`type` 优先来自 `FundBasicInfo.type`（API/基础信息），仅当返回为空时才在新增/编辑里手动维护（提供 datalist 建议，支持自定义）；行业/风格标签仍来自 `Holding.industry`（可维护/可推断）并驱动行业分布。
- 首页添加基金：支持仅输入基金代码自动识别名称，并基于名称推断默认类型/行业（API 未返回时兜底）；买入价输入支持小数点。
- 行情 Quote 对齐：`getFundQuote` 使用 `pingzhongdata` 的最新净值作为官方净值并输出 `navDate`，可选补充 fundgz 的估算净值，避免“净值与实际”偏差。
- 行情 BasicInfo 升级：后端接入 F10 基本概况，`getFundBasicInfo` 可返回 `type/company/inceptionDate/riskLevel/tags`，用于自动回填并减少手工维护。
- 行业/主题自动化（阶段一）：后端接入 F10 行业配置（HYPZ），新增 `/api/market/industryConfig/:fundCode`；该数据是“持仓行业配置（如 制造业/金融业…）”用于分析/展示，不直接覆盖 `Holding.industry`（主题/风格标签）；主题/风格仍优先用名称推断/用户维护（未来若 API 能提供主题字段再自动回填）。
- Analysis 真实化（阶段一）：本机 API 的 `/api/analysis` 基于 `NavHistory` 计算业绩表现/回撤/夏普/月度收益序列，分析页核心曲线不再依赖 mock。
- Analysis 深度分析增强（阶段二）：后端新增 F10 重仓股票接口 `/api/market/topHoldings/:fundCode`；`/api/analysis` 增加年化波动率、最大回撤修复天数、同类排名/百分位；前端 Analysis 页新增“重仓股票”表格与“风险概览”展示。
- Analysis 持仓/对比增强（阶段三）：新增季报资产配置 `/api/market/assetAllocation/:fundCode`、较上季 Top10 变动 `/api/market/topHoldingsCompare/:fundCode`、同类平均/基准指数对比序列 `/api/market/grandTotal/:fundCode`；前端补齐资产配置/行业分布/对比分析展示与说明。
- Tailwind 产物同步：页面样式使用本地预构建 `resources/tailwind.min.css`，新增 Tailwind class（如 `h-72/h-96`）后需同步更新 CSS；建议统一使用已存在的 class，或将 `npm run css` 纳入开发/构建流程。

### 仍待完善（已知缺口）
- Chat 目前为 mock AI 回复，已接入 DataService/Adapter（同形接口）；后续接真实 LLM/后端代理只需替换 adapter 实现。
- 性能进一步优化：`vendor-echarts` 仍约 540k（已拆分并不再告警）；若要继续降体积，可考虑按页面懒加载图表或更深度定制。

## 目标
- 保持 MVP 可用，逐步完成模块化前端、可切换的 DataService、后端与用户体系规划，方便后续功能升级。

## 前端计划（Vite 方向）
- 目录重构：建立 `src/`，拆分模块 `services/`、`charts/`、`ui/`、`pages/`，入口由 Vite 构建输出到 `dist`。
- 资源本地化：所有脚本/样式走构建产物（已本地化的 Tailwind/ECharts/Anime 继续用 npm 版本）。
- 状态与容错：图表加载/空数据/错误态占位，隐藏容器重绘与 resize 处理；请求层的错误提示与重试。
- 性能：按需代码分割、懒加载图表模块，减少首屏体积。

## 数据服务抽象
- 定义契约与类型：Fund/FundQuote/Holding/Alert/Report/Envelope(code,message,data)，统一分页/过滤参数。
- 封装 request：超时、重试/退避、错误分类（网络/鉴权/业务）、TTL 缓存、请求去重；可选 localStorage 缓存。
- Mock 与真实同形：工厂方法基于配置切换 Mock/Api 实现，接口签名一致。
- 持久化：本地先行存储持仓/提醒，按用户隔离，预留版本号与清理策略。

## 后端规划（需启动设计）
- API 契约先行：标准响应、错误码、分页/过滤/批量约定。
- 核心模块：Auth/鉴权、PortfolioService、AlertService、ReportService、MarketService。
- 数据模型：User/Tenant、Holding、Alert(含状态机与历史)、Report、FundSnapshot/Quote；字段包含 owner/tenant。
- 鉴权与安全：登录/刷新、token 注入、权限 scope 控制、限流/防刷；前端支持 401 自动刷新或登出。
- 存储建议：主库 PostgreSQL/MySQL，行情走外部源+缓存(Redis/TSDB)。

## 用户与多租户
- 认证流程：登录/刷新/登出，安全存储（优先 HttpOnly Cookie + CSRF；如本地存储需加密/过期）。
- 权限模型：角色/资源/动作，前端路由/按钮基于权限控制。
- 缓存隔离：user/tenant 维度缓存与清理，切换账号清空。
- 审计：提醒设置、持仓导入/导出、报告生成等操作记录用户/时间/动作。

## 路线图
### M0（已完成）：Vue+Pinia 多页迁移 + DataService/Adapter 基座
- 说明：详见 `README.md` 与 `progress.md`。

### M1（下一步建议优先）：行情契约 v1.1 + Dashboard 数据解耦（1-2 周）
- [x] 扩展内部契约（contracts/types）：新增 `FundQuote`、`NavHistory`，明确缺失字段与降级策略
- [x] 扩展 Adapter 方法（保持 Mock/真实同形）：MockAdapter 实现 `getFundQuote/getFundNavHistory/getFundBasicInfo`
- [x] 扩展 DataService 方法：新增 `getFundQuote/getFundNavHistory/getFundBasicInfo`，并落地 TTL 策略 + 错误码封装
- [x] Dashboard 重构为“持仓+行情”两层：Pinia 保存用户持仓；行情由 DataService 拉取并合并；收益趋势基于 `NavHistory`（30/90/1y）
- [x] 提醒联动完善：从首页/持仓详情一键创建提醒（预填 fundCode/fundName，提醒页可识别并补齐下拉选项）
- [x] 文档同步：`progress.md` 时间戳记录，`README.md` 更新当前能力

### M1.5（新增需求-规划中）：加减仓/换仓（交易流水）（1-2 周）
- 目标：在首页持仓列表支持日常操作（加仓/减仓/换仓），并引入“交易流水”作为可回放的真实状态来源，便于未来对接后端/多用户。
- 操作类型：
  - 加仓：买入份额（输入买入份额 + 下单时间）
  - 减仓：卖出份额（输入卖出份额 + 下单时间）
  - 换仓：转出基金 + 转入基金（输入转出/转入基金与份额 + 下单时间）
- 成交规则（基金 T+1 / T+2 简化）：
  - 当天 15:00 前下单：按“下一个工作日”净值成交
  - 当天 15:00 后下单：按“下下个工作日”净值成交
  - 工作日判断：先最小实现仅跳过周末；后续可接入交易日历（节假日）或由后端统一计算
- 数据模型（本地优先，后端可迁移）：
  - 新增 `Transaction/Order`：`id/type/fromFund/toFund/shares/orderAt/navDate/status/remark`（手续费/申赎限制后续扩展）
  - holdings 从“初始快照 + 交易流水”计算（或流水+定期快照），保证可审计/可回放
  - localStorage 先落地（独立 key + version），未来通过 Adapter 切换到 SQLite/后端接口
- UI 设计（首页优先）：
  - 持仓详情弹窗新增“加仓/减仓/换仓”入口
  - 交易弹窗：选择基金/转入基金、份额、下单时间；自动提示“预计成交净值日”
  - 交易记录列表（最近 N 条）：支持筛选/撤销（未成交）/删除（仅本地）
- 计算逻辑（与 DataService 对齐）：
  - 成交日净值优先从 `getFundNavHistory` 取点；无数据则提示“等待行情数据/请手填成交净值”
  - 成本价：买入按加权平均更新；卖出减少份额并可记录已实现收益（可选）

### M2（可并行/按需启动）：本机后端 + SQLite（2-3 周）
- 目标：解决 CORS、实现真实行情代理缓存、落地多用户/数据持久化。
- 最小闭环（本机可跑、可切换、可持久化）：
  - [x] 后端：`server/index.js`（Fastify + CORS）
  - [x] SQLite：`server/sqlite.js`（sql.js + `server/data.sqlite` 单文件持久化）
  - [x] 行情代理：`server/eastmoney.js`（Eastmoney `pingzhongdata`/`fundgz` → `FundBasicInfo/FundQuote/NavHistory`）
  - [x] Alerts CRUD：`GET/POST/PATCH/DELETE /api/alerts`（SQLite 持久化）
  - [x] 前端 ApiAdapter：`src/apiAdapters/apiAdapter.js`（`VITE_FUND_ADAPTER=api` 一键切换）
  - [x] Vite 代理：`vite.config.js` 增加 `/api -> http://127.0.0.1:8787`（dev/preview）
  - [ ] 组合入库：把 holdings 从 localStorage 迁移到 SQLite（并提供 localStorage→SQLite 迁移与回退）
  - [ ] 多用户隔离：User/Tenant 字段与鉴权（最小可先本机密码/Token）
  - [ ] 报告/分析后端化：当前后端仍复用 MockAdapter 输出（确保 api 模式全站可跑），后续逐步替换为真实计算/接口
  - [ ] API schema：补充接口文档与错误码映射（与 `contracts.md` 对齐）

### M3：质量与性能（持续迭代）
- 工具链：lint/format、基础单测（formatter/transformer）、冒烟脚本（build+preview+页面可访问）
- 性能：manualChunks + 稳定的动态 import（优先解决大 chunk 告警且不影响分析/报告图表渲染）

## 框架升级评估（纯 HTML/JS vs Vue/React）
- 未来需求（基金池管理、实时行情、预警、LLM、多人账户）超出纯 HTML+JS 维护能力，易产生状态混乱、代码不可维护。
- 推荐尽早迁移到 Vue 3 + Vite + Pinia（或 React + 状态库），保留现有样式/ECharts/Anime 逻辑，组件化和状态管理更可控。

### 迁移路线（增量）
1) 搭建 Vue 3 + Vite + Tailwind 基座，接入 Pinia 状态管理。
2) 将页面拆成 SFC 组件（Dashboard/Analysis/Alerts/Chat/Reports），复用现有 ECharts/Anime 代码。
3) 抽象 composable：useDataService/useAuth/useAlerts/useReports 等，封装请求、缓存、错误处理；与后端 API 契约保持一致。
4) 引入组件库（Element Plus/Naive UI）支持表格、表单、抽屉、对话框等高频交互。
5) 接入后端/LLM：拦截器（token/401 刷新）、请求队列/轮询或 WebSocket；预警规则与基金池状态入 Pinia，并持久化。
6) 渐进替换：先迁移复杂页（alerts/reports/chat），低复杂度页可保留过渡；完善路由/权限守卫/错误边界。

### 近期可执行步骤（含日志/排错)
- 日志与排错：新增轻量 logger（时间戳/level/源），DataService/request 统一调用，页面入口与图表 init 捕获错误并显示友好提示+console.error。
- Vue 验证页：先在 Vue 基座做一个 demo/或迁移 alerts 页，验证 Pinia + composable + ECharts/Anime 在 SFC 中正常工作。
- Store 拆分：按页面创建 Pinia stores（dashboard/alerts/chat/reports），先用 mock 数据跑通，保持与未来后端接口一致。
- 迁移顺序：优先迁移交互复杂的 alerts/reports/chat，再迁 analysis，最后迁 index；每迁完一页做回归（加载/刷新/交互/空态/错误态/图表）。

### 后端与数据库介入时机
- 时点：一旦需要真实行情、多用户、提醒落地或持久化数据，就并行启动后端，不要等前端全量迁完。
- 契约优先：先定 API 契约与数据模型（User/Tenant、Holding、Alert+历史、Report、FundSnapshot/Quote），前后端共享。
- 落地顺序：模型/迁移 → Auth/权限/限流 → 核心 CRUD（持仓/提醒/报告）→ 行情接入与缓存 → 监控/日志。
- 并行策略：前端保持 Mock 与真实接口同形，后端完成核心后切换，避免双倍改动；提醒与行情可先用轮询，后续替换 WebSocket/任务队列。

### 待解决/规划中的数据联动问题
- Analysis：基金切换不触发数据/图表变化（缺按基金的分析数据源）；需在 store/composable 增加按基金的指标与序列 mock，切换时重绘。
- Reports：周期切换仅更新摘要指标，收益归因/持仓变化图表数据固定；需按周期提供图表数据并重绘。
- 后端契约未知：先定义前端期望的数据 schema（指标/序列/配置），Mock 与未来 API 同形，便于切换真实接口。
- Dashboard 持久化：已使用 localStorage 保存用户持仓（v2 schema），后续接入 SQLite/后端时提供迁移与回退策略。
- 动态 import 备选：为含重依赖的页面（已应用 index/analysis/reports）使用 `import('echarts')` / `import('animejs')` 按需加载；如 alerts/chat 后续引入大体积库，可同样拆分以降低首屏包体。

### 接口契约占位（未接入真实行情前的准备）
- 定义模型与 Envelope：FundQuote/Holding/PortfolioSummary/Alert/Report + `Envelope{code,message,data}`，字段类型、必填、分页/过滤参数、错误码。
- 抽象数据访问层：在 `useDataService/useAlerts/useReports` 等 composable 中统一方法签名（如 getFundQuote/getPortfolio/createAlert/listReports），当前用 Mock 返回同形数据，待真实接口接入只替换实现。
- 配置与安全：预留 `BASE_URL`、API key/token、超时/重试/缓存 TTL、user/tenant 隔离；401 刷新/登出策略提前设计。
- 降级与持久化：无接口时可回退 localStorage/mock，错误态友好提示与 logger 记录，避免空白页。

### 基金数据公共 API 接入（方案摘要）
- 适配器工厂：`apiAdapters/` 统一基类 + tianTian/juhe/mock 等适配器，配置驱动切换，返回统一模型。
- 数据方法：getFundBasicInfo/getFundNav/getFundHistoryNav/getFundsData/getFundHoldings，保持与 mock 一致签名。
- 数据转换：`utils/dataTransformer` 规范字段映射/缺省处理，保障与现有 mock/页面结构兼容（如 API 提供行业/主题/标签字段则映射到 `Holding.industry`，否则沿用用户配置/推断）。
- 缓存策略：基础信息长缓存，净值短缓存，批量请求合并；可配置 TTL/刷新。
- 错误与降级：调用错误分类+重试，API 不可用自动回退 mock；logger 打点。
- 集成路径：阶段一完成适配器与配置，阶段二扩展 dataService，阶段三页面接入（index/analysis/reports），阶段四优化与回归测试。

### 本地持久化与数据库演进
- 近期：前端层使用 localStorage/IndexedDB 做轻量持久化，避免刷新/切页丢失。
- 短期（本机存储）：采用 SQLite 作为本地单文件数据库（零运维、易备份），通过统一数据访问层（ORM/查询构建器）封装，接口不绑定方言。
- 演进路径：
  1) 设计统一存储接口（save/load Portfolio/Alerts/Reports），当前实现 localStorage。
  2) 新增 SQLite 适配器 + 迁移脚本，用同一接口读写本地 DB，并保留回退。
  3) 使用迁移工具（Prisma/Drizzle/Knex）管理 schema，预留 DB_DRIVER/连接串配置，未来切 PostgreSQL/MySQL 只需改配置+跑迁移。
  4) 数据模型带版本号，编写数据导入/校验脚本，支持从 localStorage → SQLite → 服务器数据库的平滑迁移。
  5) 并发/锁注意：SQLite 适合单机低并发，切多用户前先切换到 PostgreSQL/MySQL，并开启连接池/索引/事务配置。
