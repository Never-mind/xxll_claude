# Quotation Project Onboarding

## 1 分钟说明

这是一个跨境产品报价管理系统，用于维护产品、客户、关税税率，并生成、保存、修改、导出报价单。系统现在以 MySQL 作为持久化存储，仍保留 Excel 导入/导出作为数据交换方式。前端是 React + TypeScript + Vite，后端是 Nest 风格模块 + Express，Vercel serverless 入口在 `api/[...path].ts`。

## 怎么启动

- 安装依赖：`npm.cmd install`
- 启动前端和后端：`npm.cmd run dev`
- 只启动后端：`npm.cmd run dev:server`
- 只启动前端：`npm.cmd run dev:client`
- 构建：`npm.cmd run build`
- 测试：`npm.cmd test`
- Excel 迁移到 MySQL：`npm.cmd run db:migrate:excel`

PowerShell 环境下优先使用 `npm.cmd`，避免脚本执行策略导致 `npm` 命令失败。

## 数据库

MySQL 8 是当前主存储。环境变量参考 `.env.example`：

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_USER=root`
- `DB_PASSWORD=root`
- `DB_NAME=quotation`

数据库结构在 `database/schema.mysql.sql`。存储层主文件是 `server/common/database-storage.service.ts`，旧 Excel 存储与工具保留在 `server/common/excel-storage.service.ts` 和 `server/common/excel-utils.ts`。

## 关键模块

- 前端路由：`client/src/App.tsx`
- 页面：`client/src/pages/`
- 全局样式：`client/src/styles.css`
- API 封装：`client/src/api.ts`
- 后端模块：`server/modules/`
- 共享类型：`shared/api.interface.ts`
- 产品管理：`server/modules/product/`、`client/src/pages/ProductManage.tsx`
- 客户列表：`server/modules/customer/`、`client/src/pages/CustomerManage.tsx`
- 税率管理：`server/modules/tariff-rate/`、`client/src/pages/TariffRateManage.tsx`
- 报价生成/列表/详情：`server/modules/quotation/`、`client/src/pages/QuotationGenerate.tsx`、`QuotationList.tsx`、`QuotationDetailPage.tsx`
- 历史报价：`server/modules/history-quotation/`、`client/src/pages/HistoryQuotationManage.tsx`
- 统计面板：`client/src/pages/DashboardStatsPage.tsx`

## 核心目标

- 保持现有布局和业务入口，优先做可落地、稳定的功能迭代。
- 报价生成必须能根据已建档产品、客户、数量和参数动态计算选品清单与合计。
- 客户只能从客户列表中选择，不能在报价单里随意输入未建档客户。
- 草稿报价可以修改；已完成报价进入历史报价，不作为草稿继续编辑。
- 产品、税率、报价列表需要支持导入、导出或批量操作时，尽量容忍部分字段缺失。

## 报价计算规则

- 公共费用合计 = 清关杂费 + 尾程费 + 仓储操作费 + 实施费。
- 空运头程运费 CNY = `max(长 * 宽 * 高 / 6000, 产品毛重) * 数量 * 空运费率`。
- 海运头程运费 CNY = `长 * 宽 * 高 / 1000 * 数量 * 海运费率`。
- 无头程运费 = `0`。
- CIF CNY = 不含税总价 CNY + 头程运费 CNY。
- CIF USD = CIF CNY / USD 汇率。
- 关税金额 USD = CIF USD * 关税税率 / 100。
- DDP 报价单价 USD = 到仓单价 USD * `(1 + 加成比例 / 100)`。

计算实现集中在 `server/modules/quotation/quotation-calculator.ts`，测试在 `server/modules/quotation/quotation-calculator.spec.ts`。

## 导入规则

- 产品管理导入从 Excel 第 2 行开始。
- 产品导入允许部分字段缺失，不应因此整体失败。
- 产品长、宽、高导入时分开存储；前端列表显示为 `长×宽×高`。
- 税率导入从 Excel 第 2 行开始。
- 税率中 HS 编码允许重复，设备类型唯一。
- 税率值允许自由填写。

## UI 与设计

- 视觉规范在 `DESIGN.md`。
- 参考截图在 `screen/`，其中搜索框、搜索按钮、产品列表、税率管理、报价生成等样式曾被用作现有 UI 的目标风格。
- 做 UI 修改时保留现有布局结构和功能，只做视觉升级或按截图对齐。

## 注意事项

- 当前仓库可能有大量未提交改动，修改前先看相关文件，不能回退用户已有改动。
- 手动编辑文件优先用 `apply_patch`。
- 不要移除 Excel 导入/导出能力；只是持久化存储改为 MySQL。
- 如果涉及公网部署，本地 MySQL 不能直接被 Vercel 访问，需要公网可访问数据库或内网穿透/专线等方案。
