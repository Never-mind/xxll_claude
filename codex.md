# Selection Quote 系统开发说明

## 1. 项目概览

Selection Quote 是一个面向外贸选品、报价、项目结算和财务发票管理的 Web 系统。系统覆盖产品资料维护、客户资料维护、税率维护、报价单生成、报价单确认、历史报价查询、项目结算、附件管理、发票管理和统计面板等流程。

当前系统已经从早期 Excel 数据存储演进为 MySQL 云数据库存储，同时保留 Excel 导入、导出和制式报价单导出能力。线上主要部署在 Vercel，前端使用 Vite 构建静态资源，后端接口通过 Vercel Functions 中的 `api/[...path].ts` 承接，并在需要时复用 NestJS 业务模块。

## 2. 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19, React Router 7, TypeScript, Vite |
| 后端 | NestJS 10, Express adapter, TypeScript |
| 线上 API | Vercel Functions, `serverless-http` |
| 数据库 | MySQL, `mysql2/promise` |
| Excel | `xlsx`, `xlsx-js-style` |
| 测试 | Vitest |
| 本地启动 | `tsx`, `concurrently` |

## 3. 目录结构

```text
api/[...path].ts                  Vercel 线上 API 入口和轻量路由
client/src/App.tsx                前端路由、侧边栏、登录态入口
client/src/api.ts                 前端 API 请求封装
client/src/pages/                 主要业务页面
client/src/styles.css             全局 UI 样式和设计变量
server/main.ts                    本地 NestJS 服务入口
server/app.module.ts              后端模块装配
server/modules/                   后端业务模块
server/common/database-storage.service.ts
                                  MySQL 数据访问层和自动补列逻辑
shared/api.interface.ts           前后端共享类型
shared/formal-quotation-export.ts 制式报价单 Excel 生成
database/schema.mysql.sql         MySQL 初始化建表脚本
scripts/migrate-excel-to-mysql.ts Excel 数据迁移到 MySQL
vercel.json                       Vercel 构建、函数和重写配置
```

## 4. 现有功能模块

### 4.1 登录

- 页面：`client/src/pages/LoginPage.tsx`
- 后端：`server/modules/auth/*`
- API：`POST /api/auth/login`
- 用途：后台登录，登录态保存在浏览器 `localStorage`。

### 4.2 统计面板

- 页面：`client/src/pages/DashboardStatsPage.tsx`
- 功能：
  - 已完成报价单数量和金额统计
  - 项目收支趋势折线图
  - 支持近 7 天、近 30 天、近 90 天切换
  - 收入、成本按项目中各项收入和成本发生时间统计
  - 项目结算清单以项目创建时间为准统计
  - 折线图圆点悬停可查看金额

### 4.3 产品管理

- 页面：`client/src/pages/AdminTable.tsx`
- 数据：`products`
- 功能：
  - 产品新增、编辑、删除、搜索
  - 字段显示控制
  - 多选批量操作
  - Excel 数据维护和迁移兼容

### 4.4 客户管理

- 页面：`client/src/pages/AdminTable.tsx`
- 数据：`customers`
- 功能：
  - 客户资料维护
  - 客户历史报价联动
  - 报价单客户信息选择

### 4.5 税率管理

- 页面：`client/src/pages/AdminTable.tsx`
- 数据：`tariff_rates`
- 功能：
  - HS Code、关税、反倾销税等税率维护
  - 报价计算时按产品税率信息参与计算

### 4.6 报价单生成

- 页面：`client/src/pages/QuotationGenerate.tsx`
- 功能：
  - 选择客户和产品
  - 编辑报价明细
  - 计算采购价、关税、反倾销税、利润、DDP 不含税单价等字段
  - 保存报价单草稿
  - 确认报价单后更新状态，并提示“报价单已确认”

### 4.7 报价列表和详情

- 页面：
  - `client/src/pages/QuotationList.tsx`
  - `client/src/pages/QuotationDetailPage.tsx`
- API：
  - `GET /api/quotations`
  - `GET /api/quotations/:id`
  - `POST /api/quotations/:id/confirm`
  - `GET /api/quotations/:id/export-formal`
- 功能：
  - 报价单列表筛选和查看
  - 报价单详情展示
  - 确认报价单
  - 导出普通报价文件
  - 按制式导出报价单 Excel

### 4.8 历史报价

- 页面：`client/src/pages/HistoryQuotationManage.tsx`
- 功能：
  - 按产品、客户、报价单查询历史报价
  - 客户报价登记取每次报价单中的 DDP 不含税单价 USD
  - 辅助后续报价时做价格参考

### 4.9 项目结算

- 页面：
  - `client/src/pages/SettlementProjectList.tsx`
  - `client/src/pages/SettlementProjectDetail.tsx`
- 后端：`server/modules/settlement-project/*`
- 功能：
  - 从报价单创建结算项目
  - 商品按报价列表中的产品顺序展示
  - 未采购商品、已采购商品分区管理
  - 下单采购、退回未采购、收入成本录入
  - 结算附件上传和列表刷新
  - 上传时展示临时文件行、上传进度百分比和完成后刷新

### 4.10 发票管理

- 页面：`client/src/pages/FinanceInvoicePage.tsx`
- 后端：`server/modules/finance/*`
- 功能：
  - 发票列表
  - 发票筛选
  - 发票金额统计
  - 与结算项目、客户信息关联

## 5. 数据库说明

系统当前使用 MySQL。核心数据表包括：

| 表 | 用途 |
| --- | --- |
| `products` | 产品资料 |
| `customers` | 客户资料 |
| `tariff_rates` | 税率资料 |
| `quotations` | 报价单主表 |
| `quotation_items` | 报价单明细 |
| `settlement_projects` | 项目结算主表 |
| `settlement_items` | 项目结算商品明细 |
| `settlement_attachments` | 项目附件 |
| `finance_invoices` | 发票数据 |

数据库建表脚本位于 `database/schema.mysql.sql`。线上函数和本地 NestJS 都会读取数据库环境变量，`server/common/database-storage.service.ts` 中包含部分自动补列逻辑，用于兼容旧数据结构。

## 6. 环境变量

建议在本地 `.env` 和 Vercel Project Settings 中保持同名配置：

```env
DATABASE_URL=mysql://user:password@host:3306/database
DB_CONNECTION_LIMIT=1
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password
```

如果使用分散字段，也可按代码中的读取逻辑配置：

```env
DB_HOST=your-host
DB_PORT=3306
DB_USER=your-user
DB_PASSWORD=your-password
DB_NAME=your-database
DB_CONNECTION_LIMIT=1
```

说明：

- `DATABASE_URL` 适合云数据库的一体化连接串。
- `DB_CONNECTION_LIMIT` 用于限制 MySQL 连接池，Vercel Serverless 环境建议保持 `1` 或 `2`，避免数据库连接数被瞬间打满。
- 线上修改环境变量后，需要重新部署 Vercel 才会生效。

## 7. 更换数据库源

更换数据库时按以下步骤操作：

1. 在新 MySQL 数据库中执行 `database/schema.mysql.sql`。
2. 如果需要迁移旧 Excel 数据，运行 `scripts/migrate-excel-to-mysql.ts`。
3. 修改本地 `.env` 中的 `DATABASE_URL` 或 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`。
4. 修改 Vercel 环境变量中的同名配置。
5. 重新部署 Vercel。
6. 访问 `/api/products?page=1&pageSize=1`、`/api/customers?page=1&pageSize=1`、`/api/quotations?page=1&pageSize=1` 验证数据库连接和返回格式。

如果云数据库连接数较小，优先降低 `DB_CONNECTION_LIMIT`，并减少前端一次性并发请求。

## 8. 本地开发

安装依赖：

```bash
npm install
```

启动本地开发：

```bash
npm run dev
```

常见端口：

- 前端 Vite：`http://localhost:5173`
- 后端 API：通常由本地 NestJS 或 Vite 代理承接，具体以启动日志为准。

构建前端：

```bash
npm run build
```

运行测试：

```bash
npm test
```

## 9. Vercel 部署

项目使用 `vercel.json` 配置构建、函数和 SPA 重写。部署前确认：

- Vercel 已配置数据库和登录相关环境变量。
- `npm run build` 本地可通过。
- `api/[...path].ts` 能正常连接数据库。

部署命令：

```bash
vercel --prod
```

部署后建议验证：

```text
https://quotation-teal.vercel.app/
https://quotation-teal.vercel.app/api/products?page=1&pageSize=1
https://quotation-teal.vercel.app/api/quotations?page=1&pageSize=1
```

如果页面路由刷新后出现 `NOT_FOUND`，优先检查 `vercel.json` 中 SPA 重写规则。  
如果接口返回 `Unexpected token '<'`，通常说明前端把 HTML 错误页当 JSON 解析，需要检查 API 路径、部署状态或函数报错。

## 10. EdgeOne Pages 说明

EdgeOne Pages 更适合部署静态前端页面。当前项目包含后端 API 和数据库访问逻辑，如果部署到 EdgeOne Pages，需要额外准备后端服务，例如：

- Vercel Functions
- 腾讯云云函数
- 腾讯云云托管
- 轻量服务器或 Docker 服务

前端可以部署在 EdgeOne Pages，API 地址通过环境变量指向独立后端。

## 11. 关键业务规则

- 报价单确认后状态必须更新，并向用户提示“报价单已确认”。
- 项目结算商品顺序必须保持报价单明细顺序。
- 历史报价中的客户报价登记为每次报价单的 DDP 不含税单价 USD，不是产品总价。
- 统计面板的项目收支趋势按收入和成本各自发生时间统计。
- 项目结算清单按项目创建时间统计，不按更新时间统计。
- 上传附件时需要显示上传中临时行、百分比进度，完成后自动刷新附件明细。
- 多选样式统一为小正方形复选框，选中后蓝底白色对勾。

## 12. 常见问题

### 12.1 Vercel 上页面能打开但接口报 JSON 解析错误

常见原因是 API 实际返回了 HTML 错误页。检查：

- 请求路径是否以 `/api/` 开头。
- Vercel Function 是否部署成功。
- 环境变量是否完整。
- 数据库连接是否超时或连接数已满。

### 12.2 数据库连接数瞬间打满

处理方式：

- 将 `DB_CONNECTION_LIMIT` 调整为 `1` 或 `2`。
- 避免前端页面一次性并发请求大量详情接口。
- 在统计页面中分批拉取详情数据。
- 使用云数据库连接池代理或提升数据库连接数上限。

### 12.3 附件上传超时

Vercel Functions 有执行时间限制。大文件上传建议：

- 限制单文件大小。
- 使用对象存储直传。
- 后端只保存文件元数据和访问地址。

### 12.4 修改环境变量后没有生效

Vercel 环境变量修改后必须重新部署。仅修改本地 `.env` 不会影响线上环境。

