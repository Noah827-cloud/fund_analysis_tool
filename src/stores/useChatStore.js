import { defineStore } from 'pinia';
import { chatComplete } from '../services/dataService.js';

const STORAGE_KEY = 'chat:user:default:v1';
const MAX_MESSAGES = 200;

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function defaultMessages() {
  return [
    {
      id: 1,
      sender: 'ai',
      text: `您好！我是您的智能投资助手，很高兴为您服务。
我可以帮您：
• 分析您的基金持仓情况
• 提供个性化的投资建议
• 解读市场动态和趋势
• 评估投资风险等级
• 推荐合适的基金产品`,
    },
  ];
}

function normalizeMessages(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : null;
  if (!Array.isArray(list)) return [];

  return list
    .map((m, idx) => {
      const sender = m?.sender === 'user' ? 'user' : 'ai';
      const text = String(m?.text || '').trim();
      const id = Number(m?.id) || idx + 1;
      return { id, sender, text };
    })
    .filter((m) => m.text);
}

function loadLocal() {
  if (typeof localStorage === 'undefined') return null;
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  const messages = normalizeMessages(parsed);
  return messages.length ? messages : null;
}

function saveLocal(messages) {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, messages: trimmed }));
  } catch (e) {
    console.error('saveLocal chat failed', e);
  }
}

const aiResponses = {
  分析我的持仓: `根据您的持仓情况，我为您分析如下：

🎯 **持仓概览**
• 总资产：¥258,750
• 总收益：¥15,850 (6.53%)
• 持有基金：5只

📊 **配置分析**
• 股票型基金：65% (偏高)
• 债券型基金：25% (适中)
• 货币型基金：10% (偏低)

⚠️ **风险提示**
股票型基金占比较高，建议适当增加债券基金配置以平衡风险。

💡 **优化建议**
1. 考虑增加10-15%的债券基金
2. 港股基金占比较高，注意汇率风险
3. 新能源基金表现良好，可继续持有`,
  市场趋势如何: `📈 **市场趋势分析**

🌟 **整体市场**
• A股市场：震荡向上，结构性机会明显
• 港股市场：估值修复中，关注政策变化
• 美股市场：高位震荡，注意回调风险

🏭 **板块机会**
• 新能源：政策支持，长期看好
• 科技板块：创新驱动，精选个股
• 消费板块：复苏确定，估值合理
• 医药板块：创新药机会，关注集采政策

💰 **投资策略**
建议采用定投策略，分散投资风险，关注优质基金的长期表现。`,
  推荐优质基金: `🏆 **优质基金推荐**

📊 **股票型基金**
• 易方达蓝筹精选混合 (005827)
  - 近1年收益：+18.45%
  - 基金经理经验丰富
  - 适合长期持有

• 华夏能源革新股票A (003834)
  - 近1年收益：+22.31%
  - 新能源主题，政策受益
  - 波动较大，注意风险

📈 **指数型基金**
• 华夏恒生ETF联接A (001071)
  - 港股投资，估值较低
  - 分散化投资工具
  - 适合定投

💎 **债券型基金**
• 易方达安心回报债券A (110027)
  - 稳健收益，波动较小
  - 适合风险厌恶型投资者
  - 可作为资产配置的稳定器

⚠️ **投资提醒**
基金投资有风险，建议根据个人风险承受能力选择合适的产品。`,
  风险评估: `🔍 **投资风险评估**

📊 **您的风险等级：R3 (中等风险)**

📈 **当前组合分析**
• 年化波动率：18.56%
• 最大回撤：-8.45%
• 夏普比率：1.25

⚠️ **主要风险点**
1. 股票型基金占比较高(65%)
2. 港股基金受汇率影响
3. 行业集中度偏高

🛡️ **风险控制建议**
1. 增加债券基金配置至35%
2. 分散投资不同市场
3. 设置止损线(建议-10%)
4. 定期调整资产配置

📅 **风险管理策略**
• 每月审视投资组合
• 季度调整资产配置
• 年度重新评估风险承受能力`,
  止盈建议: `💰 **止盈策略建议**

🎯 **目标收益法**
• 建议止盈线：+15%
• 当前最高收益基金：+6.95%
• 距离止盈线还有空间

📈 **分批止盈法**
建议当基金收益达到以下水平时：
• 收益+10%：止盈20%
• 收益+15%：止盈30%
• 收益+20%：止盈50%

⏰ **时间止盈法**
• 持有时间超过2年且收益为正
• 市场环境发生重大变化
• 基金基本面恶化

🔔 **当前建议**
1. 招商中证白酒指数A：收益6.95%，可继续持有
2. 易方达蓝筹精选混合：收益4.90%，观察市场
3. 华夏能源革新股票A：收益4.73%，关注政策

⚠️ **止盈提醒**
止盈不止损，建议设置自动提醒功能。`,
};

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: loadLocal() || defaultMessages(),
    typing: false,
  }),
  actions: {
    addMessage(text, sender) {
      this.messages.push({ id: Date.now(), sender, text });
      saveLocal(this.messages);
    },
    async sendUserMessage(text) {
      if (!text) return;
      this.addMessage(text, 'user');
      this.typing = true;
      const minDelay = 800 + Math.random() * 600;
      const startedAt = Date.now();
      try {
        const reply = await chatComplete({ message: text, history: this.messages });
        const elapsed = Date.now() - startedAt;
        if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed));
        const fallback = this.getAIResponse(text);
        const content = String(reply?.text || '').trim() || fallback;
        this.addMessage(content, 'ai');
      } catch (e) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < minDelay) await new Promise((r) => setTimeout(r, minDelay - elapsed));
        this.addMessage(this.getAIResponse(text), 'ai');
        console.error('chat:complete failed', e);
      } finally {
        this.typing = false;
      }
    },
    clearChat() {
      this.messages = [
        {
          id: Date.now(),
          sender: 'ai',
          text: `对话已清空，让我们重新开始吧！
有什么投资问题想要咨询吗？`,
        },
      ];
      saveLocal(this.messages);
    },
    getAIResponse(text) {
      if (text.includes('持仓') || text.includes('分析')) return aiResponses['分析我的持仓'];
      if (text.includes('市场') || text.includes('趋势')) return aiResponses['市场趋势如何'];
      if (text.includes('推荐') || text.includes('基金')) return aiResponses['推荐优质基金'];
      if (text.includes('风险') || text.includes('评估')) return aiResponses['风险评估'];
      if (text.includes('止盈') || text.includes('卖出')) return aiResponses['止盈建议'];
      return `我理解您的问题，让我为您分析一下：

🤖 **AI分析中**

我正在分析您的投资组合和市场数据，基于最新的市场信息和您的持仓情况，为您提供个性化的投资建议。

💡 **建议**
您可以尝试以下问题：
• "分析我的持仓情况"
• "当前市场趋势如何"
• "有什么好的基金推荐"
• "我的投资风险如何"
• "什么时候应该止盈"`;
    },
  },
});
