export const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);
