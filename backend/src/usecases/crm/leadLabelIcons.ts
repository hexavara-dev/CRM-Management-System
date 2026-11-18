/** Kunci ikon label lead. Harus sama dengan LEAD_LABEL_ICONS di frontend. */
export const LEAD_LABEL_ICONS = [
  'flame',
  'snowflake',
  'thermometer',
  'tag',
  'star',
  'heart',
  'coins',
  'wallet',
  'layers',
  'clock',
  'calendar',
  'briefcase',
  'users',
  'landmark',
  'home',
  'phone',
  'alert',
  'check',
  'x',
  'info',
] as const;

export type LeadLabelIcon = (typeof LEAD_LABEL_ICONS)[number];
