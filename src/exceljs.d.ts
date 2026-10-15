/**
 * Deklarasi minimal untuk exceljs (tanpa @types/exceljs agar package.json
 * tidak berubah). Hanya permukaan yang dipakai src/server/ekspor.ts.
 */
declare module 'exceljs' {
  export interface CellValueRange {
    [k: string]: unknown;
  }

  export interface IsiWarna {
    argb?: string;
    theme?: number;
    [k: string]: unknown;
  }

  export interface Fill {
    type?: string;
    pattern?: string;
    fgColor?: IsiWarna;
    bgColor?: IsiWarna;
  }

  export interface Alignment {
    horizontal?: 'left' | 'center' | 'right' | 'fill' | 'justify' | 'centerContinuous' | 'distributed';
    vertical?: 'top' | 'middle' | 'bottom' | 'distributed' | 'justify';
    wrapText?: boolean;
    textRotation?: number;
    [k: string]: unknown;
  }

  export interface Font {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: IsiWarna;
    name?: string;
    [k: string]: unknown;
  }

  export interface SisiGaris {
    style?: string;
    color?: IsiWarna;
  }

  export interface Border {
    top?: SisiGaris;
    left?: SisiGaris;
    bottom?: SisiGaris;
    right?: SisiGaris;
  }

  export interface Style {
    fill?: Fill;
    alignment?: Alignment;
    font?: Font;
    border?: Border;
    numFmt?: string;
  }

  export interface Cell {
    value: unknown;
    style?: Style;
  }

  export interface Row {
    getCell(n: number): Cell;
    eachCell(cb: (c: Cell) => void): void;
    height?: number;
  }

  export interface Column {
    width?: number;
  }

  export interface Worksheet {
    addRow(values: unknown[]): void;
    getRow(n: number): Row;
    getColumn(n: number): Column;
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