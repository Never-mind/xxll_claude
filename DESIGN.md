# Selection Quote UI 设计规范

## 1. 设计方向

当前系统是一个高频使用的企业后台，核心任务是报价、结算、附件、发票和统计数据处理。UI 需要保持现有布局结构和业务流程，只做视觉统一与细节升级。

设计关键词：

- 现代简约
- 数据优先
- 信息密度适中
- 操作路径清晰
- 表格易扫描
- 状态反馈明确

不采用营销页式大横幅、装饰性渐变背景或复杂卡片堆叠。页面应保持安静、专业、轻量，适合反复录入和核对数据。

## 2. 当前页面结构

| 区域 | 主要文件 | UI 形态 |
| --- | --- | --- |
| 登录 | `client/src/pages/LoginPage.tsx` | 居中登录面板 |
| 框架导航 | `client/src/App.tsx` | 左侧导航、分组菜单、用户信息 |
| 统计面板 | `DashboardStatsPage.tsx` | 指标卡、项目收支趋势折线图、结算清单 |
| 产品、客户、税率 | `AdminTable.tsx` | 搜索工具栏、数据表格、弹窗表单 |
| 报价生成 | `QuotationGenerate.tsx` | 产品选择、可编辑报价明细表 |
| 报价列表/详情 | `QuotationList.tsx`, `QuotationDetailPage.tsx` | 筛选、状态、详情指标、导出按钮 |
| 历史报价 | `HistoryQuotationManage.tsx` | 搜索筛选、历史价格表 |
| 项目结算 | `SettlementProjectList.tsx`, `SettlementProjectDetail.tsx` | 标签页、采购明细、附件明细 |
| 发票管理 | `FinanceInvoicePage.tsx` | 筛选、发票表格、金额统计 |

## 3. 配色系统

主色使用克制的企业蓝，背景保持浅灰，内容面使用白色。状态色只用于状态表达，不大面积铺色。

```css
:root {
  --color-primary: #2563d8;
  --color-primary-600: #1f55c8;
  --color-primary-soft: #eaf1ff;
  --color-secondary: #111827;

  --color-bg: #f5f6f8;
  --color-surface: #ffffff;
  --color-surface-soft: #f3f5f8;
  --color-border: #d9dee8;
  --color-border-soft: #e8ecf2;
  --color-text: #151b26;
  --color-muted: #8792a5;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #ff4d4f;
  --color-info: #0ea5e9;
}
```

| 类型 | 颜色 | 用途 |
| --- | --- | --- |
| 主色 | `#2563d8` | 主要按钮、选中态、链接、复选框选中 |
| 主色加深 | `#1f55c8` | 主按钮 hover |
| 主色浅底 | `#eaf1ff` | 选中行、浅色提示、导航激活背景 |
| 背景 | `#f5f6f8` | 页面底色 |
| 内容面 | `#ffffff` | 表格、面板、弹窗 |
| 弱内容面 | `#f3f5f8` | 表头、筛选区、禁用背景 |
| 边框 | `#d9dee8` | 输入框、表格、分割线 |
| 正文 | `#151b26` | 主文本 |
| 次级文本 | `#8792a5` | 辅助说明、占位文本 |
| 成功 | `#16a34a` | 已确认、已完成、成功提示 |
| 警告 | `#d97706` | 待处理、异常提醒 |
| 危险 | `#ff4d4f` | 删除、失败、错误 |

## 4. 排版系统

```css
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;

  --text-xs: 12px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-table: 1.45;

  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

使用规则：

- 页面标题：`20px` 或 `24px`，`600`
- 区块标题：`16px`，`600`
- 表格正文：`13px` 或 `14px`，行高 `1.45`
- 按钮和输入框：`14px`，`500`
- 辅助说明：`12px` 或 `13px`
- 不使用负字距，不按视口宽度缩放字体

## 5. 间距、圆角、阴影

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --shadow-panel: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-popover: 0 12px 28px rgba(15, 23, 42, 0.16);
}
```

使用规则：

- 页面外边距：`24px`
- 面板内边距：`16px` 或 `20px`
- 工具栏间距：`12px`
- 表格单元格横向内边距：`12px`
- 按钮圆角：`6px`
- 卡片和面板圆角：不超过 `8px`
- 阴影只用于弹窗、下拉和少量浮层，常规面板以细边框为主

## 6. 核心组件规范

### 6.1 按钮

按钮用于明确命令。常见操作包括保存、确认报价单、导出、上传、下单采购、删除。

```css
.btn {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  border: 1px solid transparent;
}

.btn-primary {
  color: #ffffff;
  background: var(--color-primary);
}

.btn-primary:hover {
  background: var(--color-primary-600);
}

.btn-secondary {
  color: var(--color-text);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.btn-danger {
  color: #ffffff;
  background: var(--color-danger);
}
```

按钮分级：

| 类型 | 用途 |
| --- | --- |
| Primary | 保存、确认、上传、导出主操作 |
| Secondary | 返回、取消、筛选、普通查看 |
| Danger | 删除、移除 |
| Ghost | 表格内低强调操作 |

### 6.2 卡片和面板

卡片只用于独立指标、重复项和弹窗内容。页面大区块不做过重卡片化。

```css
.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
}
```

指标卡：

- 用于统计面板顶部 KPI
- 数字比标题更醒目
- 同一行指标高度保持一致
- 不使用大面积渐变底色

### 6.3 输入框和筛选控件

```css
.input,
.select,
.textarea {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-md);
}

.input:focus,
.select:focus,
.textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 216, 0.12);
  outline: none;
}
```

规则：

- 搜索框、筛选选择器、日期范围控件高度保持一致
- 占位文字使用 `--color-muted`
- 错误态使用 `--color-danger`
- 长表单优先使用两列或表格式布局，避免页面过长

### 6.4 表格

表格是系统最重要的组件，需要优先保证可读性。

```css
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}

.data-table th {
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-weight: var(--font-semibold);
}

.data-table td,
.data-table th {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-soft);
}

.data-table tr:hover td {
  background: #f8fbff;
}

.data-table tr.is-selected td {
  background: var(--color-primary-soft);
}
```

规则：

- 金额、数量等数字字段右对齐
- 状态字段使用轻量标签
- 操作列固定放在最右侧
- 表头背景使用浅灰，不使用深色表头
- 行 hover 只做轻微背景变化

### 6.5 多选复选框

系统中所有多选勾选样式统一为小正方形，选中后蓝底白色对勾。

```css
input[type="checkbox"].table-checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: #ffffff;
  appearance: none;
  cursor: pointer;
}

input[type="checkbox"].table-checkbox:checked {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.5 8.2 6.6 11.2 12.5 4.8' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-size: 12px 12px;
  background-position: center;
  background-repeat: no-repeat;
}
```

适配规则：

- 表格行内使用 `14px`
- 工具栏或弹窗中可使用 `16px`
- 选中行背景使用浅蓝，不改变行高
- 不使用过大的复选框，不使用圆形勾选样式

### 6.6 导航

左侧导航保持当前信息架构：

- 首页/统计面板
- 基础资料
- 报价管理
- 项目结算
- 财务管理

规范：

- 激活项使用浅蓝背景和主色文字
- 分组标题使用较弱文本色
- 图标和文字间距保持 `8px`
- 折叠或展开时不改变页面主内容宽度逻辑

### 6.7 状态标签

```css
.status {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-success {
  color: var(--color-success);
  background: #ecfdf3;
}

.status-warning {
  color: var(--color-warning);
  background: #fff7ed;
}

.status-danger {
  color: var(--color-danger);
  background: #fff1f0;
}
```

## 7. 关键页面规范

### 7.1 统计面板

- 顶部指标卡展示数量、金额、效率类指标
- 项目收支趋势使用折线图
- 右上角时间范围使用分段按钮或选择器
- 图例展示当前周期收入、成本合计
- 折线点悬停展示金额
- 下方项目结算清单以表格为主

### 7.2 报价页面

- 产品选择区和报价明细区保持现有结构
- 计算结果字段要有清晰数字对齐
- 保存、确认、导出按钮靠近主要流程
- 确认成功后必须给出明确成功提示

### 7.3 项目结算页面

- 未采购商品和已采购商品保持同一排序逻辑
- 附件上传区域显示上传按钮、进度和附件明细
- 上传中的文件在明细中以临时行展示
- 采购、退回、删除等操作按钮不改变表格行高

### 7.4 发票页面

- 筛选区保持紧凑
- 金额统计放在列表上方
- 发票状态用状态标签表达
- 表格列宽优先保证客户、项目、金额和日期可读

## 8. Tailwind 变量建议

如果后续接入 Tailwind，可将当前设计变量映射为：

```js
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563d8",
          600: "#1f55c8",
          soft: "#eaf1ff",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f3f5f8",
        },
        border: {
          DEFAULT: "#d9dee8",
          soft: "#e8ecf2",
        },
        text: {
          DEFAULT: "#151b26",
          muted: "#8792a5",
        },
        success: "#16a34a",
        warning: "#d97706",
        danger: "#ff4d4f",
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.06)",
        popover: "0 12px 28px rgba(15, 23, 42, 0.16)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Microsoft YaHei",
          "PingFang SC",
          "sans-serif",
        ],
      },
    },
  },
};
```

## 9. UI 维护清单

后续新增页面或功能时，按以下清单检查：

- 是否保留左侧导航和当前页面结构
- 是否使用统一按钮高度、圆角和主色
- 表格行高、表头、hover、选中态是否统一
- 多选复选框是否为小正方形蓝色勾选样式
- 状态是否使用统一标签，不只依赖颜色表达
- 上传、保存、确认等异步操作是否有加载和结果反馈
- 金额和数量是否右对齐
- 移动端或窄屏下文本是否不会溢出按钮和表格容器

