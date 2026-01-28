/**
 * Compute an ISO date range for a full year.
 */
export function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

/**
 * Compute an ISO date range for a specific month within a year.
 */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const m = String(month).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nm = String(nextMonth).padStart(2, '0');
  return { start: `${year}-${m}-01`, end: `${nextYear}-${nm}-01` };
}
