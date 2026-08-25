const CYR_LONG = ['ами', 'ями', 'ов', 'ей', 'ые', 'ие'] as const;
const CYR_SHORT = ['а', 'я', 'ы', 'и', 'о', 'е', 'ь', 'й'] as const;
const LAT_SUFFIX = ['ungen', 'ies', 'en', 'er', 'es', 's', 'e'] as const;

export type UnitDimension = 'mass' | 'volume' | 'count' | 'other';

export interface QtyLine {
  name: string;
  quantity: number;
  unit: string;
}

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
  if (
    ['pinch', 'pinches', 'prise', 'pizzico', 'pizca', 'pincee', 'pincée', 'szczypta', 'шымшым'].includes(u)
    || u.startsWith('щепотк')
    || u.startsWith('дрібк')
  ) return 'pinch';
  return u;
}

export function unitDimension(unit: string): UnitDimension {
  const u = normalizeMergeUnit(unit);
  if (u === 'g' || u === 'kg') return 'mass';
  if (u === 'ml' || u === 'l') return 'volume';
  if (u === 'pcs') return 'count';
  return 'other';
}

export function toBaseQuantity(quantity: number, unit: string): { qty: number; unit: string } {
  const u = normalizeMergeUnit(unit);
  const qty = Number(quantity) || 0;
  if (u === 'kg') return { qty: qty * 1000, unit: 'g' };
  if (u === 'l') return { qty: qty * 1000, unit: 'ml' };
  if (u === 'g') return { qty, unit: 'g' };
  if (u === 'ml') return { qty, unit: 'ml' };
  return { qty, unit: u };
}

function roundQty(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

export function prettyAmount(quantity: number, unit: string): { quantity: number; unit: string } {
  const base = toBaseQuantity(quantity, unit);
  if (base.unit === 'g' && base.qty >= 1000) {
    return { quantity: roundQty(base.qty / 1000), unit: 'kg' };
  }
  if (base.unit === 'ml' && base.qty >= 1000) {
    return { quantity: roundQty(base.qty / 1000), unit: 'l' };
  }
  return { quantity: roundQty(base.qty), unit: base.unit || unit };
}

export function ingredientMergeKey(name: string, unit: string): string {
  const stem = stemIngredientName(name);
  const dim = unitDimension(unit);
  if (dim === 'mass' || dim === 'volume' || dim === 'count') {
    return `${stem}|${dim}`;
  }
  return `${stem}|${normalizeMergeUnit(unit)}`;
}

const PLURALISH = /[аяыиs]$/i;

export function pickDisplayName(current: string, incoming: string): string {
  if (incoming.length > current.length) return incoming;
  if (current.length > incoming.length) return current;
  if (PLURALISH.test(incoming) || /(?:en|er|es)$/i.test(incoming)) return incoming;
  return current;
}

export function mergeQtyUnit(
  aQty: number,
  aUnit: string,
  bQty: number,
  bUnit: string,
): { quantity: number; unit: string } {
  const a = toBaseQuantity(aQty, aUnit);
  const b = toBaseQuantity(bQty, bUnit);
  const unit = a.unit || b.unit;
  return prettyAmount(a.qty + b.qty, unit);
}

export function mergeIngredientLines(items: QtyLine[]): QtyLine[] {
  const map = new Map<string, QtyLine>();
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = ingredientMergeKey(name, item.unit || '');
    if (!key.split('|')[0]) continue;
    const prev = map.get(key);
    if (prev) {
      const merged = mergeQtyUnit(prev.quantity, prev.unit, item.quantity || 0, item.unit || '');
      map.set(key, {
        name: pickDisplayName(prev.name, name),
        quantity: merged.quantity,
        unit: merged.unit,
      });
    } else {
      const pretty = prettyAmount(item.quantity || 0, item.unit || '');
      map.set(key, { name, quantity: pretty.quantity, unit: pretty.unit || item.unit || '' });
    }
  }
  return [...map.values()];
}

export function subtractIngredientLines(needed: QtyLine[], have: QtyLine[]): QtyLine[] {
  const pantry = new Map<string, { qty: number; unit: string }>();
  for (const item of have) {
    const key = ingredientMergeKey(item.name, item.unit || '');
    if (!key.split('|')[0]) continue;
    const base = toBaseQuantity(item.quantity || 0, item.unit || '');
    const prev = pantry.get(key);
    pantry.set(key, prev
      ? { qty: prev.qty + base.qty, unit: prev.unit || base.unit }
      : { qty: base.qty, unit: base.unit });
  }

  const result: QtyLine[] = [];
  for (const item of needed) {
    const key = ingredientMergeKey(item.name, item.unit || '');
    const stock = pantry.get(key);
    if (!stock || stock.qty <= 0) {
      result.push(item);
      continue;
    }
    const need = toBaseQuantity(item.quantity || 0, item.unit || '');
    const left = need.qty - stock.qty;
    pantry.set(key, { ...stock, qty: Math.max(0, stock.qty - need.qty) });
    if (left > 0.009) {
      const pretty = prettyAmount(left, need.unit || item.unit || '');
      result.push({ name: item.name, quantity: pretty.quantity, unit: pretty.unit || item.unit });
    }
  }
  return result;
}

export function remainingShoppingItems<T extends { ingredientName: string; quantity?: number; unit?: string }>(
  items: T[],
  pantry: { name: string; quantity?: number; unit?: string }[],
): T[] {
  const stock = new Map<string, { qty: number; unit: string }>();
  for (const item of pantry) {
    const key = ingredientMergeKey(item.name, item.unit || '');
    if (!key.split('|')[0]) continue;
    const base = toBaseQuantity(item.quantity || 0, item.unit || '');
    const prev = stock.get(key);
    stock.set(key, prev
      ? { qty: prev.qty + base.qty, unit: prev.unit || base.unit }
      : { qty: base.qty, unit: base.unit });
  }
  const result: T[] = [];
  for (const item of items) {
    const key = ingredientMergeKey(item.ingredientName, item.unit || '');
    const have = stock.get(key);
    if (!have || have.qty <= 0 || item.quantity == null) {
      result.push(item);
      continue;
    }
    const need = toBaseQuantity(item.quantity, item.unit || '');
    const left = need.qty - have.qty;
    stock.set(key, { ...have, qty: Math.max(0, have.qty - need.qty) });
    if (left > 0.009) {
      const pretty = prettyAmount(left, need.unit || item.unit || '');
      result.push({ ...item, quantity: pretty.quantity, unit: pretty.unit || item.unit });
    }
  }
  return result;
}
