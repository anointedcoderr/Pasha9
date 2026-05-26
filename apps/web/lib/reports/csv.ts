// Built by Anointed Coder.
//
// Tiny CSV builder. No external dep. Handles commas, quotes, line
// breaks via RFC 4180 quoting. Returns a string; the caller wraps
// it in a Response with the right Content-Disposition header.

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) {
    return columns && columns.length > 0 ? columns.join(',') + '\n' : '';
  }
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.join(',');
  const body = rows.map((row) => cols.map((c) => escape(row[c])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to mint a CSV download Response.
export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
