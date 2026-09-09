/** Format a Date as a local-calendar YYYY-MM-DD value without UTC conversion. */
export function toLocalDateString(date: Date): string;
export function toLocalDateString(date?: Date): string | undefined;
export function toLocalDateString(date?: Date): string | undefined {
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
