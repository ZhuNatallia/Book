import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Flatten all schema.org recipeInstructions variants into a plain string[]
function flattenInstructions(raw: unknown): string[] {
  if (typeof raw === 'string') return raw.split('\n').filter((s) => s.trim());
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (item['@type'] === 'HowToSection')
        return flattenInstructions(item.itemListElement);
      return [item.text ?? item.name ?? ''];
    })
    .filter((s) => typeof s === 'string' && s.trim());
}

// Find a Recipe node anywhere in parsed JSON-LD (top-level or inside @graph)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecipeNode(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null;
  const types: string[] = Array.isArray(obj['@type'])
    ? obj['@type']
    : [obj['@type'] ?? ''];
  if (types.some((t) => t === 'Recipe' || t.endsWith('/Recipe'))) return obj;
  if (Array.isArray(obj['@graph'])) {
    for (const node of obj['@graph']) {
      const found = findRecipeNode(node);
      if (found) return found;
    }
  }
  return null;
}

// Find a VideoObject node in parsed JSON-LD
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findVideoNode(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null;
  const types: string[] = Array.isArray(obj['@type'])
    ? obj['@type']
    : [obj['@type'] ?? ''];
  if (types.some((t) => t === 'VideoObject' || t.endsWith('/VideoObject'))) return obj;
  if (Array.isArray(obj['@graph'])) {
    for (const node of obj['@graph']) {
      const found = findVideoNode(node);
      if (found) return found;
    }
  }
  return null;
}

// Strip HTML tags from a string
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Extract URL from a schema.org image value (string, ImageObject, or similar)
function extractImageUrl(img: unknown): string | undefined {
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && img !== null) {
    const o = img as Record<string, unknown>;
    return (o.url ?? o.contentUrl ?? o.thumbnailUrl) as string | undefined;
  }
  return undefined;
}

// Extract og/twitter meta from HTML (handles both attribute orders)
function extractMeta(html: string, property: string, attr: 'property' | 'name'): string | undefined {
  const a = attr;
  return (
    html.match(new RegExp(`<meta[^>]+${a}=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${a}=["']${property}["']`, 'i'))?.[1]
  );
}

// Fetch a page with browser-like headers
async function fetchPage(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    redirect: 'follow',
  });
}

// Parse all JSON-LD script blocks from HTML
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLdJsonBlocks(html: string): any[] {
  const blocks: any[] = [];
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1])); } catch { /* skip malformed */ }
  }
  return blocks;
}

// Measurement units (RU + EN)
const MEASURE = /\b\d+[.,]?\d*\s*(г|гр|кг|мл|л|шт|ст\.?\s*л\.?|ч\.?\s*л\.?|стакан|стак|щепотк|g|kg|ml|oz|lb|cup|tbsp|tsp|pcs|piece)\b/i;

// Cooking action verbs (RU + EN)
const COOK_VERB = /\b(смешай|добавь|нарежь|взбей|выпекай|обжарь|разогрей|залей|посоли|посыпь|перемешай|вылей|соедини|раскатай|запекай|варить|тушить|кипятить|измельчи|натри|mix|add|bake|cook|stir|whisk|combine|heat|pour|chop|blend|fold|season|preheat)\b/i;

// Parse plain-text description to extract ingredients and steps using heuristic line classification.
// Works without explicit section headers — classifies each line by its content pattern.
function parseDescriptionText(text: string): { ingredients: string[]; instructions: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let mode: 'none' | 'ing' | 'steps' = 'none';

  for (const line of lines) {
    // Section headers → switch mode, don't include the header text itself
    if (/^(ингредиент|состав|продукт|ingredient)/i.test(line) && line.length < 50) {
      mode = 'ing'; continue;
    }
    if (/^(приготовлени|шаги|процесс|инструкц|способ|метод|steps?|directions?|method|how\s+to)/i.test(line) && line.length < 60) {
      mode = 'steps'; continue;
    }

    const isBullet    = /^[-•*✓▪▸→]\s/.test(line);
    const isNumbered  = /^\d+[.)]\s/.test(line);
    const hasMeasure  = MEASURE.test(line);
    const hasCookVerb = COOK_VERB.test(line);

    if (mode === 'ing') {
      // Accept bullets, numbered lines, or lines that contain measurements
      if (isBullet || isNumbered || hasMeasure) {
        ingredients.push(line.replace(/^[-•*✓▪▸→]\s*/, '').replace(/^\d+[.)]\s*/, ''));
        continue;
      }
      // Line looks like a step — switch modes
      if (hasCookVerb || (isNumbered && line.length > 30)) {
        mode = 'steps';
        instructions.push(line.replace(/^\d+[.)]\s*/, ''));
        continue;
      }
    }

    if (mode === 'steps') {
      if (isBullet || isNumbered || hasCookVerb || line.length > 25) {
        instructions.push(line.replace(/^\d+[.)]\s*/, '').replace(/^[-•*✓▪▸→]\s*/, ''));
        continue;
      }
    }

    // No explicit mode yet — classify by content heuristic
    if (mode === 'none') {
      if ((isBullet || hasMeasure) && !hasCookVerb) {
        mode = 'ing';
        ingredients.push(line.replace(/^[-•*✓▪▸→]\s*/, '').replace(/^\d+[.)]\s*/, ''));
      } else if ((isNumbered && hasCookVerb) || (isNumbered && line.length > 40)) {
        mode = 'steps';
        instructions.push(line.replace(/^\d+[.)]\s*/, ''));
      }
      // else: intro/description text — not captured into either array
    }
  }

  return { ingredients, instructions };
}

// Remove social-media engagement noise from raw text before parsing or sending to LLM.
function cleanSocialText(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      // Author handle lines: "@dr.ainur.official", "@someaccount"
      if (/^@\w[\w.]*$/.test(l)) return false;
      // Engagement counter lines: "2,677 likes, 23 comments", "6.7K views · 1.1K reactions"
      if (/\d[\d,.]*\s*[KkMm]?\s*(likes?|comments?|views?|reactions?|shares?|reposts?|лайк|коммент|просмотр|репост)/i.test(l)) return false;
      // Standalone metric lines: "6.7K", "1,234"
      if (/^[\d][0-9,.KkMm\s]*$/.test(l)) return false;
      // Platform label lines: "Instagram Reel", "TikTok video", "Facebook"
      if (/^(instagram|tiktok|facebook|youtube)\s*(reel|reels|video|post|story)?$/i.test(l)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

// Trim a raw text block down to a short introductory description (2 sentences max, 300 chars max).
// Prevents full recipe text blobs from being stored in the description field.
function extractIntro(text: string, maxSentences = 2): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .slice(0, maxSentences)
    .join(' ')
    .slice(0, 300)
    .trim();
}

// Strip junk from any title: @handles, platform labels, engagement suffixes, extra whitespace.
function sanitizeTitle(raw: string): string {
  return raw
    .split('\n')[0]                                                                      // first line only
    .replace(/@\w[\w.]*\b/g, '')                                                         // remove @handles
    .replace(/\s*[|\-–—]\s*(instagram|tiktok|facebook|youtube|vk|ok\.ru)\b.*/gi, '')    // strip "| Platform" suffixes
    .replace(/^(instagram\s*(reel|reels|video)?|tiktok\s*video?|facebook\s*(video|reel)?|youtube\s*video?)[:\s\-–—]*/gi, '') // strip platform prefixes
    .replace(/\s*[\d,.]+[KkMm]?\s*(views?|likes?|comments?)\s*$/gi, '')                 // strip trailing metrics
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 150);
}

// Extract a numeric nutrient value from the nutrition object by field name
function extractNutrient(nutrition: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!nutrition) return undefined;
  const raw = nutrition[key];
  if (raw === undefined || raw === null) return undefined;
  const m = String(raw).replace(',', '.').match(/[\d.]+/);
  return m ? Math.round(Number(m[0])).toString() : undefined;
}

// Optional OpenAI structuring — returns null when key is absent or text too short.
// Gracefully degrades: if called without OPENAI_API_KEY the function still works via regex.
async function tryLlmStructure(
  rawText: string,
  targetLang: string,
): Promise<{ title?: string; description?: string; ingredients: string[]; instructions: string[] } | null> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key || rawText.length < 50) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `You are a recipe extraction assistant.
Extract ONLY recipe content from the text below. Ignore all social media metadata (likes, views, comments, shares, follower counts, platform names like "Instagram Reel", "TikTok video").

Respond in ${targetLang === 'ru' ? 'Russian' : 'English'}. Translate if the source is in a different language.

Return ONLY valid JSON with these keys:
- title: the dish name ONLY (e.g. "Шоколадное печенье"). Never include author handles (@username), account names, platform labels ("Instagram Reel"), or engagement numbers. If no clear dish name exists, return "".
- description: brief intro / context sentence(s) only (max 2 sentences, or empty string "")
- ingredients: array of strings, each one ingredient with quantity + unit + name, e.g. "200г муки" or "2 яйца"
- instructions: array of strings, each one cooking step in order

If no recipe is found return { "title": "", "description": "", "ingredients": [], "instructions": [] }.
Do not invent data not present in the text.

Text:
${rawText.slice(0, 3000)}`,
        }],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    try {
      return JSON.parse(json.choices[0].message.content);
    } catch { return null; }
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, lang = 'ru' } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSocial = /instagram\.com|tiktok\.com|facebook\.com/i.test(url);
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);

    // ── Social media branch: microlink.io free API for OG metadata ──
    if (isSocial) {
      let mlTitle: string | undefined;
      let mlDesc: string | undefined;
      let mlImage: string | undefined;

      // Primary: microlink.io (bypasses CORS + bot-detection for public posts)
      try {
        const mlRes = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        if (mlRes.ok) {
          const ml = await mlRes.json();
          if (ml.status === 'success') {
            mlTitle = ml.data?.title ?? undefined;
            mlDesc  = ml.data?.description ?? undefined;
            mlImage = ml.data?.image?.url ?? ml.data?.video?.url ?? undefined;
          }
        }
      } catch { /* microlink unavailable — fall through to direct fetch */ }

      // Fallback: direct page fetch for OG tags (works for some FB public pages)
      if (!mlTitle && !mlImage) {
        try {
          const pageRes = await fetchPage(url);
          if (pageRes.ok) {
            const html = await pageRes.text();
            mlTitle = extractMeta(html, 'og:title', 'property')
              ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
            mlDesc  = extractMeta(html, 'og:description', 'property') ?? undefined;
            mlImage = extractMeta(html, 'og:image', 'property')
              ?? extractMeta(html, 'twitter:image', 'name')
              ?? extractMeta(html, 'twitter:image:src', 'name');
          }
        } catch { /* ignore */ }
      }

      // Clean engagement noise then optionally structure via LLM
      const cleanDesc = mlDesc ? cleanSocialText(mlDesc) : '';
      let structured: { title?: string; description?: string; ingredients: string[]; instructions: string[] } | null = null;
      if (cleanDesc.length > 50) {
        structured = await tryLlmStructure(cleanDesc, lang);
      }

      // Regex fallback when LLM is unavailable or returns no ingredients (mirrors YouTube branch)
      const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };
      const finalIngredients = structured?.ingredients?.length ? structured.ingredients : regexResult.ingredients;
      const finalInstructions = structured?.instructions?.length ? structured.instructions : regexResult.instructions;

      const isPartial = !finalIngredients.length;

      return new Response(
        JSON.stringify({
          title: sanitizeTitle((structured?.title && structured.title.trim()) ? structured.title : (mlTitle ?? '')),
          description: structured?.description || extractIntro(cleanDesc),
          categoryHint: '',
          ingredients: finalIngredients,
          instructions: finalInstructions,
          imageUrl: mlImage,
          sourceLang: undefined,
          note: isPartial ? 'partial_social' : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── YouTube branch: oEmbed (reliable) + page description + optional LLM ──
    if (isYouTube) {
      let videoTitle = '';
      let videoThumb: string | undefined;

      // Step 1: oEmbed — always works for public videos, no auth required
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          videoTitle = oembed.title ?? '';
          videoThumb = oembed.thumbnail_url ?? undefined;
        }
      } catch { /* ignore */ }

      // Step 2: page fetch for description (best-effort; JS-heavy pages may be empty)
      let videoDesc = '';
      let sourceLang: string | undefined;
      try {
        const pageRes = await fetchPage(url);
        if (pageRes.ok) {
          const html = await pageRes.text();
          sourceLang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.split('-')[0];

          // VideoObject JSON-LD takes priority
          const ldBlocks = extractLdJsonBlocks(html);
          for (const parsed of ldBlocks) {
            const node = Array.isArray(parsed)
              ? parsed.map(findVideoNode).find(Boolean)
              : findVideoNode(parsed);
            if (node) {
              if (!videoTitle && node.name) videoTitle = stripHtml(String(node.name));
              if (node.description)         videoDesc  = stripHtml(String(node.description));
              if (!videoThumb && node.thumbnailUrl) {
                videoThumb = Array.isArray(node.thumbnailUrl)
                  ? node.thumbnailUrl[node.thumbnailUrl.length - 1]
                  : node.thumbnailUrl;
              }
              break;
            }
          }

          // OG meta fallbacks
          if (!videoDesc)  videoDesc  = extractMeta(html, 'og:description', 'property') ?? '';
          if (!videoTitle) videoTitle = extractMeta(html, 'og:title', 'property')
            ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '';
          if (!videoThumb) videoThumb = extractMeta(html, 'og:image', 'property')
            ?? extractMeta(html, 'twitter:image', 'name');
        }
      } catch { /* page fetch failed — proceed with oEmbed data only */ }

      // Step 3: clean noise then structure (LLM if available, regex fallback)
      const cleanDesc = cleanSocialText(videoDesc);
      const llmResult = cleanDesc ? await tryLlmStructure(cleanDesc, lang) : null;
      const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };

      const finalIngredients = llmResult?.ingredients?.length ? llmResult.ingredients : regexResult.ingredients;
      const finalInstructions = llmResult?.instructions?.length ? llmResult.instructions : regexResult.instructions;
      const finalTitle = (llmResult?.title && llmResult.title.trim()) ? llmResult.title : videoTitle;
      const finalDescription = llmResult?.description ?? cleanDesc;

      return new Response(
        JSON.stringify({
          title: sanitizeTitle(finalTitle),
          description: finalDescription,
          categoryHint: '',
          ingredients: finalIngredients,
          instructions: finalInstructions,
          imageUrl: videoThumb,
          sourceLang,
          note: (!finalIngredients.length && !finalInstructions.length) ? 'partial_social' : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch the page (generic path) ──
    let html = '';
    try {
      const pageRes = await fetchPage(url);
      if (pageRes.ok) {
        html = await pageRes.text();
      } else {
        return new Response(
          JSON.stringify({ error: `Failed to fetch page: ${pageRes.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Network error fetching page' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Detect page language from <html lang="...">
    const sourceLang = html
      ? html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.split('-')[0]
      : undefined;

    const ldBlocks = html ? extractLdJsonBlocks(html) : [];

    // Shared OG/Twitter meta extraction
    const ogTitle   = html ? extractMeta(html, 'og:title', 'property') : undefined;
    const ogDesc    = html ? extractMeta(html, 'og:description', 'property') : undefined;
    const ogImage   = html ? extractMeta(html, 'og:image', 'property') : undefined;
    const twImage   = html
      ? (extractMeta(html, 'twitter:image', 'name') ?? extractMeta(html, 'twitter:image:src', 'name'))
      : undefined;
    const pageTitle = html ? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] : undefined;

    // ── Generic path: look for schema.org Recipe in JSON-LD ──
    let recipe: Record<string, unknown> | null = null;
    for (const parsed of ldBlocks) {
      const found = Array.isArray(parsed)
        ? parsed.map(findRecipeNode).find(Boolean)
        : findRecipeNode(parsed);
      if (found) { recipe = found; break; }
    }

    if (!recipe) {
      // No Recipe JSON-LD — return whatever OG tags exist
      if (ogTitle || pageTitle) {
        return new Response(
          JSON.stringify({
            title: ogTitle ?? pageTitle ?? '',
            description: ogDesc ?? '',
            ingredients: [],
            instructions: [],
            categoryHint: '',
            imageUrl: ogImage ?? twImage,
            sourceLang,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ error: 'No recipe data found on this page' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Extract Recipe fields ──
    const title = sanitizeTitle(stripHtml(String(recipe.name ?? ogTitle ?? '')));
    const description = recipe.description
      ? stripHtml(String(recipe.description))
      : ogDesc;
    const categoryHint = Array.isArray(recipe.recipeCategory)
      ? recipe.recipeCategory[0]
      : (recipe.recipeCategory ?? '');
    const ingredients: string[] = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.map((i: unknown) => stripHtml(String(i)))
      : [];
    const instructions: string[] = flattenInstructions(recipe.recipeInstructions);

    // ── Nutrition: calories + КБЖУ ──
    const nutrition = recipe.nutrition as Record<string, unknown> | undefined;

    let calories: string | undefined = extractNutrient(nutrition, 'calories') ?? extractNutrient(nutrition, 'calorie');
    if (!calories) {
      const m = html.match(/[Кк]алории[иийь]?\s*([\d,.]+)\s*[кКkK][кКkK]?[аАaA][лЛlL]/);
      if (m) calories = Math.round(Number(m[1].replace(',', '.'))).toString();
    }
    if (!calories) {
      const m = html.match(/([\d]+[,.]?[\d]*)\s*[кКkK]{1,2}[аАaA][лЛlL]/);
      if (m) calories = Math.round(Number(m[1].replace(',', '.'))).toString();
    }

    let protein: string | undefined = extractNutrient(nutrition, 'proteinContent');
    if (!protein) {
      const m = html.match(/белк[иа][^<]{0,20}?([\d,.]+)/i);
      if (m) protein = Math.round(Number(m[1].replace(',', '.'))).toString();
    }

    let fat: string | undefined = extractNutrient(nutrition, 'fatContent');
    if (!fat) {
      const m = html.match(/жир[ыа][^<]{0,20}?([\d,.]+)/i);
      if (m) fat = Math.round(Number(m[1].replace(',', '.'))).toString();
    }

    let carbs: string | undefined = extractNutrient(nutrition, 'carbohydrateContent');
    if (!carbs) {
      const m = html.match(/углевод[ыа][^<]{0,20}?([\d,.]+)/i);
      if (m) carbs = Math.round(Number(m[1].replace(',', '.'))).toString();
    }

    // ── Servings ──
    const servings = recipe.recipeYield
      ? Array.isArray(recipe.recipeYield)
        ? String(recipe.recipeYield[0])
        : String(recipe.recipeYield)
      : undefined;

    // ── Image: JSON-LD → og:image → twitter:image ──
    let imageUrl: string | undefined;
    if (recipe.image) {
      if (Array.isArray(recipe.image)) {
        for (const img of [...(recipe.image as unknown[])].reverse()) {
          imageUrl = extractImageUrl(img);
          if (imageUrl) break;
        }
      } else {
        imageUrl = extractImageUrl(recipe.image);
      }
    }
    if (!imageUrl) {
      imageUrl =
        extractMeta(html, 'og:image', 'property') ??
        extractMeta(html, 'twitter:image', 'name') ??
        extractMeta(html, 'twitter:image:src', 'name') ??
        ogImage ??
        twImage;
    }

    return new Response(
      JSON.stringify({
        title,
        description,
        categoryHint: String(categoryHint),
        ingredients,
        instructions,
        calories,
        protein,
        fat,
        carbs,
        servings,
        imageUrl,
        sourceLang,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
