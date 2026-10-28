import * as XLSX from 'xlsx';

// 解析 Excel 第一张表：第一行作为表头，返回 { 列名: 字符串值 } 数组
export async function parseExcel(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return raw.map((row) => {
    const out: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      out[key] = value == null ? '' : String(value).trim();
    });
    return out;
  });
}

// 下载模板：headers 表头 + examples 示例数据（示例可留空）
export function downloadTemplate(
  filename: string,
  headers: string[],
  examples: (string | number)[][] = []
): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}
