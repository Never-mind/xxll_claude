## 系统概述

一个面向外贸业务人员的产品管理 + 报价计算系统，包含产品管理、关税税率管理、报价单生成（自动成本计算）、报价单列表、报价详情、历史报价管理六大模块。

技术栈: React 19 + TypeScript（前端） / NestJS 10 + TypeScript（后端） / Excel 文件存储（替代数据库）

## 一、数据模型（Excel 替代数据库）

创建以下 Excel 文件作为数据存储，每个文件对应一张表：

## 1. products.xlsx — 产品表

| 列名             | 类型       | 必填  | 说明                |
| -------------- | -------- | --- | ----------------- |
| id             | UUID     | 是   | 唯一标识，自动生成         |
| productCode    | String   | 是   | 产品编码，唯一           |
| name           | String   | 是   | 产品名称              |
| spec           | String   | 否   | 规格                |
| brand          | String   | 否   | 品牌                |
| category       | String   | 否   | 品类                |
| unit           | String   | 是   | 单位，默认"个"          |
| length         | Number   | 是   | 长(cm)             |
| width          | Number   | 是   | 宽(cm)             |
| height         | Number   | 是   | 高(cm)             |
| grossWeight    | Number   | 是   | 毛重(kg)            |
| hsCodeCn       | String   | 否   | 中国HS编码            |
| hsCodeMx       | String   | 是   | 墨西哥HS编码           |
| suggestedPrice | Number   | 是   | 建议进价(CNY)         |
| isMagnetic     | Boolean  | 是   | 是否带磁，默认false      |
| isElectric     | Boolean  | 是   | 是否带电，默认false      |
| needNom        | Boolean  | 是   | 是否需要NOM认证，默认false |
| imageUrl       | String   | 否   | 图片URL             |
| createdAt      | ISO Date | 是   | 创建时间              |
| updatedAt      | ISO Date | 是   | 更新时间              |

## 2. tariff_rates.xlsx — 税率表

| 列名         | 类型       | 必填  | 说明             |
| ---------- | -------- | --- | -------------- |
| id         | UUID     | 是   | 唯一标识           |
| deviceType | String   | 是   | 设备类型           |
| hsCode     | String   | 是   | HS编码，唯一        |
| taxRate    | Number   | 是   | 税率(%)          |
| needNom    | Boolean  | 是   | 是否需NOM，默认false |
| createdAt  | ISO Date | 是   | 创建时间           |
| updatedAt  | ISO Date | 是   | 更新时间           |

## 3. quotations.xlsx — 报价表头

| 列名                  | 类型       | 必填  | 说明                           |
| ------------------- | -------- | --- | ---------------------------- |
| id                  | UUID     | 是   | 唯一标识                         |
| quotationNo         | String   | 是   | 报价单编号，唯一，格式 QTN-YYYYMMDD-XXX |
| exchangeRateUsd     | Number   | 是   | 人民币对美元汇率                     |
| exchangeRateMxn     | Number   | 是   | 人民币对墨西哥比索汇率                  |
| capitalCostRate     | Number   | 是   | 资金成本率(%)                     |
| accountPeriod       | Number   | 是   | 账期(月)                        |
| badDebtRate         | Number   | 是   | 坏账率(%)                       |
| customsFeeRate      | Number   | 是   | 清关手续费率(%)                    |
| vatOverseas         | Number   | 是   | 海外增值税率(%)                    |
| markupRate          | Number   | 是   | 加价率(%)                       |
| seaFreightRate      | Number   | 是   | 海运费率(CNY/CBM)                |
| airFreightRate      | Number   | 是   | 空运费率(CNY/kg)                 |
| nomFee              | Number   | 是   | NOM认证费(USD)                  |
| customsMiscFee      | Number   | 是   | 清关杂费(USD)                    |
| lastMileFee         | Number   | 是   | 尾程费(USD)                     |
| storageOperationFee | Number   | 是   | 仓储操作费(USD)                   |
| implementationFee   | Number   | 是   | 实施费(USD)                     |
| publicFeeTotal      | Number   | 是   | 公共费用总计(USD)                  |
| totalCifUsd         | Number   | 是   | CIF总计(USD)                   |
| totalDdpUsd         | Number   | 是   | DDP总计(USD)                   |
| totalRevenueUsd     | Number   | 是   | 总收入(USD)                     |
| totalProfitUsd      | Number   | 是   | 总利润(USD)                     |
| grossMarginRate     | Number   | 是   | 毛利率(%)                       |
| status              | String   | 是   | 状态: draft/completed          |
| customerName        | String   | 否   | 客户名称                         |
| remark              | String   | 否   | 备注                           |
| createdAt           | ISO Date | 是   | 创建时间                         |
| updatedAt           | ISO Date | 是   | 更新时间                         |

## 4. quotation_items.xlsx — 报价明细表

| 列名                     | 类型       | 必填  | 说明                 |
| ---------------------- | -------- | --- | ------------------ |
| id                     | UUID     | 是   | 唯一标识               |
| quotationId            | UUID     | 是   | 关联报价表头ID           |
| productId              | UUID     | 是   | 关联产品ID             |
| productCode            | String   | 是   | 产品编码               |
| productName            | String   | 是   | 产品名称               |
| purchaseQty            | Number   | 是   | 采购数量               |
| purchasePriceCny       | Number   | 是   | 采购单价(CNY)          |
| totalTaxIncludedCny    | Number   | 是   | 含税总价(CNY)          |
| totalExclTaxCny        | Number   | 是   | 不含税总价(CNY)         |
| vatInputCny            | Number   | 是   | 进项税(CNY)           |
| transportType          | String   | 是   | 运输方式: air/sea/none |
| isCustomsClearance     | Boolean  | 是   | 是否清关               |
| firstMileFreightCny    | Number   | 是   | 头程运费(CNY)          |
| cifCny                 | Number   | 是   | CIF价格(CNY)         |
| cifUsd                 | Number   | 是   | CIF价格(USD)         |
| igiTaxRate             | Number   | 是   | IGI税率(%)           |
| tariffUsd              | Number   | 是   | 关税(USD)            |
| capitalCostUsd         | Number   | 是   | 资金成本(USD)          |
| customsFeeUsd          | Number   | 是   | 清关手续费(USD)         |
| nomFeeUsd              | Number   | 是   | NOM认证费(USD)        |
| publicFeeAllocationUsd | Number   | 是   | 公共费用分摊(USD)        |
| ddpTotalUsd            | Number   | 是   | DDP总价(USD)         |
| ddpUnitPriceUsd        | Number   | 是   | DDP单价(USD)         |
| revenueUsd             | Number   | 是   | 收入(USD)            |
| operatingProfitUsd     | Number   | 是   | 营业利润(USD)          |
| grossMarginRate        | Number   | 是   | 毛利率(%)             |
| badDebtProvisionUsd    | Number   | 是   | 坏账准备(USD)          |
| markupRate             | Number   | 是   | 加价率(%)             |
| enableNom              | Boolean  | 是   | 是否启用NOM            |
| createdAt              | ISO Date | 是   | 创建时间               |
| updatedAt              | ISO Date | 是   | 更新时间               |

## 5. history_quotations.xlsx — 历史报价表

| 列名               | 类型       | 必填  | 说明                 |
| ---------------- | -------- | --- | ------------------ |
| id               | UUID     | 是   | 唯一标识               |
| quotationDate    | ISO Date | 是   | 报价日期               |
| customerName     | String   | 是   | 客户名称               |
| productCode      | String   | 是   | 产品编码               |
| productName      | String   | 是   | 产品名称               |
| spec             | String   | 否   | 规格                 |
| brand            | String   | 否   | 品牌                 |
| transportType    | String   | 是   | 运输方式: air/sea/none |
| customerPriceUsd | Number   | 是   | 客户报价(USD)          |
| createdAt        | ISO Date | 是   | 创建时间               |
| updatedAt        | ISO Date | 是   | 更新时间               |

## 二、Excel 数据访问层

创建一个 ExcelStorageService 替代数据库 ORM，提供以下通用方法：

// ExcelStorageService 接口

class ExcelStorageService {

  // 读取整个表为对象数组

  async readTable<T>(fileName: string): Promise<T[]>

  // 写入整个表（覆盖）

  async writeTable<T>(fileName: string, data: T[]): Promise<void>

  // 根据条件筛选

  async query<T>(fileName: string, where: Partial<T>): Promise<T[]>

  // 插入单条

  async insert<T>(fileName: string, record: T): Promise<T>

  // 更新单条（根据id）

  async update<T>(fileName: string, id: string, data: Partial<T>): Promise<void>

  // 删除单条（根据id）

  async delete(fileName: string, id: string): Promise<void>

  // 分页查询

  async paginate<T>(fileName: string, page: number, pageSize: number, where?: Partial<T>): Promise<{ items: T[]; total: number }>

}

实现要点:

- 使用 xlsx 库读写 Excel 文件

- 文件存放在 data/ 目录下

- 每次读写操作后自动保存

- UUID 使用 crypto.randomUUID() 生成

- 日期字段自动填充 createdAt / updatedAt

## 三、后端 API 接口

## 3.1 产品模块 /api/products

| 方法     | 路径                   | 功能           | 参数                                                                                                                                                                                   |
| ------ | -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | /api/products        | 分页查询产品列表     | keyword?, page, pageSize                                                                                                                                                             |
| POST   | /api/products        | 创建产品         | Body: { productCode, name, spec?, brand?, category?, unit?, length, width, height, grossWeight, hsCodeCn?, hsCodeMx, suggestedPrice, isMagnetic?, isElectric?, needNom?, imageUrl? } |
| PUT    | /api/products/:id    | 更新产品         | Body: 同创建                                                                                                                                                                            |
| DELETE | /api/products/:id    | 删除产品         | -                                                                                                                                                                                    |
| GET    | /api/products/export | 导出所有产品为Excel | -                                                                                                                                                                                    |
| POST   | /api/products/import | 批量导入产品       | FormData: file                                                                                                                                                                       |

搜索逻辑: keyword 模糊匹配 productCode / name / category

## 3.2 税率模块 /api/tariff-rates

| 方法     | 路径                           | 功能           | 参数                                              |
| ------ | ---------------------------- | ------------ | ----------------------------------------------- |
| GET    | /api/tariff-rates            | 分页查询税率列表     | keyword?, page, pageSize                        |
| POST   | /api/tariff-rates            | 创建税率         | Body: { deviceType, hsCode, taxRate, needNom? } |
| PUT    | /api/tariff-rates/:id        | 更新税率         | Body: 同创建                                       |
| DELETE | /api/tariff-rates/:id        | 删除税率         | -                                               |
| GET    | /api/tariff-rates/by-hs-code | 根据HS编码查询税率   | hsCode (query)                                  |
| GET    | /api/tariff-rates/export     | 导出所有税率为Excel | -                                               |
| POST   | /api/tariff-rates/import     | 批量导入税率       | FormData: file                                  |

## 3.3 报价模块 /api/quotations

| 方法     | 路径                                 | 功能           | 参数                                        |
| ------ | ---------------------------------- | ------------ | ----------------------------------------- |
| POST   | /api/quotations                    | 创建报价单        | Body: 见下方 CreateQuotationDto              |
| PUT    | /api/quotations/:id                | 更新报价单        | Body: 同创建                                 |
| GET    | /api/quotations                    | 分页查询报价列表     | page, pageSize, status? (draft/completed) |
| GET    | /api/quotations/:id                | 获取报价详情       | -                                         |
| GET    | /api/quotations/:id/items          | 分页查询报价明细     | page, pageSize                            |
| GET    | /api/quotations/:id/items-for-edit | 获取所有明细（用于编辑） | -                                         |
| GET    | /api/quotations/:id/export         | 导出报价单为Excel  | -                                         |
| DELETE | /api/quotations/:id                | 删除报价单        | -                                         |

CreateQuotationDto:

{

  exchangeRateUsd: number;       // 人民币对美元汇率

  exchangeRateMxn: number;       // 人民币对墨西哥比索汇率

  capitalCostRate: number;       // 资金成本率(%)

  accountPeriod: number;         // 账期(月)

  badDebtRate: number;           // 坏账率(%)

  customsFeeRate: number;        // 清关手续费率(%)

  vatOverseas: number;           // 海外增值税率(%)

  markupRate: number;            // 加价率(%)

  seaFreightRate: number;        // 海运费率(CNY/CBM)

  airFreightRate: number;        // 空运费率(CNY/kg)

  nomFee: number;                // NOM认证费(USD)

  customsMiscFee: number;        // 清关杂费(USD)

  lastMileFee: number;           // 尾程费(USD)

  storageOperationFee: number;   // 仓储操作费(USD)

  implementationFee: number;     // 实施费(USD)

  publicFeeTotal: number;        // 公共费用总计(USD)

  status: 'draft' | 'completed'; // 状态

  customerName?: string;         // 客户名称

  remark?: string;               // 备注

  items: {                       // 报价明细

    productId: string;           // 产品ID
    
    purchaseQty: number;         // 采购数量
    
    purchasePriceCny: number;    // 采购单价(CNY)
    
    transportType: 'air' | 'sea' | 'none';
    
    isCustomsClearance: boolean;
    
    markupRate?: number;         // 单品加价率(覆盖全局)
    
    enableNom?: boolean;

  }[];

}

## 3.4 历史报价模块 /api/history-quotations

| 方法     | 路径                             | 功能             | 参数                                                                                                              |
| ------ | ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | /api/history-quotations        | 分页查询历史报价       | keyword?, page, pageSize                                                                                        |
| POST   | /api/history-quotations        | 创建历史报价         | Body: { quotationDate, customerName, productCode, productName, spec?, brand?, transportType, customerPriceUsd } |
| PUT    | /api/history-quotations/:id    | 更新历史报价         | Body: 同创建                                                                                                       |
| DELETE | /api/history-quotations/:id    | 删除历史报价         | -                                                                                                               |
| GET    | /api/history-quotations/export | 导出所有历史报价为Excel | -                                                                                                               |
| POST   | /api/history-quotations/import | 批量导入历史报价       | FormData: file                                                                                                  |

搜索逻辑: keyword 模糊匹配 customerName / productCode / productName

特殊逻辑: list 接口返回时，如果历史报价的 spec/brand 为空，需从 products.xlsx 中根据 productCode 查询补全。

## 四、核心业务逻辑 — 报价计算

## 4.1 单商品计算流程（processQuotationItem）

对每个报价明细项执行以下计算：

// Step 1: 获取产品信息

从 products.xlsx 根据 productId 查询产品

从 tariff_rates.xlsx 根据 product.hsCodeMx 查询税率

// Step 2: 基础价格计算

totalTaxIncludedCny = purchaseQty × purchasePriceCny

totalExclTaxCny = totalTaxIncludedCny / 1.13

vatInputCny = totalTaxIncludedCny - totalExclTaxCny

// Step 3: 体积与重量计算

volumeCbm = (length × width × height) / 1,000,000

volumetricWeight = volumeCbm × 167

actualWeight = grossWeight

chargeableWeight = max(volumetricWeight, actualWeight)

// Step 4: 头程运费计算

if transportType === 'air':

  firstMileFreightCny = chargeableWeight × airFreightRate × purchaseQty

else if transportType === 'sea':

  firstMileFreightCny = volumeCbm × seaFreightRate × purchaseQty

else:

  firstMileFreightCny = 0

// Step 5: CIF 计算

cifCny = totalExclTaxCny + firstMileFreightCny

cifUsd = cifCny / exchangeRateUsd

// Step 6: 关税计算

if isCustomsClearance:

  igiTaxRate = 从税率表查到的 taxRate

  tariffUsd = cifUsd × igiTaxRate / 100

else:

  igiTaxRate = 0

  tariffUsd = 0

// Step 7: 资金成本

capitalCostUsd = cifUsd × capitalCostRate / 100 × accountPeriod / 12

// Step 8: 清关手续费

if isCustomsClearance:

  customsFeeUsd = cifUsd × customsFeeRate / 100

else:

  customsFeeUsd = 0

// Step 9: NOM认证费

if enableNom && isCustomsClearance:

  nomFeeUsd = nomFee

else:

  nomFeeUsd = 0

// Step 10: DDP总价（分配公共费用前）

ddpTotalUsd = cifUsd + tariffUsd + capitalCostUsd + customsFeeUsd + nomFeeUsd

ddpUnitPriceUsd = ddpTotalUsd / purchaseQty

// Step 11: 收入和利润（分配公共费用前）

effectiveMarkupRate = item.markupRate ?? 全局 markupRate

revenueUsd = ddpTotalUsd × (1 + effectiveMarkupRate / 100)

operatingProfitUsd = revenueUsd - ddpTotalUsd

grossMarginRate = revenueUsd > 0 ? (operatingProfitUsd / revenueUsd) × 100 : 0

badDebtProvisionUsd = revenueUsd × badDebtRate / 100

## 4.2 公共费用分摊

// Step 1: 计算总CIF

totalCifUsd = 所有明细项 cifUsd 之和

// Step 2: 按CIF比例分摊公共费用

for each item:

  ratio = item.cifUsd / totalCifUsd  (totalCifUsd > 0 时)

  allocation = publicFeeTotal × ratio

  // Step 3: 重新计算DDP和利润

  ddpTotalUsd = item.ddpTotalUsd + allocation

  ddpUnitPriceUsd = ddpTotalUsd / purchaseQty

  revenueUsd = ddpTotalUsd × (1 + effectiveMarkupRate / 100)

  operatingProfitUsd = revenueUsd - ddpTotalUsd

  grossMarginRate = revenueUsd > 0 ? (operatingProfitUsd / revenueUsd) × 100 : 0

  badDebtProvisionUsd = revenueUsd × badDebtRate / 100

## 4.3 整单汇总

totalCifUsd = Σ item.cifUsd

totalDdpUsd = Σ item.ddpTotalUsd (分摊后)

totalRevenueUsd = Σ item.revenueUsd (分摊后)

totalProfitUsd = Σ item.operatingProfitUsd (分摊后)

grossMarginRate = totalRevenueUsd > 0 ? (totalProfitUsd / totalRevenueUsd) × 100 : 0

## 4.4 同步到历史报价

当报价单 status === 'completed' 时：

for each quotationItem:

  从 products.xlsx 查询 spec 和 brand

  插入 history_quotations.xlsx:

    quotationDate = 当前日期
    
    customerName = 报价单.customerName 或 '未知客户'
    
    productCode = item.productCode
    
    productName = item.productName
    
    spec = product.spec
    
    brand = product.brand
    
    transportType = item.transportType
    
    customerPriceUsd = item.revenueUsd

## 五、前端页面

## 5.1 路由结构

/                      → ProductManage（产品管理）

/tariff                → TariffRateManage（税率管理）

/quotation/generate    → QuotationGenerate（报价生成）

/quotation/list        → QuotationList（报价列表）

/quotation/detail/:id  → QuotationDetail（报价详情）

/history-quotations    → HistoryQuotationManage（历史报价管理）

## 5.2 产品管理页面 /

- 数据表格展示所有产品，支持分页

- 顶部搜索框（按产品编码/名称/品类搜索）

- 新增/编辑弹窗表单（所有产品字段）

- 删除确认弹窗

- 批量导入/导出按钮

- 表格列：图片、产品编码、产品名称、规格、品牌、品类、单位、尺寸(cm)、毛重(kg)、中国HS编码、墨西哥HS编码、建议进价、特性(带磁/带电/NOM徽章)、操作(编辑/删除)

## 5.3 税率管理页面 /tariff

- 数据表格展示所有税率，支持分页

- 顶部搜索框（按设备类型/HS编码搜索）

- 新增/编辑弹窗表单

- 删除确认弹窗

- 批量导入/导出按钮

- 表格列：设备类型、HS编码、税率(%)、是否需NOM、操作

## 5.4 报价生成页面 /quotation/generate

- 顶部参数配置区: 汇率(USD/MXN)、资金成本率、账期、坏账率、清关手续费率、海外增值税率、加价率、海运费率、空运费率、NOM费、清关杂费、尾程费、仓储操作费、实施费、公共费用总计、客户名称、备注

- 产品选择区: 下拉搜索选择产品，输入采购数量、采购单价、运输方式(空运/海运/无)、是否清关、单品加价率

- 实时计算表格: 添加产品后自动显示计算结果，列包括：产品编码、名称、采购数量、采购单价、含税总价、不含税总价、进项税、运输方式、是否清关、头程运费、CIF(CNY)、CIF(USD)、IGI税率、关税(USD)、资金成本(USD)、清关手续费(USD)、NOM费(USD)、公共费用分摊(USD)、DDP总价(USD)、DDP单价(USD)、收入(USD)、营业利润(USD)、毛利率(%)、坏账准备(USD)、操作(删除)

- 底部汇总区: 显示总CIF、总DDP、总收入、总利润、毛利率

- 操作按钮: 保存为草稿、保存为已完成

## 5.5 报价列表页面 /quotation/list

- 顶部状态切换Tab：全部 / 草稿 / 已完成

- 数据表格展示报价列表，支持分页

- 表格列：报价单编号、客户名称、备注、状态(徽章)、海运报价/方、空运报价/kg、总CIF(USD)、总DDP(USD)、总收入(USD)、总利润(USD)、毛利率(%)、创建时间、操作(查看/导出)

- 点击"查看"跳转到报价详情页

- 点击"导出"下载报价单Excel

## 5.6 报价详情页面 /quotation/detail/:id

- 展示报价单头信息（所有参数）

- 展示报价明细表格（所有计算字段）

- 底部汇总信息

- 导出按钮

## 5.7 历史报价管理页面 /history-quotations

- 数据表格展示历史报价，支持分页

- 顶部搜索框（按客户名称/产品编码/产品名称搜索）

- 新增/编辑弹窗表单

- 删除确认弹窗

- 批量导入/导出按钮

- 表格列：报价日期、客户名称、产品编码、产品名称、规格、品牌、运输方式、报价(USD)、操作(编辑/删除)

## 六、导入导出格式

## 6.1 产品导入模板

| 产品编码 | 产品名称 | 规格 | 品牌 | 品类 | 单位 | 长(cm) | 宽(cm) | 高(cm) | 毛重(kg) | 中国HS编码 | 墨西哥HS编码 | 建议进价(CNY) | 带磁 | 带电 | 需NOM |

## 6.2 税率导入模板

| 设备类型 | HS编码 | 税率(%) | 需NOM |

## 6.3 历史报价导入模板

| 报价日期 | 客户名称 | 产品编码 | 产品名称 | 规格 | 品牌 | 运输方式 | 客户报价(USD) |

## 6.4 报价单导出格式（两个Sheet）

Sheet1: 报价参数

| 参数名            | 值   |
| -------------- | --- |
| （所有报价单头参数逐行展示） |     |

Sheet2: 报价明细 | 产品编码 | 产品名称 | 规格 | 品牌 | 单位 | 采购数量 | 采购单价(CNY) | 客户单价(USD) | 客户总价(USD) | 备注 |

## 七、关键约束

1. 所有写操作需要登录态: POST/PUT/DELETE 接口需验证用户身份

2. UUID 生成: 所有 id 字段使用 crypto.randomUUID()

3. 日期格式: 所有日期字段存储为 ISO 8601 字符串

4. 分页: 默认 page=1, pageSize=10，最大 pageSize=50

5. 搜索: keyword 使用模糊匹配（包含即命中）

6. 报价单编号: 格式 QTN-YYYYMMDD-XXX，XXX 为当日序号

7. Excel 并发: 读写 Excel 时需要加锁或使用队列，避免并发冲突

8. 错误处理: 导入时逐行校验，失败行记录错误信息但不中断整体流程

## 八、文件结构

project/

├── data/                          # Excel 数据存储目录

│   ├── products.xlsx

│   ├── tariff_rates.xlsx

│   ├── quotations.xlsx

│   ├── quotation_items.xlsx

│   └── history_quotations.xlsx

├── server/

│   ├── main.ts                    # 入口

│   ├── app.module.ts              # 根模块

│   ├── common/

│   │   └── services/

│   │       └── excel-storage.service.ts  # Excel 数据访问层

│   └── modules/

│       ├── product/

│       │   ├── product.module.ts

│       │   ├── product.controller.ts

│       │   └── product.service.ts

│       ├── tariff-rate/

│       │   ├── tariff-rate.module.ts

│       │   ├── tariff-rate.controller.ts

│       │   └── tariff-rate.service.ts

│       ├── quotation/

│       │   ├── quotation.module.ts

│       │   ├── quotation.controller.ts

│       │   └── quotation.service.ts     # 核心报价计算逻辑

│       └── history-quotation/

│           ├── history-quotation.module.ts

│           ├── history-quotation.controller.ts

│           └── history-quotation.service.ts

├── client/

│   └── src/

│       ├── app.tsx                # 路由定义

│       ├── pages/

│       │   ├── ProductManage/

│       │   ├── TariffRateManage/

│       │   ├── QuotationGenerate/

│       │   ├── QuotationList/

│       │   ├── QuotationDetail/

│       │   └── HistoryQuotationManage/

│       └── components/ui/         # UI组件库

└── shared/

    └── api.interface.ts           # 前后端共享类
