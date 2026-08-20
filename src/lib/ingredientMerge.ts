const CYR_LONG = ['ами', 'ями', 'ов', 'ей', 'ые', 'ие'] as const;
const CYR_SHORT = ['а', 'я', 'ы', 'и', 'о', 'е', 'ь', 'й'] as const;
const LAT_SUFFIX = ['ungen', 'ies', 'en', 'er', 'es', 's', 'e'] as const;

function stripSuffixes(value: string, suffixes: readonly string[], minLen: number): string {
  for (const suffix of suffixes) {
    if (value.length - suffix.length >= minLen && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }
  return value;
}

export function stemIngredientName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .map((word) => {
      if (/[\u0400-\u04FF]/.test(word)) {
        return stripSuffixes(stripSuffixes(word, CYR_LONG, 3), CYR_SHORT, 3);
      }
      return stripSuffixes(word, LAT_SUFFIX, 2);
    })
    .join(' ');
}

export function normalizeMergeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\./g, '').trim();
  if (!u) return '';
  if (u.startsWith('килограмм')) return 'kg';
  if (u.startsWith('миллилитр')) return 'ml';
  if (u.startsWith('литр')) return 'l';
  if (u.startsWith('грамм')) return 'g';
  if (u.startsWith('штук')) return 'pcs';
  if (['г', 'гр', 'g', 'gram', 'grams'].includes(u)) return 'g';
  if (['мл', 'ml'].includes(u)) return 'ml';
  if (['кг', 'kg'].includes(u)) return 'kg';
  if (['л', 'l'].includes(u)) return 'l';
  if (['шт', 'pcs', 'pc', 'piece', 'pieces', 'szt', 'pz', 'ud', 'st'].includes(u)) return 'pcs';
  if (u === 'cup' || u.startsWith('стакан')) return 'cup';
  if (['ст л', 'стл', 'tbsp', 'tablespoon'].includes(u)) return 'tbsp';
  if (['ч л', 'чл', 'tsp', 'teaspoon'].includes(u)) return 'tsp';
  return u;
}

export function ingredientMergeKey(name: string, unit: string): string {
  return `${stemIngredientName(name)}|${normalizeMergeUnit(unit)}`;
}

const PLURALISH = /[аяыиs]$/i;

export function pickDisplayName(current: string, incoming: string): string {
  if (incoming.length > current.length) return incoming;
  if (current.length > incoming.length) return current;
  if (PLURALISH.test(incoming) || /(?:en|er|es)$/i.test(incoming)) return incoming;
  return current;
}
