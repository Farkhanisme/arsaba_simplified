/**
 * Deklarasi minimal untuk exceljs (tanpa @types/exceljs agar package.json
 * tidak berubah). Hanya permukaan yang dipakai src/server/ekspor.ts.
 */
declare module 'exceljs' {
  export interface CellValueRange {
    [k: string]: unknown;
  }

  export interface Cell {
    value: unknown;
  }

  export interface Row {
    getCell(n: number): Cell;
    eachCell(cb: (c: Cell) => void): void;
  }

  export interface Worksheet {
    addRow(values: unknown[]): void;
    getRow(n: number): Row;
    eachRow(cb: (row: Row, n: number) => void): void;
  }

  export interface WorkbookXlsx {
    writeBuffer(): Promise<ExcelJSBuffer>;
    load(data: unknown): Promise<Workbook>;
  }

  export interface ExcelJSBuffer extends Uint8Array {}

  export interface Workbook {
    creator: string;
    worksheets: (Worksheet & { name: string })[];
    addWorksheet(name: string): Worksheet;
    getWorksheet(name: string): (Worksheet & { name: string }) | undefined;
    eachSheet(cb: (ws: Worksheet & { name: string }, id: number) => void): void;
    xlsx: WorkbookXlsx;
  }

  const ExcelJS: {
    Workbook: new () => Workbook;
  };

  export default ExcelJS;
}
