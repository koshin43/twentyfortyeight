const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatNumber = (n: number) => n.toLocaleString('en-US');

/** "12 Oct", with the year when it isn't the current year: "12 Oct 2025". */
export function formatDate(ms: number, nowMs: number): string {
  const date = new Date(ms);
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date(nowMs).getFullYear() ? day : `${day} ${date.getFullYear()}`;
}
