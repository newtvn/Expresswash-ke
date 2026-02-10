/**
 * Export utilities for CSV and data download
 */

export const exportToCSV = <T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: string; header: string }[]
): void => {
  if (data.length === 0) return;

  const cols = columns || Object.keys(data[0]).map((key) => ({ key, header: key }));
  const headers = cols.map((c) => c.header).join(',');
  const rows = data.map((item) =>
    cols
      .map((col) => {
        const value = item[col.key];
        const str = String(value ?? '');
        // Escape commas and quotes in CSV
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(',')
  );

  const csv = [headers, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
};

export const exportToJSON = <T>(data: T[], filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
