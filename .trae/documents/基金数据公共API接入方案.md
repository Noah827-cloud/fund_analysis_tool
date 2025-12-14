# 基金数据公共API接入方案（更新版）

## 1. 方案概述
基于项目现有架构，设计一个可切换、可扩展的基金数据API接入方案，支持从多个免费公共API获取真实基金数据，并与现有模拟数据无缝切换。

## 2. 选择的公共API

### 2.1 主要选择：天天基金网API（非官方但稳定）
- **优势**：免费无限制，数据全面，包含中国基金的基本信息、净值、涨跌幅等
- **数据类型**：基金基本信息、实时净值、历史净值、基金持仓、基金经理等
- **注意事项**：非官方API，需做好异常处理和备用方案

### 2.2 备选方案
- **聚合数据基金API**：免费额度有限，适合小流量场景
- **雪球数据API**：免费额度，支持中国股市和基金数据
- **Alpha Vantage**：免费额度，支持全球市场数据

## 3. 架构设计

### 3.1 现有架构扩展
- **数据服务层**：扩展 `dataService.js`，添加基金数据相关方法
- **API适配器层**：新增 `apiAdapters/` 目录，支持多种API适配器
- **配置管理**：新增 `config/` 目录，支持配置API类型、参数等
- **数据转换层**：实现不同API返回数据到现有模型的转换
- **工厂模式**：基于配置切换Mock/不同API实现

### 3.2 核心模块
```
src/
├── services/
│   ├── dataService.js       # 现有数据服务，扩展基金数据方法
│   ├── mockData.js          # 现有模拟数据，保持兼容
│   └── request.js           # 现有请求封装，复用
├── apiAdapters/
│   ├── baseAdapter.js       # 基础适配器抽象类
│   ├── tianTianFundAdapter.js # 天天基金网API适配器
│   ├── juheFundAdapter.js   # 聚合数据API适配器
│   └── mockAdapter.js       # 模拟数据适配器
├── config/
│   ├── apiConfig.js         # API配置管理
│   └── appConfig.js         # 应用配置
└── utils/
    └── dataTransformer.js   # 数据转换工具
```

## 4. 实现细节

### 4.1 API配置管理
- 支持配置API类型、参数、超时时间等
- 支持环境变量配置，便于不同环境切换
- 支持API健康检查，自动切换到可用API

### 4.2 适配器设计
```javascript
// 基础适配器类
class BaseFundAdapter {
  async getFundBasicInfo(fundCode, options = {}) {}
  async getFundNav(fundCode, options = {}) {}
  async getFundHistoryNav(fundCode, { startDate, endDate } = {}) {}
  async getFundsData(fundCodes, options = {}) {}
}

// 天天基金网适配器
class TianTianFundAdapter extends BaseFundAdapter {
  // 实现具体方法
}
```

### 4.3 基金数据方法设计
```javascript
// 获取基金基本信息
export async function getFundBasicInfo(fundCode, options = {}) {}

// 获取基金净值
export async function getFundNav(fundCode, options = {}) {}

// 获取基金历史净值
export async function getFundHistoryNav(fundCode, { startDate, endDate } = {}) {}

// 批量获取基金数据
export async function getFundsData(fundCodes, options = {}) {}

// 获取基金持仓
export async function getFundHoldings(fundCode, options = {}) {}
```

### 4.4 数据转换
- 将不同API返回的原始数据转换为统一的内部模型格式
- 确保与现有模拟数据结构完全兼容
- 处理数据缺失、异常值等情况

### 4.5 缓存策略优化
- 对基金基本信息设置较长缓存时间（如24小时）
- 对基金净值设置较短缓存时间（如5分钟）
- 批量请求优化，减少API调用次数
- 支持缓存刷新机制

### 4.6 错误处理与降级策略
- 实现API调用错误捕获和分类
- 提供友好的错误提示
- 支持重试机制，提高可靠性
- 当API不可用时，自动降级到模拟数据

## 5. 集成计划

### 5.1 阶段一：API适配器实现
- 实现基础适配器抽象类
- 实现天天基金网API适配器
- 实现模拟数据适配器
- 完成API配置管理

### 5.2 阶段二：数据服务扩展
- 扩展dataService.js，添加基金数据方法
- 实现工厂模式，支持切换不同适配器
- 实现数据转换工具
- 确保与现有功能兼容

### 5.3 阶段三：页面集成
- 更新首页仪表盘，支持真实基金数据
- 更新分析页，支持按基金获取分析数据
- 更新报告页，支持按周期获取数据
- 测试不同API切换效果

### 5.4 阶段四：优化与测试
- 优化缓存策略，减少API调用次数
- 测试API错误处理和降级机制
- 测试不同基金代码的数据获取
- 优化页面加载性能

## 6. 预期效果
- 支持从多个免费公共API获取真实基金数据
- 与现有模拟数据无缝切换
- 保持现有功能不变
- 提高数据的真实性和准确性
- 支持API不可用时自动降级到模拟数据
- 便于后续扩展支持更多API

## 7. 技术要点
- 遵循现有代码风格和架构
- 实现松耦合设计，便于后续更换API
- 注重性能和可靠性，减少API调用次数
- 提供完善的错误处理和降级机制
- 支持配置化管理，便于部署和维护