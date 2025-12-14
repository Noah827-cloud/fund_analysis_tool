// @ts-check

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

// Register only what we use in this project.
echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, LabelLayout, CanvasRenderer]);

export { echarts };
export default echarts;
