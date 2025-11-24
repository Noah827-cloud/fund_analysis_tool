# 实施计划（更新版）

## 架构现状
- 前端：纯静态页面 + 本地化依赖（Tailwind/ECharts/Anime），已接入 Vite 构建，但脚本仍集中在 HTML/单 JS。
- 数据：全模拟数据，未有统一数据访问层；无鉴权、无后端。
- 工程：无 lint/test/CI，目录未模块化。

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
1) 定义类型与 API 契约；实现 request 封装 + DataService/Mock；页面接入 DataService 替换硬编码数据。
2) 前端模块化（src 结构）并跑通 Vite 构建；图表容错/加载态完善。
3) 持仓/提醒本地持久化、工厂切换 Mock/真实；按需懒加载图表。
4) 启动后端：框架+ORM+迁移，Auth 中间件，核心 CRUD API；前后端联调。
5) 质量与部署：lint/test/CI，监控/日志/限流，HTTPS/证书与部署脚本。
