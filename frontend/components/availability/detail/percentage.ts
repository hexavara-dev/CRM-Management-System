export function percentage(value: number, total: number) {
  if (!total) return "0.0";
  return ((value / total) * 100).toFixed(1);
}
