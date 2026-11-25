export const PROJECT_COVER_WIDTH = 2000;
export const PROJECT_COVER_HEIGHT = 600;

export type CropFormat = { width: number; height: number; title: string; suffix: string };

/** Hanya foto sampul yang di-crop; foto lain disimpan utuh dan dikompres. */
export const COVER_FORMAT: CropFormat = {
  width: PROJECT_COVER_WIDTH,
  height: PROJECT_COVER_HEIGHT,
  title: "Atur crop sampul (10:3)",
  suffix: "cover",
};
