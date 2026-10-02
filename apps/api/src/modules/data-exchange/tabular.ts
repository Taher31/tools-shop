import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';

export type TableFormat = 'xlsx' | 'csv';

export interface Table {
  headers: string[];
  /** Cell text per row, aligned with `headers`. */
  rows: string[][];
  /** Spreadsheet row number (header = 1) of each entry in `rows`. */
  numbers: number[];
}

export const MAX_ROWS = 5000;
export const MAX_COLUMNS = 80;

export class TableError extends Error {}

const CSV_DELIMITERS = [',', ';', '\t'] as const;

/** RFC 4180 parser with BOM removal, quoted fields/newlines and delimiter detection. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    CSV_DELIMITERS.map((d) => ({ d, count: firstLine.split(d).length }))
      .sort((a, b) => b.count - a.count)
      .at(0)?.d ?? ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new TableError('فایل CSV ناقص است (گیومه بسته نشده).');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'string') return value;
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
  if ('text' in value) return String(value.text);
  if ('error' in value) return '';
  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.read(Readable.from(buffer));
  } catch {
    throw new TableError('فایل Excel قابل خواندن نیست. فایل را با فرمت xlsx ذخیره کنید.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new TableError('فایل Excel هیچ برگه‌ای ندارد.');
  const rows: string[][] = [];
  const columnCount = Math.min(sheet.columnCount, MAX_COLUMNS + 1);
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS + 2) return;
    const cells: string[] = [];
    for (let c = 1; c <= columnCount; c += 1) cells.push(cellText(row.getCell(c).value));
    rows[rowNumber - 1] = cells;
  });
  return Array.from(rows, (row) => row ?? []);
}

export function detectFormat(fileName: string, buffer: Buffer): TableFormat {
  // XLSX files are ZIP archives ("PK").
  if (buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx';
  if (/\.xlsx$/i.test(fileName)) throw new TableError('فایل Excel معتبر نیست.');
  if (/\.(csv|txt)$/i.test(fileName)) return 'csv';
  if (/\.xls$/i.test(fileName))
    throw new TableError(
      'فرمت قدیمی xls پشتیبانی نمی‌شود؛ فایل را به صورت xlsx یا CSV ذخیره کنید.',
    );
  throw new TableError('فقط فایل xlsx یا csv پذیرفته می‌شود.');
}

/** Parses a spreadsheet upload; blank rows are dropped, cell text is trimmed. */
export async function parseTable(fileName: string, buffer: Buffer): Promise<Table> {
  const format = detectFormat(fileName, buffer);
  const raw = format === 'xlsx' ? await parseXlsx(buffer) : parseCsv(buffer.toString('utf8'));
  const [header, ...body] = raw;
  if (!header || header.every((cell) => cell.trim() === '')) {
    throw new TableError('ردیف اول فایل باید عنوان ستون‌ها باشد.');
  }
  const headers = header.map((cell) => cell.trim());
  while (headers.length > 0 && headers.at(-1) === '') headers.pop();
  if (headers.length > MAX_COLUMNS) throw new TableError('تعداد ستون‌ها بیش از حد مجاز است.');
  // Keep the original row number: a blank line between data rows must not shift errors.
  const rows: string[][] = [];
  const numbers: number[] = [];
  body.forEach((cells, index) => {
    const values = headers.map((_, c) => (cells[c] ?? '').trim());
    if (values.every((v) => v === '')) return;
    rows.push(values);
    numbers.push(index + 2);
  });
  if (rows.length > MAX_ROWS) {
    throw new TableError(`حداکثر ${MAX_ROWS} ردیف در هر فایل مجاز است؛ فایل را تقسیم کنید.`);
  }
  return { headers, rows, numbers };
}

export interface SheetSpec {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  /** Header → required, to highlight required columns. */
  required?: Set<string>;
  widths?: number[];
}

/** Excel or CSV (UTF-8 with BOM so Excel shows Persian correctly). */
export async function writeTable(
  format: TableFormat,
  main: SheetSpec,
  guide?: SheetSpec,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  if (format === 'csv') {
    const quote = (value: string | number | null) => {
      const text = value === null ? '' : String(value);
      // Neutralise spreadsheet formula injection in text cells.
      const safe = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
      return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [main.headers, ...main.rows].map((row) => row.map(quote).join(','));
    return {
      buffer: Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Toolshop';
  const add = (spec: SheetSpec) => {
    const sheet = workbook.addWorksheet(spec.name, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    sheet.addRow(spec.headers);
    for (const row of spec.rows) {
      const added = sheet.addRow(row);
      // Formula-looking text stays text.
      added.eachCell((cell) => {
        if (typeof cell.value === 'string' && /^[=+\-@]/.test(cell.value)) {
          cell.value = `'${cell.value}`;
        }
      });
    }
    const head = sheet.getRow(1);
    head.font = { bold: true };
    head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    head.height = 28;
    head.eachCell((cell, col) => {
      const required = spec.required?.has(spec.headers[col - 1] ?? '');
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: required ? 'FFFFE0B2' : 'FFE8EEF4' },
      };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF8899AA' } } };
    });
    spec.headers.forEach((header, index) => {
      sheet.getColumn(index + 1).width = spec.widths?.[index] ?? Math.max(14, header.length + 6);
    });
    return sheet;
  };
  add(main);
  if (guide) {
    const sheet = add(guide);
    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 10;
    sheet.getColumn(3).width = 70;
    sheet.getColumn(4).width = 36;
    sheet.eachRow((row) => (row.alignment = { vertical: 'top', wrapText: true }));
  }
  const data = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(data),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  };
}
