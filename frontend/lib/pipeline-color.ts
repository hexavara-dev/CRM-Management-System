const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const resolvePipelineColor = (color: string | null | undefined, fallback = "#94A3B8") =>
  color && HEX_COLOR.test(color) ? color : fallback;

const relativeLuminance = (color: string) => {
  const value = color.slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Hitam atau putih, mana yang kontrasnya (WCAG) lebih tinggi terhadap warna latar. */
export function pipelineTextColor(color: string) {
  const luminance = relativeLuminance(color);
  // Kontras terhadap putih = 1.05 / (L + 0.05); terhadap hitam = (L + 0.05) / 0.05.
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#111827" : "#F9FAFB";
}
