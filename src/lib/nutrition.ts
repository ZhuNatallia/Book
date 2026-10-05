import { supabase } from './supabase';
import { normalizeMergeUnit } from './ingredientMerge';
import { nutritionFoods, NutritionFood, NutritionPer100 } from '../data/nutrition';
import { measurementConversions, tablespoonConversions } from '../data/measurements';
import type { FullRecipe } from '../types';

export type NutritionSource = 'local' | 'usda' | 'ai';

export interface NutritionRow {
  id: string;
  name: string;
  names: string[];
  quantity: number;
  unit: string;
  grams: number | null;
  per100: NutritionPer100 | null;
  source: NutritionSource | null;
  toTaste: boolean;
}

interface CompiledKey {
  words: { text: string; exact: boolean }[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

// "сырое яйцо" must not be read as cheese ("сыр…").
const RAW_WORD = /^(сыр(ои|ое|ая|ые|ых|ого|ую|ым)|сир(ии|е|а|i))$/;

const tokenize = (s: string) =>
  (normalize(s).match(/[\p{L}\p{N}']+/gu) ?? []).filter((w) => !RAW_WORD.test(w));

function compileKeys(keys: string): CompiledKey[] {
  return keys
    .split('|')
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const exact = k.endsWith('=');
      const words = tokenize(exact ? k.slice(0, -1) : k);
      return { words: words.map((text) => ({ text, exact })) };
    })
    .filter((k) => k.words.length > 0);
}

function keyScore(tokens: string[], key: CompiledKey): number {
  let score = 0;
  for (const word of key.words) {
    const hit = tokens.find((t) => (word.exact ? t === word.text : t.startsWith(word.text)));
    if (!hit) return 0;
    score += word.text.length + (hit === word.text ? 1 : 0);
  }
  return score;
}

function bestMatch<T>(names: string[], table: { item: T; keys: CompiledKey[] }[]): T | null {
  const tokenSets = names.map(tokenize).filter((t) => t.length > 0);
  let best: T | null = null;
  let bestScore = 0;
  for (const { item, keys } of table) {
    for (const tokens of tokenSets) {
      for (const key of keys) {
        const score = keyScore(tokens, key);
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
    }
  }
  return best;
}

let foodTable: { item: NutritionFood; keys: CompiledKey[] }[] | null = null;
let cupTable: { item: (typeof measurementConversions)[number]; keys: CompiledKey[] }[] | null = null;

export function findLocalFood(names: string[]): NutritionFood | null {
  foodTable ??= nutritionFoods.map((item) => ({ item, keys: compileKeys(item.keys) }));
  return bestMatch(names, foodTable);
}

function findCupEntry(names: string[]) {
  cupTable ??= measurementConversions.map((item) => ({
    item,
    keys: compileKeys(Object.values(item.name).join('|')),
  }));
  return bestMatch(names, cupTable);
}

const PIECE_UNITS = /^(pcs|зубч|clove|долька|часточ)/;

// Grams for one unit, or null when the weight depends on the product and must be looked up.
function gramsPerUnit(unit: string, names: string[], local: NutritionFood | null): number | null {
  const u = normalizeMergeUnit(unit);
  const density = local?.density ?? 1;
  if (u === 'g') return 1;
  if (u === 'kg') return 1000;
  if (u === 'mg' || u === 'мг') return 0.001;
  if (u === 'ml') return density;
  if (u === 'l') return 1000 * density;
  if (u === 'pinch') return 0.5;
  if (u === 'cup' || u === 'tbsp' || u === 'tsp') {
    const cup = findCupEntry(names);
    if (u === 'cup') return cup?.weight ?? Math.round(240 * density);
    const spoon = cup ? tablespoonConversions.find((s) => s.nameRu === cup.name.ru)?.weight : undefined;
    const tbsp = spoon ?? Math.round(15 * density);
    return u === 'tbsp' ? tbsp : Math.round((tbsp / 3) * 10) / 10;
  }
  if (!u || PIECE_UNITS.test(u)) return local?.piece ?? null;
  return null;
}

function ingredientNames(ing: FullRecipe['ingredients'][number], language: string): string[] {
  const ordered = [
    ...ing.translations.filter((t) => t.language === 'en'),
    ...ing.translations.filter((t) => t.language === language && t.language !== 'en'),
    ...ing.translations.filter((t) => t.language !== 'en' && t.language !== language),
  ];
  const names = ordered.map((t) => t.name.trim()).filter(Boolean);
  if (ing.name?.trim()) names.push(ing.name.trim());
  return [...new Set(names)];
}

export function buildLocalRows(recipe: FullRecipe, language: string): NutritionRow[] {
  return recipe.ingredients
    .filter((ing) => ing.translations.some((t) => t.name.trim()))
    .map((ing) => {
      const names = ingredientNames(ing, language);
      const display =
        ing.translations.find((t) => t.language === language)?.name ||
        ing.translations.find((t) => t.language === 'ru')?.name ||
        names[0];
      const quantity = Number(ing.quantity) || 0;
      const local = findLocalFood(names);
      const perUnit = quantity > 0 ? gramsPerUnit(ing.unit, names, local) : 0;
      return {
        id: ing.id,
        name: display,
        names,
        quantity,
        unit: ing.unit,
        grams: perUnit == null ? null : Math.round(quantity * perUnit),
        per100: local ? { kcal: local.kcal, protein: local.protein, fat: local.fat, carbs: local.carbs } : null,
        source: local ? 'local' : null,
        toTaste: quantity <= 0,
      };
    });
}

export const rowNeedsLookup = (row: NutritionRow) =>
  !row.toTaste && (row.per100 == null || row.grams == null);

interface RemoteResult {
  per100: NutritionPer100 | null;
  unitGrams: number | null;
  source: NutritionSource | null;
}

export async function lookupRemote(rows: NutritionRow[]): Promise<{ rows: NutritionRow[]; failed: boolean }> {
  const pending = rows.filter(rowNeedsLookup);
  if (pending.length === 0) return { rows, failed: false };
  const { data, error } = await supabase.functions.invoke('nutrition', {
    body: { items: pending.map((r) => ({ names: r.names, unit: r.unit })) },
  });
  const results: RemoteResult[] | undefined = data?.results;
  if (error || !Array.isArray(results)) return { rows, failed: true };

  const byId = new Map(pending.map((r, i) => [r.id, results[i]]));
  const merged = rows.map((row) => {
    const hit = byId.get(row.id);
    if (!hit) return row;
    const next = { ...row };
    if (!next.per100 && hit.per100) {
      next.per100 = hit.per100;
      next.source = hit.source;
    }
    if (next.grams == null && hit.unitGrams != null && hit.unitGrams > 0) {
      next.grams = Math.round(row.quantity * hit.unitGrams);
    }
    return next;
  });
  return { rows: merged, failed: false };
}

export interface NutritionTotals extends NutritionPer100 {
  counted: number;
}

export function sumRows(rows: NutritionRow[]): NutritionTotals {
  const total = { kcal: 0, protein: 0, fat: 0, carbs: 0, counted: 0 };
  for (const row of rows) {
    if (row.toTaste || row.grams == null || row.per100 == null) continue;
    const k = row.grams / 100;
    total.kcal += row.per100.kcal * k;
    total.protein += row.per100.protein * k;
    total.fat += row.per100.fat * k;
    total.carbs += row.per100.carbs * k;
    total.counted += 1;
  }
  return total;
}

export function perServing(total: NutritionPer100, servings: number): NutritionPer100 {
  const s = servings > 0 ? servings : 1;
  const round1 = (n: number) => Math.round((n / s) * 10) / 10;
  return {
    kcal: Math.round(total.kcal / s),
    protein: round1(total.protein),
    fat: round1(total.fat),
    carbs: round1(total.carbs),
  };
}
