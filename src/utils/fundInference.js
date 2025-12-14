// @ts-check

function includesAny(text, keywords) {
  const source = String(text || '');
  return (keywords || []).some((k) => k && source.includes(k));
}

/**
 * 基于基金名称做“类型”推断（仅用于 API 未返回时的默认填充）
 * @param {string} name
 * @returns {string}
 */
export function inferFundTypeLabel(name) {
  const label = String(name || '');
  if (!label) return '';

  if (label.includes('QDII')) return 'QDII';
  if (label.includes('货币')) return '货币型';
  if (label.includes('债券')) return '债券型';
  if (includesAny(label, ['指数', 'ETF', '联接'])) return '指数型';
  if (label.includes('股票')) return '股票型';
  if (label.includes('混合')) return '混合型';

  return '';
}

/**
 * 基于名称/类型做“行业/风格/主题”推断（仅用于 API 未返回时的默认填充）
 * @param {{ name?: string, type?: string }} params
 * @returns {string}
 */
export function inferIndustryLabel(params) {
  const name = String(params?.name || '');
  const type = String(params?.type || '');

  if (includesAny(type, ['QDII']) || includesAny(name, ['恒生', '港股', 'H股', '香港', 'HK'])) return '港股';
  if (includesAny(name, ['蓝筹'])) return '蓝筹股';
  if (includesAny(name, ['中小盘', '小盘'])) return '中小盘';

  if (includesAny(name, ['电池'])) return '电池';
  if (includesAny(name, ['半导体', '芯片'])) return '半导体';
  if (includesAny(name, ['人工智能', 'AI', '大模型'])) return '人工智能';

  if (includesAny(name, ['白酒'])) return '白酒';
  if (includesAny(name, ['新能源'])) return '新能源';
  if (includesAny(name, ['医药'])) return '医药';
  if (includesAny(name, ['消费'])) return '消费';
  if (includesAny(name, ['科技'])) return '科技';
  if (includesAny(name, ['互联网'])) return '互联网';
  if (includesAny(name, ['传媒'])) return '传媒';
  if (includesAny(name, ['军工'])) return '军工';
  if (includesAny(name, ['黄金'])) return '黄金';
  if (includesAny(name, ['红利'])) return '红利';

  return '';
}
