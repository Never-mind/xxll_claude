import { utils, read, write } from 'xlsx';

export function rowsFromExcelBuffer<T>(buffer: Buffer): T[] {
  const workbook = read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? utils.sheet_to_json<T>(sheet, { defval: '' }) : [];
}

export function workbookBufferFromSheets(sheets: Record<string, unknown[]>): Buffer {
  const workbook = utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    utils.book_append_sheet(workbook, utils.json_to_sheet(rows), name);
  }
  return write(workbook, { bookType: 'xlsx', type: 'buffer' });
}
