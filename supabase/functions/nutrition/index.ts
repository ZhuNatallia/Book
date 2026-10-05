import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Looks up per-100g nutrition for ingredients the app's built-in table does not know.
// Order: shared cache → LLM (also yields an English name and unit weights) → USDA FoodData
// Central for the actual numbers. Everything is free-tier by default; providers are picked
// from secrets, so moving to paid plans is a configuration change:
//   GROQ_API_KEY / GROQ_MODEL       free LLM (default)
//   OPENAI_API_KEY / OPENAI_MODEL   paid LLM, used when Groq is absent or NUTRITION_LLM=openai
//   USDA_API_KEY                    free food database (api.data.gov), DEMO_KEY if unset

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Per100 = { kcal: number; protein: number; fat: number; carbs: number };
type Source = 'usda' | 'ai';
type Item = { names: string[]; unit: string };
type CacheRow = {
  name_key: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  unit_grams: Record<string, number> | null;
  source: Source | null;
};
type AiAnswer = Per100 & { en?: string; unitGrams?: number | null };

const MAX_ITEMS = 40;
const LLM_BATCH = 20;
const MASS_OR_VOLUME = /^(g|kg|mg|ml|l|г|гр|кг|мг|мл|л|грамм\p{L}*|килограмм\p{L}*|литр\p{L}*|миллилитр\p{L}*)$/u;

const nameKey = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim().slice(0, 120);

const unitKey = (u: string) => u.toLowerCase().replace(/\./g, '').trim() || 'pcs';

const needsUnitWeight = (unit: string) => !MASS_OR_VOLUME.test(unitKey(unit));

const finite = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function toPer100(raw: Record<string, unknown> | null | undefined): Per100 | null {
  if (!raw) return null;
  const kcal = finite(raw.kcal);
  if (kcal == null || kcal > 950) return null;
  return {
    kcal: Math.round(kcal),
    protein: Math.round((finite(raw.protein) ?? 0) * 10) / 10,
    fat: Math.round((finite(raw.fat) ?? 0) * 10) / 10,
    carbs: Math.round((finite(raw.carbs) ?? 0) * 10) / 10,
  };
}

// ---------- LLM ----------

type LlmClient = { key: string; url: string; model: string };

function resolveLlm(): LlmClient | null {
  const groq = Deno.env.get('GROQ_API_KEY');
  const openai = Deno.env.get('OPENAI_API_KEY');
  const preferOpenai = Deno.env.get('NUTRITION_LLM')?.trim().toLowerCase() === 'openai';
  const openaiClient = openai
    ? { key: openai, url: 'https://api.openai.com/v1/chat/completions', model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini' }
    : null;
  if (preferOpenai && openaiClient) return openaiClient;
  if (groq) {
    return {
      key: groq,
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b',
    };
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `You are a precise food composition database.
For every ingredient you get its name (possibly in several languages) and the unit used in a recipe.
Return, for the product as typically used in home cooking (raw unless the name says otherwise):
- "en": a short plain English name suitable for searching the USDA food database (e.g. "wheat flour", "chicken breast raw")
- "kcal", "protein", "fat", "carbs": per 100 g of edible product
- "unitGrams": weight in grams of ONE given unit of this product (one piece, clove, bunch, can, slice, cup, spoon...), or null when the unit is a mass or volume unit
Answer with JSON only: {"items":[{"i":0,"en":"...","kcal":0,"protein":0,"fat":0,"carbs":0,"unitGrams":null}]}`;

async function postLlm(llm: LlmClient, body: Record<string, unknown>): Promise<Response> {
  const extras = llm.model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {};
  const send = () =>
    fetch(llm.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: llm.model, ...extras, ...body }),
    });
  let res = await send();
  // Groq's free tier refills its per-minute budget and states the wait in the error body.
  for (let attempt = 0; attempt < 2 && res.status === 429; attempt++) {
    const detail = await res.text();
    const hint = detail.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
    const wait = hint ? Number(hint[1]) / (hint[2].toLowerCase() === 'ms' ? 1000 : 1) : 5;
    if (wait > 30) break;
    await new Promise((r) => setTimeout(r, (wait + 0.5) * 1000));
    res = await send();
  }
  return res;
}

async function askLlm(items: Item[]): Promise<{ answers: (AiAnswer | null)[]; error?: string }> {
  const llm = resolveLlm();
  if (!llm) return { answers: items.map(() => null), error: 'no_llm_key' };
  const answers: (AiAnswer | null)[] = items.map(() => null);
  let error: string | undefined;

  for (let start = 0; start < items.length; start += LLM_BATCH) {
    const batch = items.slice(start, start + LLM_BATCH);
    const payload = batch.map((it, i) => ({
      i,
      names: it.names.slice(0, 4),
      unit: needsUnitWeight(it.unit) ? it.unit || 'piece' : it.unit,
    }));
    const prompt = JSON.stringify(payload);
    try {
      const res = await postLlm(llm, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: Math.min(5000, 1500 + batch.length * 110),
      });
      if (!res.ok) {
        error = `llm_http_${res.status}`;
        console.error('[nutrition] llm', res.status, (await res.text()).slice(0, 300));
        continue;
      }
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseJson(content);
      const list: unknown[] = Array.isArray(parsed?.items) ? parsed.items : [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as Record<string, unknown>;
        const i = Number(row.i);
        if (!Number.isInteger(i) || i < 0 || i >= batch.length) continue;
        const per100 = toPer100(row);
        if (!per100) continue;
        const unitGrams = finite(row.unitGrams);
        answers[start + i] = {
          ...per100,
          en: typeof row.en === 'string' ? row.en.trim().slice(0, 80) : undefined,
          unitGrams: unitGrams && unitGrams > 0 ? Math.round(unitGrams * 10) / 10 : null,
        };
      }
    } catch (err) {
      error = 'llm_failed';
      console.error('[nutrition] llm', err);
    }
  }
  return { answers, error };
}

// deno-lint-ignore no-explicit-any
function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch { /* models sometimes wrap JSON in prose or fences */ }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------- USDA FoodData Central ----------

type UsdaNutrient = { nutrientId?: number; nutrientNumber?: string; unitName?: string; value?: number };
type UsdaFood = { description?: string; foodNutrients?: UsdaNutrient[] };

function usdaValue(list: UsdaNutrient[], numbers: string[], ids: number[], unit?: string): number | null {
  for (const n of list) {
    const match = numbers.includes(String(n.nutrientNumber ?? '')) || ids.includes(Number(n.nutrientId));
    if (!match) continue;
    if (unit && n.unitName && n.unitName.toUpperCase() !== unit) continue;
    const v = finite(n.value);
    if (v != null) return v;
  }
  return null;
}

function usdaPer100(food: UsdaFood): Per100 | null {
  const list = food.foodNutrients ?? [];
  let kcal =
    usdaValue(list, ['208'], [1008], 'KCAL') ??
    usdaValue(list, ['957', '958'], [2047, 2048], 'KCAL');
  if (kcal == null) {
    const kj = usdaValue(list, ['268'], [1062], 'KJ');
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null) return null;
  return toPer100({
    kcal,
    protein: usdaValue(list, ['203'], [1003]) ?? 0,
    fat: usdaValue(list, ['204'], [1004]) ?? 0,
    carbs: usdaValue(list, ['205'], [1005]) ?? 0,
  });
}

const COOKED = /cooked|boiled|fried|roasted|baked|grilled|canned|dried|smoked/i;

async function usdaLookup(query: string): Promise<Per100 | null> {
  const q = query.trim();
  if (!q || !/[a-z]/i.test(q)) return null;
  const key = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY';
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', key);
  url.searchParams.set('query', q);
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('pageSize', '10');
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[nutrition] usda', res.status);
      return null;
    }
    const data = await res.json();
    const foods: UsdaFood[] = Array.isArray(data?.foods) ? data.foods : [];
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const wantsCooked = COOKED.test(q);
    let best: UsdaFood | null = null;
    let bestScore = -Infinity;
    for (let index = 0; index < foods.length; index++) {
      const desc = (foods[index].description ?? '').toLowerCase();
      let score = words.filter((w) => desc.includes(w)).length * 10 - index;
      if (!wantsCooked && /\braw\b/.test(desc)) score += 5;
      if (!wantsCooked && COOKED.test(desc)) score -= 5;
      if (score > bestScore) {
        best = foods[index];
        bestScore = score;
      }
    }
    return best ? usdaPer100(best) : null;
  } catch (err) {
    console.error('[nutrition] usda', err);
    return null;
  }
}

// A database hit that disagrees wildly with the LLM is usually a wrong search match
// ("cream" → "ice cream"), so the LLM estimate wins in that case.
function pickPer100(usda: Per100 | null, ai: AiAnswer | null): { per100: Per100 | null; source: Source | null } {
  if (usda && ai) {
    const hi = Math.max(usda.kcal, ai.kcal);
    const lo = Math.min(usda.kcal, ai.kcal);
    const off = hi - lo > 80 && (lo === 0 || hi / lo > 2.5);
    return off ? { per100: toPer100(ai), source: 'ai' } : { per100: usda, source: 'usda' };
  }
  if (usda) return { per100: usda, source: 'usda' };
  if (ai) return { per100: toPer100(ai), source: 'ai' };
  return { per100: null, source: null };
}

// ---------- handler ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'not authenticated' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'not authenticated' }, 401);

    const body = await req.json().catch(() => null);
    const rawItems: unknown[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
    const items: Item[] = rawItems.map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const names = Array.isArray(r.names)
        ? r.names.filter((n): n is string => typeof n === 'string' && !!n.trim()).map((n) => n.trim().slice(0, 120))
        : [];
      return { names, unit: typeof r.unit === 'string' ? r.unit.slice(0, 40) : '' };
    });
    if (items.length === 0) return json({ results: [] });

    const admin = createClient(url, service);
    const keys = items.map((it) => (it.names[0] ? nameKey(it.names[0]) : ''));
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    const cache = new Map<string, CacheRow>();
    if (uniqueKeys.length) {
      const { data, error } = await admin.from('nutrition_cache').select('*').in('name_key', uniqueKeys);
      if (error) console.error('[nutrition] cache read', error.message);
      for (const row of (data ?? []) as CacheRow[]) cache.set(row.name_key, row);
    }

    const missing: number[] = [];
    items.forEach((it, i) => {
      if (!keys[i]) return;
      const row = cache.get(keys[i]);
      const hasPer100 = row?.kcal != null;
      const hasUnit = !needsUnitWeight(it.unit) || row?.unit_grams?.[unitKey(it.unit)] != null;
      if (!hasPer100 || !hasUnit) missing.push(i);
    });

    let llmError: string | undefined;
    if (missing.length) {
      const { answers, error } = await askLlm(missing.map((i) => items[i]));
      llmError = error;
      const updates = new Map<string, CacheRow>();
      for (let m = 0; m < missing.length; m++) {
        const i = missing[m];
        const key = keys[i];
        const ai = answers[m];
        const current: CacheRow = updates.get(key) ?? cache.get(key) ?? {
          name_key: key, kcal: null, protein: null, fat: null, carbs: null, unit_grams: {}, source: null,
        };
        const next: CacheRow = { ...current, unit_grams: { ...(current.unit_grams ?? {}) } };
        if (next.kcal == null) {
          const latinName = items[i].names.find((n) => /^[\p{Script=Latin}\d\s,.'’()%-]+$/u.test(n));
          const usda = await usdaLookup(ai?.en || latinName || '');
          const picked = pickPer100(usda, ai);
          if (picked.per100) Object.assign(next, picked.per100, { source: picked.source });
        }
        if (needsUnitWeight(items[i].unit) && ai?.unitGrams) {
          next.unit_grams![unitKey(items[i].unit)] = ai.unitGrams;
        }
        updates.set(key, next);
        cache.set(key, next);
      }
      const rows = [...updates.values()]
        .filter((r) => r.kcal != null || Object.keys(r.unit_grams ?? {}).length > 0)
        .map((r) => ({ ...r, updated_at: new Date().toISOString() }));
      if (rows.length) {
        const { error } = await admin.from('nutrition_cache').upsert(rows, { onConflict: 'name_key' });
        if (error) console.error('[nutrition] cache write', error.message);
      }
    }

    const results = items.map((it, i) => {
      const row = keys[i] ? cache.get(keys[i]) : undefined;
      const per100 = row && row.kcal != null ? toPer100(row as unknown as Record<string, unknown>) : null;
      const unitGrams = needsUnitWeight(it.unit) ? finite(row?.unit_grams?.[unitKey(it.unit)]) : null;
      return { per100, unitGrams, source: per100 ? row?.source ?? null : null };
    });

    return json({ results, ...(llmError ? { llmError } : {}) });
  } catch (err) {
    console.error('[nutrition]', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
