import * as XlsxStyleModule from 'xlsx-js-style';
import type { Product, Quotation, QuotationItem } from './api.interface.js';

const XLSX = (XlsxStyleModule as typeof XlsxStyleModule & { default?: typeof XlsxStyleModule }).default ?? XlsxStyleModule;

export interface FormalQuotationLine {
  productName: string;
  spec?: string;
  brand?: string;
  unit?: string;
  quantity: number;
  ddpUnitPriceUsd: number;
  ddpTotalUsd: number;
  remark?: string;
}

export interface FormalQuotationExportInput {
  quotationNo?: string;
  quoteCompany?: string;
  quoteTarget?: string;
  contactName?: string;
  quoteDate?: string;
  remark?: string;
  lines: FormalQuotationLine[];
}

const TAX_RATE = 1.16;
const DEFAULT_COMPANY = '深圳市欣喜连连科技有限公司';

export function linesFromSavedQuotation(items: QuotationItem[], products: Product[]): FormalQuotationLine[] {
  return items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const quantity = Number(item.purchaseQty || 0);
    const ddpTotalUsd = Number(item.revenueUsd || 0);
    return {
      productName: item.productName || product?.name || '',
      spec: product?.spec || '',
      brand: product?.brand || '',
      unit: product?.unit || '',
      quantity,
      ddpUnitPriceUsd: quantity ? ddpTotalUsd / quantity : 0,
      ddpTotalUsd,
      remark: '',
    };
  });
}

export function formalQuotationInputFromSaved(
  quotation: Quotation,
  items: QuotationItem[],
  products: Product[],
  contactName?: string,
): FormalQuotationExportInput {
  return {
    quotationNo: quotation.quotationNo,
    quoteCompany: DEFAULT_COMPANY,
    quoteTarget: quotation.customerName || '',
    contactName,
    quoteDate: formatDate(quotation.createdAt),
    remark: quotation.remark || '',
    lines: linesFromSavedQuotation(items, products),
  };
}

export function writeFormalQuotationWorkbook(input: FormalQuotationExportInput, type: 'buffer' | 'array') {
  const workbook = buildFormalQuotationWorkbook(input);
  return XLSX.write(workbook, { bookType: 'xlsx', type });
}

export function buildFormalQuotationWorkbook(input: FormalQuotationExportInput) {
  const lines = input.lines.map((line, index) => {
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.ddpUnitPriceUsd || 0);
    const total = Number(line.ddpTotalUsd || unitPrice * quantity || 0);
    return {
      index: index + 1,
      productName: line.productName || '',
      spec: line.spec || '',
      brand: line.brand || '',
      unit: line.unit || '',
      quantity,
      unitPrice,
      totalExclTax: total,
      totalInclTax: total * TAX_RATE,
      remark: line.remark || '',
    };
  });

  const totals = {
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalExclTax: lines.reduce((sum, line) => sum + line.totalExclTax, 0),
    totalInclTax: lines.reduce((sum, line) => sum + line.totalInclTax, 0),
  };

  const rows: unknown[][] = [
    ['产品报价单', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    [`报价单位：${input.quoteCompany || DEFAULT_COMPANY}`, '', '', '', `报价对象：${input.quoteTarget || ''}`, '', '', '', '', ''],
    [`报价日期：${input.quoteDate || formatDate()}`, '', '', '', `联系人：${input.contactName || ''}`, '', '', '', '', ''],
    [`报价总数量：${formatInteger(totals.quantity)}`, '', `DDP不含税合计（USD）：${formatNumber(totals.totalExclTax)}`, '', '', `DDP含税合计（USD）：${formatNumber(totals.totalInclTax)}`, '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['序号', '产品名称', '规格', '品牌', '单位', '数量', 'DDP不含税单价（USD）', 'DDP不含税总价（USD）', 'DDP含税总价（USD）', '备注'],
    ...lines.map((line) => [
      line.index,
      line.productName,
      line.spec,
      line.brand,
      line.unit,
      line.quantity,
      line.unitPrice,
      line.totalExclTax,
      line.totalInclTax,
      line.remark,
    ]),
    ['合计', '', '', '', '', totals.quantity, '', totals.totalExclTax, totals.totalInclTax, input.remark || ''],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 9 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 9 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 4 } },
    { s: { r: 4, c: 5 }, e: { r: 4, c: 9 } },
    { s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 4 } },
  ];
  sheet['!cols'] = [
    { wch: 8 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 18 },
  ];
  sheet['!rows'] = [
    { hpt: 30 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 24 },
    { hpt: 12 },
    { hpt: 38 },
  ];

  styleSheet(sheet, rows.length);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '产品报价单');
  return workbook;
}

function styleSheet(sheet: Record<string, unknown>, rowCount: number) {
  const titleStyle = {
    font: { bold: true, sz: 18, name: 'Microsoft YaHei' },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const topStyle = {
    font: { bold: true, sz: 11, name: 'Microsoft YaHei' },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(),
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Microsoft YaHei' },
    fill: { fgColor: { rgb: '4472C4' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder(),
  };
  const bodyStyle = {
    font: { name: 'Microsoft YaHei' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder(),
  };
  const totalStyle = {
    ...bodyStyle,
    font: { bold: true, name: 'Microsoft YaHei' },
  };

  for (let column = 0; column < 10; column += 1) setStyle(sheet, 0, column, titleStyle);
  for (let row = 2; row <= 4; row += 1) {
    for (let column = 0; column < 10; column += 1) setStyle(sheet, row, column, topStyle);
  }
  for (let column = 0; column < 10; column += 1) setStyle(sheet, 6, column, headerStyle);
  for (let row = 7; row < rowCount; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const isTotal = row === rowCount - 1;
      setStyle(sheet, row, column, isTotal ? totalStyle : bodyStyle);
      if (column === 0 || column === 5) {
        const cell = getCell(sheet, row, column);
        cell.z = '#,##0';
      }
      if ([6, 7, 8].includes(column)) {
        const cell = getCell(sheet, row, column);
        cell.z = '#,##0.00';
      }
    }
  }
}

function setStyle(sheet: Record<string, unknown>, row: number, column: number, style: unknown) {
  getCell(sheet, row, column).s = style;
}

function getCell(sheet: Record<string, unknown>, row: number, column: number) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  if (!sheet[address]) sheet[address] = { t: 's', v: '' };
  return sheet[address] as { t?: string; v?: unknown; z?: string; s?: unknown };
}

function thinBorder() {
  const line = { style: 'thin', color: { rgb: '000000' } };
  return { top: line, bottom: line, left: line, right: line };
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInteger(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
