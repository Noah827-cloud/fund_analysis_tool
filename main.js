// 基金分析工具主要JavaScript逻辑（数据来自服务层）
import { getDashboardData, refreshDashboardData } from './src/services/dataService.js';

let fundData = null;

// 初始化应用
async function initApp() {
  console.log('开始初始化应用...');

  try {
    // 确保DOM完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
      return;
    }

    // 延迟执行以确保所有元素都正确渲染
    setTimeout(async () => {
      await loadDashboard();
      initAnimations();
      setupEventListeners();
      console.log('应用初始化完成');
    }, 100);
  } catch (error) {
    console.error('应用初始化失败:', error);
  }
}

async function loadDashboard(force = false) {
  try {
    fundData = await getDashboardData({ force });
    updateDashboard();
    initCharts();
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    showToast('获取数据失败，请稍后重试');
  }
}

// 更新仪表板数据
function updateDashboard() {
  if (!fundData) return;
  // 更新总资产
  animateNumber('total-assets', fundData.totalAssets);

  // 更新今日收益
  animateNumber('today-profit', fundData.todayProfit);
  const todayProfitElement = document.getElementById('today-profit');
  todayProfitElement.className = fundData.todayProfit >= 0 ? 'text-green-400' : 'text-red-400';

  // 更新总收益
  animateNumber('total-profit', fundData.totalProfit);
  const totalProfitElement = document.getElementById('total-profit');
  totalProfitElement.className = fundData.totalProfit >= 0 ? 'text-green-400' : 'text-red-400';

  // 更新收益率
  document.getElementById('profit-rate').textContent = fundData.profitRate.toFixed(2) + '%';
  const profitRateElement = document.getElementById('profit-rate');
  profitRateElement.className = fundData.profitRate >= 0 ? 'text-green-400' : 'text-red-400';

  // 更新基金列表
  updateFundList();
}

// 数字动画效果
function animateNumber(elementId, targetValue) {
  const element = document.getElementById(elementId);
  const startValue = 0;
  const duration = 2000;
  const startTime = performance.now();

  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 使用缓动函数
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = startValue + (targetValue - startValue) * easeOutQuart;

    element.textContent =
      '¥' +
      currentValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }

  requestAnimationFrame(updateNumber);
}

// 更新基金列表
function updateFundList() {
  if (!fundData) return;
  const fundList = document.getElementById('fund-list');
  fundList.innerHTML = '';

  fundData.funds.forEach((fund, index) => {
    const fundItem = createFundItem(fund, index);
    fundList.appendChild(fundItem);
  });
}

// 创建基金项目
function createFundItem(fund, index) {
  const div = document.createElement('div');
  div.className = 'fund-item bg-gray-800 bg-opacity-50 rounded-lg p-4 hover:bg-opacity-70 transition-all duration-300 cursor-pointer';
  div.onclick = () => showFundDetail(fund);

  div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex-1">
                <h3 class="text-white font-medium text-sm">${fund.name}</h3>
                <p class="text-gray-400 text-xs">${fund.code}</p>
            </div>
            <span class="px-2 py-1 bg-blue-600 text-white text-xs rounded">${fund.type}</span>
        </div>
        <div class="flex justify-between items-center">
            <div>
                <p class="text-white font-semibold">¥${fund.holdValue.toLocaleString()}</p>
                <p class="text-xs ${fund.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
                    ${fund.profit >= 0 ? '+' : ''}${fund.profit.toFixed(2)} (${fund.profitPercent.toFixed(2)}%)
                </p>
            </div>
            <div class="text-right">
                <p class="text-white font-medium">${fund.nav.toFixed(4)}</p>
                <p class="text-xs ${fund.change >= 0 ? 'text-green-400' : 'text-red-400'}">
                    ${fund.change >= 0 ? '+' : ''}${fund.changePercent.toFixed(2)}%
                </p>
            </div>
        </div>
    `;

  return div;
}

// 显示基金详情
function showFundDetail(fund) {
  const modal = document.getElementById('fund-modal');
  const modalContent = document.getElementById('modal-content');

  modalContent.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-xl font-bold text-white">${fund.name}</h2>
                    <p class="text-gray-400">${fund.code} · ${fund.type}</p>
                </div>
                <button onclick="closeModal()" class="text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-800 rounded-lg p-4">
                    <p class="text-gray-400 text-sm">当前净值</p>
                    <p class="text-white text-xl font-bold">${fund.nav.toFixed(4)}</p>
                    <p class="text-sm ${fund.change >= 0 ? 'text-green-400' : 'text-red-400'}">
                        ${fund.change >= 0 ? '+' : ''}${fund.changePercent.toFixed(2)}%
                    </p>
                </div>
                <div class="bg-gray-800 rounded-lg p-4">
                    <p class="text-gray-400 text-sm">持仓市值</p>
                    <p class="text-white text-xl font-bold">¥${fund.holdValue.toLocaleString()}</p>
                    <p class="text-sm text-blue-400">${fund.holdShares.toLocaleString()}份</p>
                </div>
            </div>
            
            <div class="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 class="text-white font-medium mb-3">持仓分析</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-400">买入价格</span>
                        <span class="text-white">${fund.buyPrice.toFixed(4)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">持仓收益</span>
                        <span class="${fund.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
                            ${fund.profit >= 0 ? '+' : ''}¥${fund.profit.toFixed(2)} (${fund.profitPercent.toFixed(2)}%)
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-400">投资行业</span>
                        <span class="text-white">${fund.industry}</span>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-3">
                <button onclick="setAlert('${fund.code}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors">
                    设置提醒
                </button>
                <button onclick="analyzeFund('${fund.code}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
                    深度分析
                </button>
            </div>
        </div>
    `;

  modal.classList.remove('hidden');
}

// 关闭模态框
function closeModal() {
  document.getElementById('fund-modal').classList.add('hidden');
}

// 初始化图表
function initCharts() {
  if (!fundData) return;
  try {
    console.log('开始初始化图表...');

    // 确保DOM完全加载后再初始化图表
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM加载完成，重新初始化图表');
        initCharts();
      });
      return;
    }

    // 检查必要的元素是否存在
    const requiredElements = ['asset-allocation-chart', 'industry-chart', 'profit-trend-chart'];

    let missingElements = [];
    requiredElements.forEach((id) => {
      if (!document.getElementById(id)) {
        missingElements.push(id);
      }
    });

    if (missingElements.length > 0) {
      console.warn('以下图表元素未找到:', missingElements);
    }

    // 初始化各个图表
    if (document.getElementById('asset-allocation-chart')) {
      initAssetAllocationChart();
      console.log('资产配置图表初始化完成');
    }

    if (document.getElementById('industry-chart')) {
      initIndustryChart();
      console.log('行业分布图表初始化完成');
    }

    if (document.getElementById('profit-trend-chart')) {
      initProfitTrendChart();
      console.log('收益趋势图表初始化完成');
    }

    console.log('图表初始化全部完成');
  } catch (error) {
    console.error('图表初始化失败:', error);
  }
}

// 资产配置饼图
function initAssetAllocationChart() {
  const chart = echarts.init(document.getElementById('asset-allocation-chart'));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: {
        color: '#fff',
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data: [
          { value: fundData.assetAllocation.stock, name: '股票型基金', itemStyle: { color: '#00d4aa' } },
          { value: fundData.assetAllocation.bond, name: '债券型基金', itemStyle: { color: '#4a90e2' } },
          { value: fundData.assetAllocation.cash, name: '货币型基金', itemStyle: { color: '#f5a623' } },
        ],
        label: {
          color: '#fff',
          fontSize: 12,
        },
        labelLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.3)',
          },
        },
      },
    ],
  };

  chart.setOption(option);
}

// 行业分布图
function initIndustryChart() {
  const chart = echarts.init(document.getElementById('industry-chart'));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.2)',
      textStyle: {
        color: '#fff',
      },
    },
    xAxis: {
      type: 'category',
      data: Object.keys(fundData.industryDistribution),
      axisLabel: {
        color: '#8892b0',
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255,255,255,0.1)',
        },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8892b0',
        formatter: '{value}%',
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255,255,255,0.1)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255,255,255,0.05)',
        },
      },
    },
    series: [
      {
        data: Object.values(fundData.industryDistribution),
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4aa' },
            { offset: 1, color: '#4a90e2' },
          ]),
        },
        barWidth: '60%',
      },
    ],
  };

  chart.setOption(option);
}

// 收益趋势图
function initProfitTrendChart() {
  try {
    const chartDiv = document.getElementById('profit-trend-chart');

    // 检查元素是否存在
    if (!chartDiv) {
      console.error('收益趋势图DIV元素未找到！请确保HTML中存在id为"profit-trend-chart"的div元素');
      return;
    }

    // 检查元素尺寸
    if (chartDiv.offsetHeight === 0 || chartDiv.offsetWidth === 0) {
      console.warn('收益趋势图DIV元素尺寸为0，可能需要等待页面完全加载');
      // 延迟重试
      setTimeout(() => {
        if (chartDiv.offsetHeight > 0 && chartDiv.offsetWidth > 0) {
          console.log('DIV元素尺寸已更新，重新初始化图表');
          initProfitTrendChart();
        }
      }, 500);
      return;
    }

    console.log('正在初始化收益趋势图，元素尺寸:', chartDiv.offsetWidth, 'x', chartDiv.offsetHeight);

    const chart = echarts.init(chartDiv);

    // 模拟历史收益数据
    const dates = [];
    const profits = [];
    const baseProfit = fundData.totalProfit - 5000;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));

      const randomChange = (Math.random() - 0.5) * 200;
      const profit = baseProfit + (30 - i) * 150 + randomChange;
      profits.push(profit.toFixed(2));
    }

    console.log('生成的数据:', { dates: dates.length, profits: profits.length });

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: '收益趋势',
        textStyle: {
          color: '#fff',
          fontSize: 14,
        },
        left: 'center',
        top: 10,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: 'rgba(255,255,255,0.2)',
        textStyle: {
          color: '#fff',
        },
        formatter: function (params) {
          return `${params[0].name}<br/>累计收益: ¥${params[0].value}`;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: '#8892b0',
          fontSize: 10,
          rotate: 45,
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.1)',
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#8892b0',
          formatter: '¥{value}',
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.1)',
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.05)',
          },
        },
      },
      series: [
        {
          data: profits,
          type: 'line',
          smooth: true,
          lineStyle: {
            color: '#00d4aa',
            width: 3,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 212, 170, 0.3)' },
              { offset: 1, color: 'rgba(0, 212, 170, 0.05)' },
            ]),
          },
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: '#00d4aa',
          },
          name: '累计收益',
        },
      ],
    };

    chart.setOption(option);
    console.log('收益趋势图初始化成功！');

    // 添加窗口大小改变时的响应
    window.addEventListener('resize', () => {
      chart.resize();
    });
  } catch (error) {
    console.error('收益趋势图初始化失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 初始化动画
function initAnimations() {
  // 页面加载动画
  anime({
    targets: '.fade-in',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: anime.stagger(100),
    easing: 'easeOutQuart',
  });

  // 卡片悬停效果
  document.querySelectorAll('.hover-card').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      anime({
        targets: card,
        scale: 1.02,
        duration: 300,
        easing: 'easeOutQuart',
      });
    });

    card.addEventListener('mouseleave', () => {
      anime({
        targets: card,
        scale: 1,
        duration: 300,
        easing: 'easeOutQuart',
      });
    });
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 导航菜单
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const href = item.getAttribute('href');
      if (href && href !== '#') {
        window.location.href = href;
      }
    });
  });

  // 刷新按钮
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshData();
    });
  }

  // 添加基金按钮
  const addFundBtn = document.getElementById('add-fund-btn');
  if (addFundBtn) {
    addFundBtn.addEventListener('click', () => {
      showAddFundModal();
    });
  }
}

// 刷新数据
async function refreshData() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.innerHTML = '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';

  try {
    fundData = await refreshDashboardData();
    updateDashboard();
    initCharts();
    showToast('数据已更新');
  } catch (error) {
    console.error('刷新数据失败:', error);
    showToast('刷新失败，请稍后重试');
  } finally {
    refreshBtn.innerHTML =
      '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
  }
}

// 显示添加基金模态框
function showAddFundModal() {
  const modal = document.getElementById('add-fund-modal');
  modal.classList.remove('hidden');
}

// 设置提醒
function setAlert(fundCode) {
  showToast('提醒设置功能开发中...');
}

// 分析基金
function analyzeFund(fundCode) {
  window.location.href = `analysis.html?fund=${fundCode}`;
}

// 显示提示消息
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  toast.textContent = message;

  document.body.appendChild(toast);

  anime({
    targets: toast,
    translateX: [300, 0],
    opacity: [0, 1],
    duration: 300,
    easing: 'easeOutQuart',
  });

  setTimeout(() => {
    anime({
      targets: toast,
      translateX: [0, 300],
      opacity: [1, 0],
      duration: 300,
      easing: 'easeInQuart',
      complete: () => {
        document.body.removeChild(toast);
      },
    });
  }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 暴露给内联事件使用
window.showAddFundModal = showAddFundModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.setAlert = setAlert;
window.analyzeFund = analyzeFund;
