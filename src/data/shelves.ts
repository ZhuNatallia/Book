export const PRESET_SHELVES = ['moms', 'everyday', 'holiday', 'quick'] as const;

export type PresetShelf = (typeof PRESET_SHELVES)[number];

const PRESET_KEYS: Record<PresetShelf, string> = {
  moms: 'tagMoms',
  everyday: 'tagEveryday',
  holiday: 'tagHoliday',
  quick: 'tagQuick',
};

export function isPresetShelf(tag: string): tag is PresetShelf {
  return (PRESET_SHELVES as readonly string[]).includes(tag);
}

export function hasMomsShelf(tags?: string[] | null): boolean {
  return (tags ?? []).includes('moms');
}

export function shelfLabel(tag: string, t: (key: string) => string): string {
  if (isPresetShelf(tag)) return t(PRESET_KEYS[tag]);
  return tag;
}
