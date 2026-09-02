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

const JUNK_IMAGE_RE =
  /emoji\.php|rsrc\.php|sprite|favicon|\.ico(\?|$)|pixel|1x1|tracking|gravatar|doubleclick|adservice|logo[-_./]|avatar|wp-includes\/images/i;
const TINY_IMAGE_RE = /-\d{2,3}x\d{2,3}\.(jpe?g|png|webp|gif)(\?|$)/i;

function isUsableImageUrl(src: unknown): src is string {
  if (typeof src !== 'string') return false;
  const s = src.trim();
  if (!s || s === 'NaN' || /nan/i.test(s) && !/https?:/i.test(s)) return false;
  if (!/^(https?:)?\/\//i.test(s) && !s.startsWith('/')) return false;
  if (/NaNxNaN|[?&](?:w|h|width|height)=NaN/i.test(s)) return false;
  if (JUNK_IMAGE_RE.test(s)) return false;
  if (/^data:/i.test(s) && !/^data:image\/(jpeg|jpg|png|webp|gif)/i.test(s)) return false;
  return true;
}

function absolutizeUrl(src: string, pageUrl?: string): string {
  try {
    if (src.startsWith('//')) return `https:${src}`;
    if (pageUrl) return new URL(src, pageUrl).href;
  } catch { /* keep as-is */ }
  return src;
}

function htmlAttr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
}

function pickLargestSrcset(srcset: string, pageUrl?: string): string | undefined {
  const parts = srcset.split(',').map((part) => {
    const [u, w] = part.trim().split(/\s+/);
    return { u, width: w?.endsWith('w') ? parseInt(w, 10) || 0 : 0 };
  }).filter((p) => isUsableImageUrl(p.u));
  parts.sort((a, b) => b.width - a.width);
  const best = parts.find((p) => !TINY_IMAGE_RE.test(p.u)) ?? parts[0];
  return best?.u ? absolutizeUrl(best.u, pageUrl) : undefined;
}

function srcFromImgTag(tag: string, pageUrl?: string): string | undefined {
  const srcset = htmlAttr(tag, 'srcset') ?? htmlAttr(tag, 'data-srcset');
  if (srcset) {
    const fromSet = pickLargestSrcset(srcset, pageUrl);
    if (fromSet) return fromSet;
  }
  const src =
    htmlAttr(tag, 'data-src') ??
    htmlAttr(tag, 'data-lazy-src') ??
    htmlAttr(tag, 'data-full-url') ??
    htmlAttr(tag, 'data-orig-file') ??
    htmlAttr(tag, 'src');
  return isUsableImageUrl(src) ? absolutizeUrl(src, pageUrl) : undefined;
}

// WordPress / microdata / lazy-load photos when the page has no og:image or JSON-LD.
function extractPageImage(html: string, pageUrl?: string): string | undefined {
  const metaItem =
    html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["']/i)?.[1];
  if (isUsableImageUrl(metaItem)) return absolutizeUrl(metaItem, pageUrl);

  const link =
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i)?.[1];
  if (isUsableImageUrl(link)) return absolutizeUrl(link, pageUrl);

  const featured =
    html.match(/<img\b[^>]*class=["'][^"']*wp-post-image[^"']*["'][^>]*>/i)?.[0] ??
    html.match(/<img\b[^>]*itemprop=["']image["'][^>]*>/i)?.[0] ??
    html.match(/<img\b[^>]*class=["'][^"']*wprm-recipe-image[^"']*["'][^>]*>/i)?.[0];
  if (featured) {
    const src = srcFromImgTag(featured, pageUrl);
    if (src) return src;
  }

  const scope =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<(?:div|figure)[^>]*class=["'][^"']*(?:post-thumbnail|entry-content|recipe-image)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|figure)>/i)?.[0] ??
    html;
  for (const m of scope.matchAll(/<img\b[^>]*>/gi)) {
    const src = srcFromImgTag(m[0], pageUrl);
    if (!src || TINY_IMAGE_RE.test(src)) continue;
    if (/wp-content\/uploads|\.(jpe?g|png|webp)(\?|$)/i.test(src)) return src;
  }
  return undefined;
}

// Extract URL from a schema.org image value (string, ImageObject, or similar)
function extractImageUrl(img: unknown, pageUrl?: string): string | undefined {
  if (typeof img === 'string') {
    return isUsableImageUrl(img) ? absolutizeUrl(img, pageUrl) : undefined;
  }
  if (Array.isArray(img)) {
    for (const item of img) {
      const found = extractImageUrl(item, pageUrl);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof img === 'object' && img !== null) {
    const o = img as Record<string, unknown>;
    return extractImageUrl(o.url ?? o.contentUrl ?? o.thumbnailUrl, pageUrl);
  }
  return undefined;
}

// Facebook serves meta tags with every non-ASCII character escaped ("&#x442;&#x44b;&#x441;"),
// so the raw attribute value is unreadable to both the parser and the model.
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

// Extract og/twitter meta from HTML (handles both attribute orders)
function extractMeta(html: string, property: string, attr: 'property' | 'name'): string | undefined {
  const a = attr;
  const raw =
    html.match(new RegExp(`<meta[^>]+${a}=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${a}=["']${property}["']`, 'i'))?.[1];
  return raw ? decodeEntities(raw) : undefined;
}

// Normalise a locale tag ("de_DE", "de-DE", "DE") to a bare language code ("de")
function normalizeLang(raw: string | undefined): string | undefined {
  return raw?.trim().toLowerCase().split(/[-_]/)[0] || undefined;
}

// Page language from whatever signal the site exposes. Some sites (chefkoch.de) expose
// none at all, so callers must fall back to needsTranslation() on the extracted text.
function detectSourceLang(html: string): string | undefined {
  if (!html) return undefined;
  return normalizeLang(
    html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ??
      extractMeta(html, 'og:locale', 'property') ??
      html.match(/<meta[^>]+http-equiv=["']content-language["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+http-equiv=["']content-language["']/i)?.[1],
  );
}

// Whether text still needs translating into the app language. Language metadata is
// unreliable, so this inspects the script of the text itself: a Russian target with
// almost no Cyrillic means the recipe is foreign. Short samples return false to avoid
// pointless LLM calls. Cannot detect Latin-to-Latin cases (German into English) — those
// rely on the sourceLang signal instead.
function needsTranslation(sample: string, targetLang: string): boolean {
  const cyrillic = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  const letters = cyrillic + latin;
  if (letters < 20) return false;
  const cyrillicShare = cyrillic / letters;
  return targetLang === 'ru' ? cyrillicShare < 0.3 : cyrillicShare > 0.3;
}

// One source must not eat the Edge Function wall clock (~150s). Keep each fetch short so
// Microlink, the page, Jina and the HTML proxy can all run in one request.
const SOURCE_TIMEOUT_MS = 12000;

function browserHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  };
}

async function fetchPage(url: string): Promise<Response> {
  return fetch(url, {
    headers: browserHeaders(),
    redirect: 'follow',
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
}

function isFacebookUrl(u: string): boolean {
  return /facebook\.com|fb\.watch/i.test(u);
}

function facebookCanonicalUrl(u: string): string {
  try {
    const parsed = new URL(u);
    if (!/facebook\.com/i.test(parsed.hostname)) return u;
    if (!/\/login/i.test(parsed.pathname)) return u;
    const next = parsed.searchParams.get('next');
    if (!next) return u;
    const decoded = decodeURIComponent(next);
    if (/^https?:\/\/([^/]+\.)?facebook\.com/i.test(decoded)) return decoded;
    if (decoded.startsWith('/')) return `https://www.facebook.com${decoded}`;
    return u;
  } catch {
    return u;
  }
}

function toMbasicFacebookUrl(u: string): string {
  try {
    const parsed = new URL(u);
    parsed.hostname = 'mbasic.facebook.com';
    return parsed.href;
  } catch {
    return u.replace(/^(https?:\/\/)(?:www\.|m\.)?facebook\.com/i, '$1mbasic.facebook.com');
  }
}

async function resolveFacebookUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: browserHeaders(),
      redirect: 'follow',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return facebookCanonicalUrl(res.url || url);
  } catch {
    return url;
  }
}

async function fetchFacebookOembed(
  url: string,
): Promise<{ text?: string; author?: string } | undefined> {
  const endpoints = [
    `https://www.facebook.com/plugins/post/oembed.json?url=${encodeURIComponent(url)}`,
    `https://www.facebook.com/plugins/video/oembed.json?url=${encodeURIComponent(url)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      });
      if (!res.ok) {
        await res.body?.cancel();
        continue;
      }
      const data = await res.json() as { html?: string; author_name?: string; title?: string };
      const html = String(data.html ?? '');
      const quoted = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1]
        ?? html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
        ?? '';
      const text = stripHtml(quoted).replace(/\s+/g, ' ').trim();
      if (text && !isLoginWallText(text) && !looksLikeFacebookChrome(text)) {
        return { text, author: data.author_name ?? data.title };
      }
    } catch { /* try next endpoint */ }
  }
  return undefined;
}

function facebookReadError(lang: string): string {
  return lang === 'ru'
    ? 'Facebook не отдал текст поста — страница входа или закрытый пост. Скопируйте рецепт и добавьте вручную.'
    : 'Facebook did not return the post text — login wall or a private post. Copy the recipe and add it manually.';
}

// Video id from any YouTube URL shape, ignoring tracking params such as &si= and &t=
function extractYouTubeId(url: string): string | undefined {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return undefined;
}

// Official YouTube Data API v3 — the primary description source. Scraping the watch page
// is unreliable from Supabase because YouTube serves datacenter IPs a bot-check page with
// no embedded player JSON. videos.list with part=snippet costs 1 unit of the free 10k/day.
async function fetchYouTubeViaApi(videoId: string): Promise<
  { title?: string; description?: string; thumbnail?: string; sourceLang?: string } | null
> {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return null;

  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/videos' +
        `?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) },
    );
    if (!res.ok) {
      console.error('[youtube] data api failed', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snippet = json?.items?.[0]?.snippet as any;
    if (!snippet) {
      console.error('[youtube] data api returned no items for', videoId);
      return null;
    }
    const t = snippet.thumbnails ?? {};
    return {
      title: snippet.title ?? undefined,
      description: snippet.description ?? undefined,
      thumbnail: (t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default)?.url,
      sourceLang: normalizeLang(snippet.defaultAudioLanguage ?? snippet.defaultLanguage),
    };
  } catch (err) {
    console.error('[youtube] data api threw', err);
    return null;
  }
}

// The full video description lives in the embedded player JSON, not in og:description
// (which YouTube truncates). Reads ytInitialPlayerResponse.videoDetails.shortDescription.
function extractYouTubeDescription(html: string): string {
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (!m) return '';
  try {
    return JSON.parse(`"${m[1]}"`); // decodes \n, \", \uXXXX
  } catch {
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
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

// Measurement units (RU + EN). Uses negative lookbehind instead of \b so it matches after stripped emoji.
const MEASURE = /(?<!\w)(?:\d+[.,]?\d*\s*)?(щепотк[а-яё]*|pinch(?:es)?)\b|(?<!\w)\d+[.,]?\d*\s*(г|гр|кг|мл|л|шт|ст\.?\s*л\.?|ч\.?\s*л\.?|стакан|стак|g|kg|ml|oz|lb|cup|tbsp|tsp|pcs|piece)\b/i;

const FB_SLOGAN_RE =
  /^(facebook|log\s*in(?:to\s+facebook)?|explore what you love|исследуйте (?:то, что|вещи, которые) вы любите|войти(?:\s+на\s+facebook)?|вхід)$/i;

const FB_LOGIN_HINTS = [
  /электронная почта или номер/i,
  /email or (phone|mobile)/i,
  /forgot (account|password)/i,
  /create new account/i,
  /log into facebook/i,
  /войдите.{0,40}facebook/i,
  /забыли аккаунт/i,
  /создать новый аккаунт/i,
  /explore what you love/i,
  /исследуйте (?:то, что|вещи, которые) вы любите/i,
];

function looksLikeFacebookChrome(s?: string): boolean {
  if (!s) return false;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return t.length < 80 && FB_SLOGAN_RE.test(t);
}

function isLoginWallLine(s: string): boolean {
  return FB_LOGIN_HINTS.some((re) => re.test(s));
}

function isLoginWallText(s?: string): boolean {
  if (!s) return false;
  const hits = FB_LOGIN_HINTS.filter((re) => re.test(s)).length;
  return hits >= 2 || (hits >= 1 && s.length < 1200);
}

function isJunkIngredient(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const leftover = t
    .replace(/^\d+[.,]?\d*\s*(шт|pcs|piece|г|гр|кг|мл|л)?\s*/i, '')
    .replace(/[\s\[\]x*·•._-]/gi, '');
  return leftover.length < 2;
}

// Every emoji codepoint, including skin-tone modifiers, flag pairs, keycap combining marks,
// zero-width joiners and variation selectors. Deliberately does not touch degree signs,
// fraction glyphs, umlauts or Cyrillic, which recipes need.
// The joiner must be part of the class: without it a sequence like "👩‍🍳" only strips down to
// its first codepoint, which is enough to stop a header like "👩‍🍳 Приготовление:" matching.
const EMOJI_CHARS =
  '\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\p{Regional_Indicator}\\uFE0F\\u200D\\u20E3\\u{1F3FB}-\\u{1F3FF}';

const EMOJI_ANY = new RegExp(`[${EMOJI_CHARS}]`, 'gu');

// Leading emoji only — used to strip social-media emoji bullets before line classification,
// while still recording that a bullet was there.
const EMOJI_RE = new RegExp(`^[${EMOJI_CHARS}]+\\s*`, 'u');

// Geometric Shapes block: decorative bullets such as "▪ Portionsrechner" or "► Kochbuch"
// that sites put in og:description. Not covered by Extended_Pictographic, and no recipe
// text ever needs them.
const DECOR_RE = /[\u25A0-\u25FF]/g;

function stripEmoji(s: string): string {
  return s
    .replace(EMOJI_ANY, '')
    .replace(DECOR_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Single exit point for text cleanup so every source (social, YouTube, generic) behaves
// identically. Runs after translation, since the translator preserves source emoji.
function cleanTexts(v: {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}): { title: string; description: string; ingredients: string[]; instructions: string[] } {
  return {
    title: stripEmoji(v.title),
    description: stripEmoji(v.description),
    ingredients: v.ingredients.map(stripEmoji).filter(Boolean),
    instructions: v.instructions.map(stripEmoji).filter(Boolean),
  };
}

// Cooking action verbs (RU + EN)
const COOK_VERB = /\b(смешай|добавь|нарежь|взбей|выпекай|обжарь|разогрей|залей|посоли|посыпь|перемешай|вылей|соедини|раскатай|запекай|варить|тушить|кипятить|измельчи|натри|mix|add|bake|cook|stir|whisk|combine|heat|pour|chop|blend|fold|season|preheat)\b/i;

// Parse plain-text description to extract ingredients and steps using heuristic line classification.
// Works without explicit section headers — classifies each line by its content pattern.
// Leading emoji are stripped before classification so that lines like "🍌 2 банана" are recognised.
function parseDescriptionText(text: string): { ingredients: string[]; instructions: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let mode: 'none' | 'ing' | 'steps' = 'none';

  for (const line of lines) {
    // Strip leading emoji to normalise patterns like "🍌 2 банана" or "🍽 Приготовление:"
    const stripped = line.replace(EMOJI_RE, '');

    // Section headers → switch mode, don't include the header text itself
    if (/^(ингредиент|состав|продукт|ingredient)/i.test(stripped) && stripped.length < 50) {
      mode = 'ing'; continue;
    }
    if (/^(приготовлени|шаги|процесс|инструкц|способ|метод|steps?|directions?|method|how\s+to)/i.test(stripped) && stripped.length < 60) {
      mode = 'steps'; continue;
    }

    const isBullet    = /^[-•*✓▪▸→]\s/.test(stripped);
    const isNumbered  = /^\d+[.)]\s/.test(stripped);
    const hasMeasure  = MEASURE.test(stripped);
    const hasCookVerb = COOK_VERB.test(stripped);
    // A line that starts with a digit + unit (after emoji strip) counts as an ingredient bullet
    const isEmojiBullet = stripped !== line; // leading emoji was present

    if (mode === 'ing') {
      // Accept bullets, numbered lines, emoji-prefixed lines, or lines with measurements
      if (isBullet || isNumbered || hasMeasure || isEmojiBullet) {
        const item = stripped.replace(/^[-•*✓▪▸→]\s*/, '').replace(/^\d+[.)]\s*/, '');
        if (!isJunkIngredient(item)) ingredients.push(item);
        continue;
      }
      // Line looks like a step — switch modes
      if (hasCookVerb || (isNumbered && stripped.length > 30)) {
        mode = 'steps';
        instructions.push(stripped.replace(/^\d+[.)]\s*/, ''));
        continue;
      }
    }

    if (mode === 'steps') {
      if (isBullet || isNumbered || hasCookVerb || stripped.length > 25) {
        instructions.push(stripped.replace(/^\d+[.)]\s*/, '').replace(/^[-•*✓▪▸→]\s*/, ''));
        continue;
      }
    }

    // No explicit mode yet — classify by content heuristic
    if (mode === 'none') {
      if ((isBullet || hasMeasure || isEmojiBullet) && !hasCookVerb) {
        const item = stripped.replace(/^[-•*✓▪▸→]\s*/, '').replace(/^\d+[.)]\s*/, '');
        if (!isJunkIngredient(item)) {
          mode = 'ing';
          ingredients.push(item);
        }
      } else if ((isNumbered && hasCookVerb) || (isNumbered && stripped.length > 40)) {
        mode = 'steps';
        instructions.push(stripped.replace(/^\d+[.)]\s*/, ''));
      }
      // else: intro/description text — not captured into either array
    }
  }

  return { ingredients, instructions };
}

// Remove social-media engagement noise from raw text before parsing or sending to LLM.
// Emoji are deliberately left in place here: parseDescriptionText treats a leading emoji or
// symbol bullet as its main "this line is an ingredient" signal, and captions routinely mark
// ingredients that way. They are stripped later by cleanTexts, once classification is done.
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
      if (looksLikeFacebookChrome(l) || isLoginWallLine(l)) return false;
      // Call-to-action lines: "Обязательно подпишись на ...", "Follow us for more recipes"
      if (/(подпишись|подпишитесь|подписывайся|подписывайтесь|ставь\s+лайк|ставьте\s+лайк|subscribe|follow\s+(me|us)|link\s+in\s+bio|ссылка\s+в\s+(шапке|био))/i.test(l)) return false;
      // Instagram / Facebook comment chrome dumped into the caption by the reader
      if (/^(Reply|Ответить|Like|Нравится|View replies|View more comments)$/i.test(l)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

// og:title on Facebook and Instagram carries the entire post caption wrapped in platform
// chrome: "6.7K views · 1.1K reactions | <caption> | Page name". Unwrap it without truncating,
// unlike sanitizeTitle which keeps only the first line and caps the result at 150 chars.
// The magnitude is spelled out on localised pages ("2,2 тыс. просмотров"), so it has to be part
// of the pattern or the counter survives and lands in the recipe title.
const LEADING_METRIC_RE =
  /^[\d,.]+\s*(?:[KkMm]|тыс\.?|млн\.?|Tsd\.?|Mio\.?)?\s*(views?|reactions?|likes?|comments?|shares?|просмотр\p{L}*|реакци\p{L}*|лайк\p{L}*|коммент\p{L}*|репост\p{L}*)\s*[·•|,\-–—]\s*/iu;

// Facebook sometimes answers a /watch link with a redirect stub whose <title> is nothing but the
// query string ("?ref=saved&v=884858394013603"), and microlink passes that through as the title.
// Left alone it becomes the recipe name.
function looksLikeUrlJunk(raw: string, sourceUrl: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (/^[?&#/]/.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (!/\s/.test(s) && /[=&]/.test(s)) return true;
  return !/\s/.test(s) && sourceUrl.includes(s);
}

// Group and page posts prefix the caption with the community name: "Все Мы Кулинахеры | <caption>".
// Only drop the prefix when what follows is longer, so a real title is never mistaken for chrome.
function stripLeadingOwner(s: string): string {
  const m = s.match(/^([^|\n]{1,60})\s*\|\s*([\s\S]+)$/);
  if (!m) return s;
  const owner = m[1].trim();
  const rest = m[2].trim();
  return rest.length > owner.length ? rest : s;
}

// Instagram OG wraps the caption as: `6,522 likes, 66 comments - user on August 23, 2026: "…"`.
// Without unwrapping, likes/date chrome and the quoted dish name stay glued together.
function unwrapSocialQuote(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  const head = s.slice(0, 100);
  if (!/\b(likes?|comments?|views?|лайк|коммент|просмотр)/i.test(head)) return s;
  const quoted = s.match(/:\s*[«"'“”]([\s\S]+?)[»"'“”]\s*\.?\s*$/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const afterDate = s.match(/\bon\s+\p{L}+\s+\d{1,2},?\s+\d{4}:\s*([\s\S]+)$/iu);
  if (afterDate?.[1]?.trim()) {
    return afterDate[1].replace(/^[«"'“”]|[»"'“”]\.?$/g, '').trim();
  }
  return s;
}

function stripMetaChrome(raw: string): string {
  let s = unwrapSocialQuote(raw.trim());
  while (LEADING_METRIC_RE.test(s)) s = s.replace(LEADING_METRIC_RE, '');
  s = s
    .replace(/^.+?\s+on\s+(instagram|facebook|tiktok)\s*:\s*[«"'`]?/i, '')
    .replace(/@\w[\w.]*\b/g, '')
    .replace(/\s*\|\s*[^|\d\n]{1,40}$/, '');
  return stripLeadingOwner(s)
    .replace(/[«"'`]\s*$/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const LEADING_EMOJI_RE = new RegExp(`^[${EMOJI_CHARS}]+`, 'u');

// Section headers used by captions to separate the ingredient list from the method.
const CAPTION_SECTION_RE =
  /[ \t]*((?:СПОСОБ\s+)?(?:ИНГРЕДИЕНТ|СОСТАВ|ПРОДУКТ|ПРИГОТОВЛЕНИ|ИНСТРУКЦИ|ШАГ)\p{L}*|INGREDIENTS|METHOD|DIRECTIONS|INSTRUCTIONS|PREPARATION|ZUTATEN|ZUBEREITUNG)[ \t]*:/giu;

// Emoji that the caption actually uses as a list marker. Learned from line starts so that a
// mid-sentence emoji ("хотя их я тоже люблю👍 Основные ингредиенты...") is not mistaken for one
// and does not chop the intro into fake ingredients.
function detectBulletMarkers(text: string): string[] {
  const atLineStart = new Map<string, number>();
  for (const line of text.split('\n')) {
    const m = line.trim().match(LEADING_EMOJI_RE);
    if (m) atLineStart.set(m[0], (atLineStart.get(m[0]) ?? 0) + 1);
  }
  const learned = [...atLineStart].filter(([, n]) => n >= 2).map(([m]) => m);
  if (learned.length) return learned;
  // Caption arrived as a single line, so there are no line starts to learn from: fall back to
  // any emoji repeated often enough to be a marker rather than decoration.
  const counts = new Map<string, number>();
  for (const ch of text.match(EMOJI_ANY) ?? []) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 3).map(([m]) => m);
}

// Facebook group posts truncate the caption in og:title *and* og:description, so the recipe is
// simply not in the metadata. r.jina.ai renders the page and returns its text, keyless and free,
// which is the only remaining way to reach the full post without scraping credentials.
const READER_ENDPOINT = 'https://r.jina.ai/';

// Surfaced to the caller as `readerError` so a rate limit is distinguishable from "the post
// really had no recipe text".
let readerDiag: string | undefined;

// Everything below the reaction bar is comments and the login wall, never the post itself.
const READER_TAIL_RE =
  /\n\s*(All reactions:|Most relevant|Newest|View more comments|See more on Facebook|See more posts)/;

const READER_ENVELOPE_RE = /^(title|url source|published time|markdown content|content|warning):/i;

const READER_NAV_RE =
  /^(log in|log into facebook|forgot account\?|forgot password\?|join|like|comment|share|follow|create new account|or|·|электронная почта или номер.*|войти|забыли аккаунт\??)$/i;

const READER_MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)';

// Facebook prints the post date right above the caption ("· May 17 ·", "· 11w ·"); everything
// above that line is the group name, the author and navigation chrome.
const READER_DATE_LINE_RE = new RegExp(
  `^·?\\s*(?:${READER_MONTH}\\p{L}*\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+${READER_MONTH}\\p{L}*(?:\\s+\\d{4})?|\\d+\\s*[wdhm]|yesterday|вчера)\\s*·?$`,
  'iu',
);

// Emoji sprites, favicons and UI chrome are images too, so a post photo has to be recognised
// by its CDN host rather than by being the first image on the page.
const READER_IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

function pickPostImage(postSection: string): string | undefined {
  let fallback: string | undefined;
  for (const m of postSection.matchAll(READER_IMAGE_RE)) {
    const src = m[1];
    if (!isUsableImageUrl(src) || TINY_IMAGE_RE.test(src)) continue;
    if (/scontent|fbcdn|cdninstagram|tiktokcdn/i.test(src)) return src;
    if (/wp-content\/uploads|\.(jpe?g|png|webp)(\?|$)/i.test(src)) {
      fallback ??= src;
    }
  }
  return fallback;
}

function extractPostText(raw: string): { text: string; image?: string } {
  let s = raw;
  const marker = s.indexOf('Markdown Content:');
  if (marker >= 0) s = s.slice(marker + 'Markdown Content:'.length);
  s = s.split(READER_TAIL_RE)[0];

  const image = pickPostImage(s);

  const lines = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // images, including the emoji sprites Facebook uses
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep only their text
    .split('\n')
    .map((l) => l.replace(/^#{1,6}\s*/, '').replace(/\s{2,}/g, ' ').trim())
    .filter((l) => l && !READER_NAV_RE.test(l) && !READER_ENVELOPE_RE.test(l));

  const dateIdx = lines.findIndex((l) => READER_DATE_LINE_RE.test(l));
  const text = (dateIdx >= 0 && dateIdx < 10 ? lines.slice(dateIdx + 1) : lines).join('\n').trim();
  return { text, image };
}

// The keyless tier is rate limited per IP and Supabase egress is shared with other projects, so
// a 429 here is routine rather than fatal. Waiting it out is worth far more than a fast failure,
// but five long attempts used to consume the whole Edge Function budget before Groq could run.
// Three shorter tries leave room for the HTML proxy and the LLM. Setting the optional
// JINA_API_KEY secret (free at jina.ai) raises the limit and makes retries rare:
//   npx supabase secrets set JINA_API_KEY=... --project-ref pkxsthreznxgmhgdewic
const READER_ATTEMPTS = 3;
const READER_BACKOFF_MS = [3000, 6000, 10000];
const READER_TIMEOUT_MS = 15000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchReaderText(url: string): Promise<{ text: string; image?: string } | undefined> {
  const jinaKey = Deno.env.get('JINA_API_KEY');
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
  if (jinaKey) headers.Authorization = `Bearer ${jinaKey}`;

  for (let attempt = 1; attempt <= READER_ATTEMPTS; attempt++) {
    const retryIn = READER_BACKOFF_MS[attempt - 1];
    try {
      const res = await fetch(READER_ENDPOINT + url, {
        headers,
        signal: AbortSignal.timeout(READER_TIMEOUT_MS),
      });

      if (res.status === 429 || res.status >= 500) {
        await res.body?.cancel();
        readerDiag = jinaKey
          ? `reader_http_${res.status}`
          : `reader_http_${res.status}_no_jina_key`;
        if (retryIn) {
          console.error(`[reader] throttled (${res.status}), attempt ${attempt}, waiting ${retryIn}ms`);
          await sleep(retryIn);
          continue;
        }
        return undefined;
      }

      if (!res.ok) {
        await res.body?.cancel();
        readerDiag = `reader_http_${res.status}`;
        return undefined;
      }

      const parsed = extractPostText(await res.text());
      if (parsed.text) {
        readerDiag = undefined;
        return parsed;
      }
      readerDiag = 'reader_empty';
      return undefined;
    } catch (err) {
      readerDiag = `reader_exception: ${String(err).slice(0, 120)}`;
      if (retryIn) {
        await sleep(retryIn);
        continue;
      }
      return undefined;
    }
  }
  return undefined;
}

// Keyless HTML proxies used only after Jina has nothing left to give. They are slower and
// less clean than r.jina.ai, but they do not share Jina's per-IP quota.
const PROXY_URLS = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchProxyHtml(url: string): Promise<string | undefined> {
  for (const make of PROXY_URLS) {
    try {
      const res = await fetch(make(url), {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      });
      if (!res.ok) {
        await res.body?.cancel();
        readerDiag = `proxy_http_${res.status}`;
        continue;
      }
      const html = await res.text();
      if (html.length > 400) {
        readerDiag = undefined;
        return html;
      }
    } catch (err) {
      readerDiag = `proxy_exception: ${String(err).slice(0, 120)}`;
    }
  }
  return undefined;
}

function htmlToCaption(html: string, pageUrl?: string): { text: string; image?: string } {
  const text = extractArticleText(html);
  const image =
    extractMeta(html, 'og:image', 'property') ??
    extractMeta(html, 'og:image:url', 'property') ??
    extractMeta(html, 'og:image:secure_url', 'property') ??
    extractMeta(html, 'twitter:image', 'name') ??
    extractMeta(html, 'twitter:image:src', 'name') ??
    extractPageImage(html, pageUrl);
  return { text, image };
}

// Jina first, then a keyless HTML proxy. Callers treat this as one "reader" step so a
// partial card is never returned while either source is still untried.
async function fetchFullText(
  url: string,
): Promise<{ text: string; image?: string; html?: string } | undefined> {
  const jina = await fetchReaderText(url);
  const jinaDiag = readerDiag;
  if (jina?.text && jina.text.length > 80) return jina;

  const html = await fetchProxyHtml(url);
  if (!html) {
    readerDiag = [jinaDiag, readerDiag].filter((d, i, arr) => d && arr.indexOf(d) === i).join('|') || jinaDiag;
    return jina?.text ? jina : undefined;
  }

  const fromHtml = htmlToCaption(html, url);
  if (fromHtml.text.length > (jina?.text.length ?? 0)) {
    return { text: fromHtml.text, image: fromHtml.image ?? jina?.image, html };
  }
  return jina?.text ? { ...jina, html } : { text: fromHtml.text, image: fromHtml.image, html };
}

function captionLooksThin(s: string): boolean {
  return !s.trim()
    || /[…]\s*$/.test(s)
    || /\.\.\.\s*$/.test(s)
    || s.length < 200
    || !/\d/.test(s)
    || isLoginWallText(s)
    || looksLikeFacebookChrome(s)
    || looksLikeCommentThread(s);
}

async function structureCaption(
  cleanDesc: string,
  lang: string,
): Promise<{
  structured: { title?: string; description?: string; ingredients: string[]; instructions: string[] } | null;
  ingredients: string[];
  instructions: string[];
  recipes: StructuredRecipe[];
}> {
  const structured = cleanDesc.length > 50 ? await tryLlmStructure(cleanDesc, lang) : null;
  const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };
  const ingredients = structured?.ingredients?.length ? structured.ingredients : regexResult.ingredients;
  const instructions = splitLongSteps(
    structured?.instructions?.length ? structured.instructions : regexResult.instructions,
  );
  const recipes: StructuredRecipe[] = structured?.recipes?.length
    ? structured.recipes.map((recipe, idx) => ({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.length ? recipe.ingredients : (idx === 0 ? regexResult.ingredients : []),
        instructions: splitLongSteps(
          recipe.instructions.length ? recipe.instructions : (idx === 0 ? regexResult.instructions : []),
        ),
      }))
    : [{
        title: structured?.title,
        description: structured?.description,
        ingredients,
        instructions,
      }];
  return {
    structured,
    ingredients,
    instructions,
    recipes,
  };
}

// Social captions come back as one long line where list items are separated by an emoji bullet
// instead of a newline. parseDescriptionText classifies line by line, so put the breaks back.
function splitCaptionLines(text: string): string {
  let out = text;
  for (const marker of detectBulletMarkers(text)) {
    out = out.split(marker).join(`\n${marker}`);
  }
  return out
    .replace(CAPTION_SECTION_RE, '\n$1:\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// The model sometimes returns the whole method as one paragraph. Cooking mode shows a single
// step at a time, so a wall of text there is unusable — split it back on sentence boundaries.
// Requiring a capital letter after the period keeps "1 ст. л. муки" and "2,5 ч." intact.
const STEP_SPLIT_RE = /(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/u;
const STEP_MAX_CHARS = 300;
const STEP_TARGET_CHARS = 140;

function splitLongSteps(steps: string[]): string[] {
  const out: string[] = [];
  for (const step of steps) {
    if (step.length <= STEP_MAX_CHARS) {
      out.push(step);
      continue;
    }
    let buf = '';
    for (const sentence of step.split(STEP_SPLIT_RE)) {
      buf = buf ? `${buf} ${sentence}` : sentence;
      if (buf.length >= STEP_TARGET_CHARS) {
        out.push(buf.trim());
        buf = '';
      }
    }
    const tail = buf.trim();
    if (tail) {
      // A short tail reads better appended to the previous step than as a step of its own
      if (tail.length < 40 && out.length) out[out.length - 1] += ` ${tail}`;
      else out.push(tail);
    }
  }
  return out;
}

// Recipe blogs built on generic WordPress themes — and the content farms that copy them —
// carry no schema.org markup at all: the whole recipe sits as plain HTML in the article body.
const ARTICLE_NOISE_RE =
  /<(script|style|noscript|template|svg|nav|footer|aside|form|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi;

// Ordered by how tightly each container hugs the article text.
const ARTICLE_CONTAINERS = [
  /<div[^>]+class=["'][^"']*(?:entry-content|post-content|article-content|article-body|td-post-content|single-content)[^"']*["'][^>]*>([\s\S]*)/i,
  /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  /<main\b[^>]*>([\s\S]*?)<\/main>/i,
];

// Where the recipe proper begins, in every language the app can be set to.
const INGREDIENT_HEADER_RE =
  /(ингредиент|інгредієнт|ингредиенттер|құрамы|состав:|склад:|ingredient|ingrédient|ingrediente|zutaten|składnik)/i;

// Sharing widgets and "you may also like" lists that follow the recipe. Only ever applied
// after the ingredient header, because the same words also appear above the article.
const ARTICLE_TAIL_RE =
  /\n\s*(поділитися|поделиться|share on|share this|оцініть статтю|оцените статью|читайте так|схожі|похожие|related|коментар|комментар|попередній запис|previous article)/i;

const ARTICLE_MAX_CHARS = 6000;

function htmlToLines(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(ARTICLE_NOISE_RE, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function extractArticleText(html: string): string {
  let body = html;
  for (const re of ARTICLE_CONTAINERS) {
    const m = html.match(re);
    if (m?.[1] && m[1].length > 400) { body = m[1]; break; }
  }

  let text = cleanSocialText(htmlToLines(body));

  const ingIdx = text.search(INGREDIENT_HEADER_RE);
  if (ingIdx >= 0) {
    const tail = text.slice(ingIdx).search(ARTICLE_TAIL_RE);
    if (tail > 0) text = text.slice(0, ingIdx + tail);
  }
  if (text.length <= ARTICLE_MAX_CHARS) return text;

  // Content farms pad the page with unrelated articles, so keep the window that holds the
  // recipe instead of the first N characters.
  const from = ingIdx > 0 ? Math.max(0, ingIdx - 500) : 0;
  return text.slice(from, from + ARTICLE_MAX_CHARS);
}

async function recipeFromText(
  text: string,
  targetLang: string,
): Promise<Record<string, unknown> | null> {
  if (text.length < 200) return null;

  const structured = await tryLlmStructure(text, targetLang, ARTICLE_MAX_CHARS);
  const regexResult = parseDescriptionText(text);

  const ingredients = structured?.ingredients?.length ? structured.ingredients : regexResult.ingredients;
  const instructions = splitLongSteps(
    structured?.instructions?.length ? structured.instructions : regexResult.instructions,
  );
  if (!ingredients.length && !instructions.length) return null;

  return {
    name: structured?.title ?? '',
    description: structured?.description || extractIntro(text),
    recipeIngredient: ingredients,
    recipeInstructions: instructions,
  };
}

// Build a schema.org-shaped node out of the article text so the generic path downstream
// (nutrition, image, translation, cleanup) keeps working unchanged.
async function recipeFromArticle(
  html: string,
  targetLang: string,
): Promise<Record<string, unknown> | null> {
  return recipeFromText(extractArticleText(html), targetLang);
}

// Trim a raw text block down to a short introductory description (2 sentences max, 300 chars max).
// Prevents full recipe text blobs from being stored in the description field.
function extractIntro(text: string, maxSentences = 2): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .slice(0, maxSentences)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 300)
    .trim();
}

// Profession/role words that appear in account bios but never in a dish name
const BIO_WORDS = /(врач|нутрициолог|диетолог|коуч|тренер|психолог|блогер|блоггер|эксперт|автор|шеф|повар|доктор|md|phd|doctor|nutritionist|dietitian|coach|chef|blogger|author|founder|похудени|стройност|фитнес|weight\s*loss|fitness)/i;

// Profile weight line ("8 кг", "−68 кг") that Instagram puts in og:title instead of the dish.
const WEIGHT_TITLE_RE = /^[\u2212\u2013\u2014+\-]?\s*\d+[.,]?\d*\s*(кг|kg|lb|lbs|г|g)\s*$/i;
const BIO_WEIGHT_RE = /[\u2212\u2013\u2014+\-]?\s*\d+[.,]?\d*\s*(кг|kg)\b/i;

// Detect when a sanitized title is still just an account bio rather than a recipe name.
function looksLikeBio(t: string): boolean {
  const s = t.trim();
  if (!s) return false;
  if (WEIGHT_TITLE_RE.test(s)) return true;
  const sep = (s.match(/[|•·]/g) ?? []).length;
  if (sep >= 2) return true;                    // "Name | role • role" is a bio, not a dish
  if (sep >= 1 && (BIO_WORDS.test(s) || BIO_WEIGHT_RE.test(s))) return true;
  return sep >= 1 && !/\d/.test(s) && s.split(/\s+/).length < 12;
}

function looksLikeCommentThread(s: string): boolean {
  const replies = (s.match(/\b(Reply|Ответить|View replies|View more comments)\b/gi) ?? []).length;
  return replies >= 2 || READER_TAIL_RE.test(s);
}

function looksLikeCommentBlurb(s: string): boolean {
  return /\b(Reply|Ответить)\b/i.test(s)
    || ((s.match(/\b(Like|Нравится)\b/gi) ?? []).length >= 2);
}

// Caption / comment that can actually become a recipe card — not a hook, bio or reply thread.
function looksLikeRecipeText(s: string): boolean {
  const text = s.trim();
  if (text.length < 80) return false;
  const parsed = parseDescriptionText(splitCaptionLines(text));
  if (parsed.ingredients.length >= 3) return true;
  if (parsed.ingredients.length >= 2 && parsed.instructions.length >= 2) return true;
  const qtyLines = text.split('\n').filter((l) => MEASURE.test(l)).length;
  if (qtyLines >= 3) return true;
  return MEASURE.test(text)
    && /(ингредиент|состав|приготовл|ingredient|method|directions|zutaten|шаг\s*\d)/i.test(text);
}

// Instagram often pins the recipe under the reel. The reader dumps the whole thread;
// keep the longest chunk that still looks like a recipe.
function extractPinnedRecipeComment(raw: string): string {
  const chunks = raw.split(
    /\n\s*(?:Reply|Ответить|Like|Нравится|View (?:all|more) comments|View replies|Смотреть\s+\S*\s*коммент\S*)\s*\n/gi,
  );
  let best = '';
  for (const chunk of chunks) {
    const t = chunk.trim();
    if (t.length < 80 || !looksLikeRecipeText(t)) continue;
    if (t.length > best.length) best = t;
  }
  return best;
}

function unescapeEmbeddedText(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
}

// Public Instagram HTML sometimes still embeds comment bodies in JSON. The first long
// recipe-shaped "text" is usually the author's pinned comment.
function extractInstagramEmbeddedRecipe(html: string): string {
  const texts: string[] = [];
  const re = /"text"\s*:\s*"((?:\\.|[^"\\]){60,})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = unescapeEmbeddedText(m[1]).trim();
    if (t.length >= 60) texts.push(t);
    if (texts.length >= 40) break;
  }
  let best = '';
  for (const t of texts) {
    if (looksLikeRecipeText(t) && t.length > best.length) best = t;
  }
  return best;
}

// A longer scrape is not better when it is the profile header plus other people's replies.
function betterSocialText(current: string, candidate: string): string {
  if (!candidate || isLoginWallText(candidate) || looksLikeFacebookChrome(candidate)) return current;
  const fromComments = extractPinnedRecipeComment(candidate);
  const next = fromComments || candidate;
  const curRecipe = looksLikeRecipeText(current);
  const newRecipe = looksLikeRecipeText(next);
  if (newRecipe && !curRecipe) return next;
  if (newRecipe && curRecipe && next.length > current.length) return next;
  if (!current) return looksLikeCommentThread(next) ? '' : next;
  return current;
}

// Strip junk from any title: @handles, platform labels, engagement suffixes, extra whitespace.
function sanitizeTitle(raw: string): string {
  return raw
    .split('\n')[0]                                                                      // first line only
    .replace(/^[\d,.]+[KkMm]?\s*(views?|reactions?|likes?|comments?)\s*[·•|\-,]\s*/gi, '') // strip leading "6.7K views · 1.1K reactions | "
    .replace(/@\w[\w.]*\b/g, '')                                                         // remove @handles
    .replace(/^.+?\s+on\s+(instagram|facebook|tiktok)\s*:\s*[«"'`]?/i, '')              // strip "AccountName on Instagram: «"
    .replace(/\s*[•·]\s*(instagram|tiktok|facebook)\s.*/i, '')                          // strip "• Instagram photos and videos"
    .replace(/\s*[|\-–—]\s*(instagram|tiktok|facebook|youtube|vk|ok\.ru)\b.*/gi, '')    // strip "| Platform" suffixes
    .replace(/^(instagram\s*(reel|reels|video)?|tiktok\s*video?|facebook\s*(video|reel)?|youtube\s*video?)[:\s\-–—]*/gi, '') // strip platform prefixes
    .replace(/\s*[\d,.]+[KkMm]?\s*(views?|likes?|comments?)\s*$/gi, '')                 // strip trailing metrics
    .replace(/\(\s*\)/g, '')                                                            // strip empty parens left by @handle removal
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 150);
}

// Extract a numeric nutrient value from the nutrition object by field name
function parseNutritionNumber(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).replace(/,/g, '.').replace(/[–—]/g, '-');
  if (/^nan$/i.test(s.trim())) return undefined;
  const range = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const mid = (Number(range[1]) + Number(range[2])) / 2;
    return Number.isFinite(mid) ? Math.round(mid).toString() : undefined;
  }
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Math.round(Number(m[1]));
  return Number.isFinite(n) ? n.toString() : undefined;
}

function extractNutrient(nutrition: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!nutrition) return undefined;
  return parseNutritionNumber(nutrition[key]);
}

function parseMacroFromHtml(html: string, word: string): string | undefined {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const perServing = text.match(
    new RegExp(`${word}[^\\n<]{0,100}?(\\d+[.,]?\\d*)\\s*г\\s*на порц`, 'i'),
  );
  if (perServing) return parseNutritionNumber(perServing[1]);
  return parseNutritionNumber(text.match(new RegExp(`${word}[^<]{0,40}?([\\d,.]+)`, 'i'))?.[1]);
}

function parseKcalFromHtml(html: string): string | undefined {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/[–—]/g, '-');
  const perServingRange = text.match(
    /~?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:ккал|kcal)\b[^\n<]{0,48}(?:порц|serving)/i,
  );
  if (perServingRange) return parseNutritionNumber(`${perServingRange[1]}-${perServingRange[2]}`);
  const perServing = text.match(/~?\s*(\d+(?:\.\d+)?)\s*(?:ккал|kcal)\b[^\n<]{0,48}(?:порц|serving)/i);
  if (perServing) return parseNutritionNumber(perServing[1]);
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:ккал|kcal)\b/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 20 && n <= 2500) return String(Math.round(n));
  }
  return undefined;
}

// Every language the app can be switched to, spelled out for the prompt.
const LLM_LANG_NAMES: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  de: 'German',
  uk: 'Ukrainian',
  pl: 'Polish',
  it: 'Italian',
  es: 'Spanish',
  fr: 'French',
  kk: 'Kazakh',
};

function llmLangName(lang: string): string {
  return LLM_LANG_NAMES[lang] ?? 'English';
}

// Field examples in the app language so the model does not copy the Russian samples
// and leave ingredients / steps untranslated.
const LLM_FIELD_EXAMPLES: Record<string, { title: string; ingredients: string }> = {
  ru: { title: 'Шоколадное печенье', ingredients: '"200г муки", "2 яйца", "щепотка соли"' },
  en: { title: 'Chocolate cookies', ingredients: '"200g flour", "2 eggs", "a pinch of salt"' },
  de: { title: 'Schokoladenkekse', ingredients: '"200 g Mehl", "2 Eier", "eine Prise Salz"' },
  uk: { title: 'Шоколадне печиво', ingredients: '"200 г борошна", "2 яйця", "дрібка солі"' },
  pl: { title: 'Ciasteczka czekoladowe', ingredients: '"200 g mąki", "2 jajka", "szczypta soli"' },
  it: { title: 'Biscotti al cioccolato', ingredients: '"200 g di farina", "2 uova", "un pizzico di sale"' },
  es: { title: 'Galletas de chocolate', ingredients: '"200 g de harina", "2 huevos", "una pizca de sal"' },
  fr: { title: 'Cookies au chocolat', ingredients: '"200 g de farine", "2 œufs", "une pincée de sel"' },
  kk: { title: 'Шоколадты печенье', ingredients: '"200 г ұн", "2 жұмыртқа", "бір шымшым тұз"' },
};

function llmFieldExamples(lang: string) {
  return LLM_FIELD_EXAMPLES[lang] ?? LLM_FIELD_EXAMPLES.en;
}

// llama-3.1-8b-instant is deprecated by Groq with a 2026-08-16 shutdown.
// Overridable via GROQ_MODEL so the next migration needs no code change.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

// gpt-oss cannot see images. Groq dropped Llama 4 Scout; current vision is Qwen.
const DEFAULT_GROQ_VISION_MODEL = 'qwen/qwen3.6-27b';
const DEAD_GROQ_VISION = /llama-4-scout|llama-4-maverick|llava/i;
const SCREENSHOT_MAX_CHARS = 2_000_000;

// Groq's free tier caps tokens-per-minute at 8000 for gpt-oss-20b, and a reserved
// max_tokens counts toward that budget — an oversized reservation is rejected with
// HTTP 413 before the model ever runs. Keep total (prompt + reservation) under this.
const LLM_TPM_BUDGET = 7000;

// Deliberately pessimistic (~3 chars per token): Cyrillic output tokenises far less
// efficiently than Latin input, and overestimating only costs us a smaller reservation.
function estimateTokens(chars: number): number {
  return Math.ceil(chars / 3);
}

// gpt-oss is a reasoning model: it spends tokens thinking before emitting any answer, so a
// small reservation yields an empty completion and Groq rejects it with json_validate_failed.
// This floor keeps room for reasoning plus the actual JSON.
const LLM_MIN_TOKENS = 2500;

// Reservation used when a first attempt came back as truncated JSON. Stays under the TPM
// budget so the retry is not rejected outright.
const LLM_JSON_RETRY_TOKENS = 5000;

// The free tier resets its token budget once a minute, so Groq can legitimately ask for a wait
// approaching 60s. Honour it: an import that takes a minute is still a working import, whereas
// giving up leaves the user with a card they must retype. Edge functions allow far longer.
const LLM_MAX_WAIT_S = 70;
const LLM_THROTTLE_ATTEMPTS = 3;

// Reservation that fits the TPM budget alongside the prompt itself.
function budgetMaxTokens(promptChars: number, desired: number): number {
  const promptTokens = estimateTokens(promptChars);
  return Math.max(LLM_MIN_TOKENS, Math.min(desired, LLM_TPM_BUDGET - promptTokens));
}

// Reason for the most recent LLM failure within the current request, surfaced to the
// caller as `llmError`. Without this, a missing key, a decommissioned model and a rate
// limit are indistinguishable from "the text simply had no recipe in it".
let llmDiag: string | undefined;

function resolveLlm(): { key: string; apiUrl: string; model: string } | null {
  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (groqKey) {
    return {
      key: groqKey,
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: Deno.env.get('GROQ_MODEL') ?? DEFAULT_GROQ_MODEL,
    };
  }
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiKey) {
    return {
      key: openaiKey,
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
    };
  }
  llmDiag = 'no_api_key';
  return null;
}

function resolveVisionModel(llm: { apiUrl: string; model: string }): string {
  if (llm.apiUrl.includes('groq.com')) {
    const override = Deno.env.get('GROQ_VISION_MODEL');
    if (override && !DEAD_GROQ_VISION.test(override)) return override;
    return DEFAULT_GROQ_VISION_MODEL;
  }
  return Deno.env.get('OPENAI_VISION_MODEL') ?? llm.model;
}

function llmRequestExtras(model: string): Record<string, unknown> {
  if (model.startsWith('openai/gpt-oss')) {
    return { reasoning_effort: 'low' };
  }
  // Qwen 3.x thinks by default and can spend the whole reservation before any OCR text.
  if (model.startsWith('qwen/qwen3')) {
    return { reasoning_effort: 'none' };
  }
  return {};
}

// gpt-oss models occasionally wrap JSON in markdown fences despite response_format,
// so fall back to extracting the outermost brace pair.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLlmJson(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch { /* fall through to brace extraction */ }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch { return null; }
}

// Shared request path for both LLM helpers: resolves the provider, posts the body and
// records why a call failed instead of collapsing every error into null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function completeLlm(
  body: Record<string, unknown>,
  label: string,
  modelOverride?: string,
): Promise<string | null> {
  const llm = resolveLlm();
  if (!llm) return null;

  const model = modelOverride ?? llm.model;
  const extras = llmRequestExtras(model);

  const post = (payload: Record<string, unknown>) =>
    fetch(llm.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, ...extras, ...payload }),
    });

  try {
    let res = await post(body);

    // 413 means prompt plus reserved max_tokens exceeded the per-minute token budget,
    // which can also happen when concurrent requests have eaten into it. Retry once
    // with a minimal reservation rather than losing the translation entirely.
    if (res.status === 413 && typeof body.max_tokens === 'number' && body.max_tokens > 1200) {
      console.error(`[llm] ${label} exceeded TPM budget, retrying with a smaller reservation`);
      res = await post({ ...body, max_tokens: 1200 });
    }

    // A long recipe can exhaust the reservation mid-JSON; Groq then rejects the truncated
    // output as json_validate_failed. Retrying with a bigger reservation recovers it, and is
    // cheaper than reserving the maximum on every call.
    if (res.status === 400 && typeof body.max_tokens === 'number' && body.max_tokens < LLM_JSON_RETRY_TOKENS) {
      const detail = (await res.text()).slice(0, 400);
      if (detail.includes('json_validate_failed')) {
        console.error(`[llm] ${label} produced truncated JSON, retrying with a bigger reservation`);
        res = await post({ ...body, max_tokens: LLM_JSON_RETRY_TOKENS });
      } else {
        llmDiag = `${label}_http_400: ${detail}`;
        console.error(`[llm] ${label} rejected`, detail);
        return null;
      }
    }

    // The free tier resets its token budget every minute and Groq states the exact wait in the
    // error body ("Please try again in 10.85s"). Waiting it out recovers the whole recipe, so it
    // beats falling back to whatever the regex could scrape from a truncated caption.
    // A single wait is not always enough: the budget refills gradually, so a big prompt can be
    // rejected twice in a row while still being served on the third try.
    for (let attempt = 1; attempt <= LLM_THROTTLE_ATTEMPTS && res.status === 429; attempt++) {
      const detail = (await res.text()).slice(0, 300);
      // The hint switches units when the reset is close ("937.5ms" vs "10.85s").
      const hint = detail.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
      const wait = hint ? Number(hint[1]) / (hint[2].toLowerCase() === 'ms' ? 1000 : 1) : 0;
      if (wait <= 0 || wait > LLM_MAX_WAIT_S) {
        llmDiag = `${label}_http_429: ${detail}`;
        console.error(`[llm] ${label} throttled without a usable retry hint`, detail);
        return null;
      }
      console.error(`[llm] ${label} throttled, retrying in ${wait}s (attempt ${attempt})`);
      await sleep((wait + 1) * 1000);
      res = await post(body);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      llmDiag = `${label}_http_${res.status}: ${detail}`;
      console.error(`[llm] ${label} failed`, res.status, model, detail);
      return null;
    }

    const json = await res.json();
    const message = json?.choices?.[0]?.message;
    const content = typeof message?.content === 'string' && message.content.trim()
      ? message.content
      : typeof message?.reasoning === 'string' && message.reasoning.trim()
        ? message.reasoning
        : '';
    if (!content.trim()) {
      llmDiag = `${label}_empty_content`;
      console.error(`[llm] ${label} empty content`, JSON.stringify(json).slice(0, 300));
      return null;
    }
    return content;
  } catch (err) {
    llmDiag = `${label}_exception: ${String(err).slice(0, 200)}`;
    console.error(`[llm] ${label} threw`, err);
    return null;
  }
}

async function callLlm(
  body: Record<string, unknown>,
  label: string,
  modelOverride?: string,
): Promise<any | null> {
  const content = await completeLlm(body, label, modelOverride);
  if (!content) return null;

  const parsed = parseLlmJson(content);
  if (!parsed) {
    llmDiag = `${label}_bad_json`;
    console.error(`[llm] ${label} unparseable JSON`, content.slice(0, 300));
    return null;
  }
  return parsed;
}

type StructuredRecipe = {
  title?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
};

const MAX_RECIPES_FROM_CAPTION = 8;

function recipeFromLlmNode(raw: unknown): StructuredRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ingredients = Array.isArray(o.ingredients) ? o.ingredients.map(String).filter((s) => s.trim()) : [];
  const instructions = Array.isArray(o.instructions) ? o.instructions.map(String).filter((s) => s.trim()) : [];
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const description = typeof o.description === 'string' ? o.description.trim() : '';
  if (!title && !ingredients.length && !instructions.length) return null;
  return {
    title: title || undefined,
    description: description || undefined,
    ingredients,
    instructions,
  };
}

function coerceLlmRecipes(out: Record<string, unknown> | null): StructuredRecipe[] {
  if (!out) return [];
  const nodes = Array.isArray(out.recipes) ? out.recipes : [out];
  const recipes: StructuredRecipe[] = [];
  for (const node of nodes) {
    const recipe = recipeFromLlmNode(node);
    if (!recipe) continue;
    recipes.push(recipe);
    if (recipes.length >= MAX_RECIPES_FROM_CAPTION) break;
  }
  return mergeComponentRecipes(recipes);
}

const COMPONENT_TITLE_RE =
  /^(для\s+)?(крем|глазур|ganache|frosting|buttercream|icing|начинк|cream|glasur|gla[cç]age|crema)\b|для крема|for the cream|für die creme|pour la cr[eè]me/i;

function isComponentRecipe(recipe: StructuredRecipe): boolean {
  const title = (recipe.title ?? '').trim();
  if (!title || !COMPONENT_TITLE_RE.test(title)) return false;
  return recipe.instructions.length <= 3;
}

// "Ingredients for the cream" is a section of the same cake, not a second dish.
function mergeComponentRecipes(recipes: StructuredRecipe[]): StructuredRecipe[] {
  if (recipes.length < 2) return recipes;
  const extras = recipes.filter(isComponentRecipe);
  const mains = recipes.filter((recipe) => !isComponentRecipe(recipe));
  if (!extras.length || !mains.length) return recipes;
  const first: StructuredRecipe = {
    ...mains[0],
    ingredients: [...mains[0].ingredients],
    instructions: [...mains[0].instructions],
  };
  for (const extra of extras) {
    const tag = (extra.title ?? '').trim();
    first.ingredients.push(
      ...extra.ingredients.map((line) => {
        if (!tag || line.toLowerCase().includes(tag.toLowerCase())) return line;
        return `${tag}: ${line}`;
      }),
    );
    first.instructions.push(...extra.instructions);
  }
  return [first, ...mains.slice(1)];
}

// Optional LLM structuring — supports Groq (free) or OpenAI.
// Priority: GROQ_API_KEY (free) → OPENAI_API_KEY (paid). Returns null when no key is set.
async function tryLlmStructure(
  rawText: string,
  targetLang: string,
  maxChars = 5000,
): Promise<(StructuredRecipe & { recipes: StructuredRecipe[] }) | null> {
  if (rawText.length < 50) return null;

  const text = rawText.slice(0, maxChars);
  const langName = llmLangName(targetLang);
  const examples = llmFieldExamples(targetLang);
  const out = await callLlm({
    // Extraction discards filler, so the result is smaller than the source
    max_tokens: budgetMaxTokens(text.length + 1200, 4000),
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `You are a recipe extraction assistant.
Extract ONLY recipe content from the text below. Ignore all social media metadata (likes, views, comments, shares, follower counts, platform names like "Instagram Reel", "TikTok video").

Respond in ${langName}. Translate EVERY field into ${langName} when the source is in another language: title, description, every ingredient line, and every instruction step. Never leave ingredients or steps in the source language.

Return ONLY valid JSON: { "recipes": [ { "title", "description", "ingredients", "instructions" } ] }

Each recipes[] item:
- title: the dish name ONLY (e.g. "${examples.title}"). Never include author handles (@username), account names, platform labels ("Instagram Reel"), or engagement numbers. If no clear dish name exists, return "".
- description: brief intro / context sentence(s) only, written in ${langName} (max 2 sentences, or empty string "")
- ingredients: array of strings in ${langName}, each one ingredient with quantity + unit + name, e.g. ${examples.ingredients}
- instructions: array of strings in ${langName}, one short step per array item, in order. Never return the whole method as a single item: split it into separate steps at each distinct action (prepare, mix, bake, assemble, ...).

If the text has sections for batter, cream, frosting, glaze, filling, garnish or "additionally", keep ALL of those lines in the SAME recipe.ingredients array. Prefix cream/frosting lines so they stay readable, e.g. "для крема: сметана — 200 г". Never drop a cream, frosting, sauce or garnish list that belongs to the same dish. "Ingredients for the cream" is NOT a second recipe.

If the text contains TWO OR MORE clearly separate dishes (carousel / "рецепт 1", "рецепт 2", "3 десерта:", numbered recipes each with their own ingredients), put each dish in its own recipes[] object.
If it is ONE dish — including a cake plus its cream, or optional substitutions — return a single-item recipes array.
Do not invent dishes. Do not split one recipe into an ingredients card and a steps card.

If no recipe is found return { "recipes": [] }.
Do not invent data not present in the text.

Text:
${text}`,
    }],
  }, 'structure');

If the text has sections for batter, cream, frosting, glaze, filling, garnish or "additionally", keep ALL of those lines in the SAME recipe.ingredients array. Prefix cream/frosting lines so they stay readable, e.g. "для крема: сметана — 200 г". Never drop a cream, frosting, sauce or garnish list that belongs to the same dish. "Ingredients for the cream" is NOT a second recipe.

If the text contains TWO OR MORE clearly separate dishes (carousel / "рецепт 1", "рецепт 2", "3 десерта:", numbered recipes each with their own ingredients), put each dish in its own recipes[] object.
If it is ONE dish — including a cake plus its cream, or optional substitutions — return a single-item recipes array.
  const first = recipes[0];
  return {
    title: first.title,
    description: first.description,
    ingredients: first.ingredients,
    instructions: first.instructions,
    recipes,
  };
}

function screenshotReadError(lang: string): string {
  return lang === 'ru'
    ? 'На скрине не видно текста рецепта. Снимите комментарий крупнее или прикрепите другой кадр.'
    : 'No recipe text is readable on this screenshot. Crop closer to the comment or attach another frame.';
}

function screenshotVisionError(lang: string): string {
  const ru = lang === 'ru';
  if (!llmDiag) return screenshotReadError(lang);
  if (/429|throttl/i.test(llmDiag)) {
    return ru
      ? 'Сервис распознавания сейчас перегружен. Подождите минуту и повторите.'
      : 'The recognition service is busy. Wait a minute and try again.';
  }
  if (/413|TPM|too large|payload/i.test(llmDiag)) {
    return ru
      ? 'Скрин не прошёл по размеру. Обрежьте кадр ближе к тексту рецепта.'
      : 'This screenshot is too heavy. Crop closer to the recipe text.';
  }
  if (/no_api_key/.test(llmDiag)) {
    return ru
      ? 'Распознавание скринов не настроено.'
      : 'Screenshot recognition is not configured.';
  }
  if (/decommissioned|model_not_found|does not exist|unknown model/i.test(llmDiag)) {
    return ru
      ? 'Модель распознавания обновилась. Подождите минуту и повторите.'
      : 'The recognition model changed. Wait a minute and try again.';
  }
  return ru
    ? 'Не удалось прочитать скрин. Подождите минуту и попробуйте ещё раз.'
    : 'Could not read the screenshot. Wait a minute and try again.';
}

// First pass: dump visible text. JSON extraction in the same call was too heavy for
// Groq vision and collapsed every API failure into "no text on the screenshot".
async function tryVisionTranscript(dataUrl: string): Promise<string | null> {
  const llm = resolveLlm();
  if (!llm) return null;

  const content = await completeLlm({
    max_tokens: 2200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Transcribe ALL readable text from this screenshot, including Cyrillic.
Keep the original language and line breaks. Include EVERY ingredient list in full — batter, cream, frosting, glaze, filling, garnish, "additionally". Keep section headings such as "Ингредиенты для крема" / "Приготовление".
Skip only UI chrome: Like, Reply, Share, Follow, timestamps, "Leave a comment", reaction bars.
Return plain text only. No JSON. No commentary.`,
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  }, 'vision-ocr', resolveVisionModel(llm));

  if (!content) return null;
  const text = content.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
  return text.length >= 20 ? text : null;
}

async function translateRecipeList(
  list: StructuredRecipe[],
  lang: string,
  sourceLang: string | undefined,
  fallbackTitle: string,
): Promise<{ title: string; description: string; ingredients: string[]; instructions: string[] }[]> {
  const out: { title: string; description: string; ingredients: string[]; instructions: string[] }[] = [];
  for (const recipe of list) {
    let payload = {
      title: sanitizeTitle(recipe.title ?? '') || fallbackTitle,
      description: recipe.description ?? '',
      ingredients: recipe.ingredients.filter((i) => !isJunkIngredient(i)),
      instructions: recipe.instructions,
    };
    payload = await translateIfNeeded(payload, sourceLang, lang);
    out.push(cleanTexts({
      ...payload,
      instructions: splitLongSteps(payload.instructions),
    }));
  }
  return out;
}

// Dedicated translation services are preferred over an LLM here because they are
// deterministic, keep quantities and units intact, and cannot drop, reword or reorder list
// items the way a generative model does.
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

// Reason the most recent translation attempt failed, surfaced to the caller as
// `translateError`. Set only when strings are actually left untranslated, so a rejection
// that a later provider recovered from is not reported as a failure.
let translateDiag: string | undefined;

// A per-line retry only helps when the line count drifted; repeating a throttled request
// line by line would just multiply the rejections.
type ChunkResult =
  | { ok: true; lines: string[] }
  | { ok: false; retryPerLine: boolean };

interface TranslateProvider {
  name: string;
  // Source characters per request, kept inside each service's query length limit
  chunkChars: number;
  translate: (lines: string[], sourceLang: string, targetLang: string) => Promise<ChunkResult>;
}

// Split the joined response back into one entry per input line. Shared by both providers.
function splitTranslated(joined: string, lines: string[]): ChunkResult {
  const out = joined.split('\n');
  if (out.length !== lines.length) {
    // A mismatch would silently shift ingredients onto the wrong rows
    return { ok: false, retryPerLine: true };
  }
  return { ok: true, lines: out };
}

// Client identifiers are throttled independently, so a rejection on one is often served
// fine by the next. Verified to return byte-identical translations.
const GOOGLE_CLIENTS = ['gtx', 'dict-chrome-ex'];

const googleProvider: TranslateProvider = {
  name: 'google',
  chunkChars: 1200,
  translate: async (lines, sourceLang, targetLang) => {
    let lastStatus = 0;

    for (const client of GOOGLE_CLIENTS) {
      const query = new URLSearchParams({
        client,
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: lines.join('\n'),
      });

      try {
        const res = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${query}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (!res.ok) {
          lastStatus = res.status;
          console.error('[translate] google http', res.status, (await res.text()).slice(0, 160));
          await sleep(300);
          continue;
        }

        // Response shape: [[[translated, original, ...], ...], ...]
        const json = await res.json();
        if (!Array.isArray(json?.[0])) return { ok: false, retryPerLine: false };

        const joined = (json[0] as unknown[])
          .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? '') : ''))
          .join('');

        return splitTranslated(joined, lines);
      } catch (err) {
        console.error('[translate] google threw', err);
        await sleep(300);
      }
    }

    console.error('[translate] google exhausted, last status', lastStatus);
    return { ok: false, retryPerLine: false };
  },
};

// Second free, keyless service. Covers the case where Google throttles the shared Supabase
// egress IP, which happens often enough that the LLM alone is not an acceptable backup.
// Its query limit is far smaller, hence the reduced chunk size.
const myMemoryProvider: TranslateProvider = {
  name: 'mymemory',
  chunkChars: 400,
  translate: async (lines, sourceLang, targetLang) => {
    // The API needs an explicit language pair and has no autodetect mode
    if (!sourceLang || sourceLang === 'auto') return { ok: false, retryPerLine: false };

    const query = new URLSearchParams({
      q: lines.join('\n'),
      langpair: `${sourceLang}|${targetLang}`,
    });

    try {
      const res = await fetch(`${MYMEMORY_ENDPOINT}?${query}`);
      if (!res.ok) {
        console.error('[translate] mymemory http', res.status);
        return { ok: false, retryPerLine: false };
      }

      const json = await res.json();
      const text = json?.responseData?.translatedText;
      if (typeof text !== 'string' || !text.trim()) {
        console.error('[translate] mymemory empty', String(json?.responseDetails ?? '').slice(0, 160));
        return { ok: false, retryPerLine: false };
      }

      return splitTranslated(text, lines);
    } catch (err) {
      console.error('[translate] mymemory threw', err);
      return { ok: false, retryPerLine: false };
    }
  },
};

const TRANSLATE_PROVIDERS = [googleProvider, myMemoryProvider];

// The same free endpoint reports the language it detected in the third slot of its reply.
// Detection has to run on the text because page metadata lies often enough to be harmful:
// womanjurnal.ru declares lang="ro-RO" for articles written in Russian.
async function detectTextLang(sample: string): Promise<string | undefined> {
  const q = sample.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (q.length < 20) return undefined;

  const query = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: 'en', dt: 't', q });
  try {
    const res = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) {
      await res.body?.cancel();
      console.error('[translate] detect http', res.status);
      return undefined;
    }
    const json = await res.json();
    const detected = typeof json?.[2] === 'string' ? normalizeLang(json[2]) : undefined;
    return detected && detected !== 'auto' ? detected : undefined;
  } catch (err) {
    console.error('[translate] detect threw', err);
    return undefined;
  }
}

// Which language to translate a recipe from, or null when it is already in the app language.
// Ukrainian into Russian is the case the old script heuristic could never see: both are
// Cyrillic, so comparing alphabets always concluded "same language".
async function translateFrom(
  sample: string,
  metaLang: string | undefined,
  targetLang: string,
): Promise<string | null> {
  const detected = await detectTextLang(sample);
  if (detected) return detected === targetLang ? null : detected;

  // Detection is rate-limited often enough that metadata still has to be usable, but only
  // where it does not contradict the text: womanjurnal.ru declares Romanian on Cyrillic
  // pages, and translating Russian "from Romanian" mangles it.
  if (metaLang && !scriptsDisagree(sample, metaLang)) {
    return metaLang === targetLang ? null : metaLang;
  }
  return needsTranslation(sample, targetLang) ? 'auto' : null;
}

const CYRILLIC_LANGS = new Set(['ru', 'uk', 'be', 'bg', 'sr', 'mk', 'kk']);

function scriptsDisagree(sample: string, lang: string): boolean {
  const cyrillic = (sample.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  if (cyrillic + latin < 20) return false;
  return (cyrillic > latin) !== CYRILLIC_LANGS.has(lang);
}

// Translate one provider's share of the work, marking each string it managed to handle so a
// later provider only retries what is still missing.
async function runProvider(
  provider: TranslateProvider,
  pending: { text: string; i: number }[],
  result: string[],
  done: boolean[],
  sourceLang: string,
  targetLang: string,
): Promise<void> {
  for (let start = 0; start < pending.length;) {
    let end = start;
    let chars = 0;
    while (
      end < pending.length &&
      (end === start || chars + pending[end].text.length <= provider.chunkChars)
    ) {
      chars += pending[end].text.length + 1;
      end++;
    }
    const batch = pending.slice(start, end);

    const res = await provider.translate(batch.map((e) => e.text), sourceLang, targetLang);
    if (res.ok) {
      batch.forEach((e, k) => { result[e.i] = res.lines[k].trim(); done[e.i] = true; });
    } else if (res.retryPerLine) {
      // Line count drifted — redo this batch one string at a time so nothing shifts
      for (const e of batch) {
        const single = await provider.translate([e.text], sourceLang, targetLang);
        if (single.ok) { result[e.i] = single.lines[0].trim(); done[e.i] = true; }
      }
    }

    start = end;
  }
}

// Translate a list of strings, preserving length and order. Returns null only when nothing
// could be translated at all, so callers can fall back and keep the original text.
async function translateTexts(
  strings: string[],
  sourceLang: string,
  targetLang: string,
): Promise<string[] | null> {
  // Embedded newlines would break the line-per-string mapping
  const flat = strings.map((s) => s.replace(/\s*\n+\s*/g, ' ').trim());

  // Blank entries are kept in place but never sent: the services collapse empty lines
  const indexed = flat.map((text, i) => ({ text, i })).filter((e) => e.text.length > 0);
  if (!indexed.length) return null;

  const result = [...flat];
  const done = flat.map(() => false);

  for (const provider of TRANSLATE_PROVIDERS) {
    const pending = indexed.filter((e) => !done[e.i]);
    if (!pending.length) break;
    await runProvider(provider, pending, result, done, sourceLang, targetLang);
  }

  const missing = indexed.filter((e) => !done[e.i]).length;
  if (missing) translateDiag = `untranslated_${missing}_of_${indexed.length}`;

  return missing < indexed.length ? result : null;
}

type RecipePayload = {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
};

// Prefer leftover source-language lists so a translated title/blurb does not fill
// the 300-char detector and hide Russian (or other) ingredients and steps.
function leftoverSourceSample(payload: RecipePayload, targetLang: string): string {
  const lists = [...payload.ingredients, ...payload.instructions].join(' ');
  const head = [payload.title, payload.description].join(' ');
  if (needsTranslation(lists, targetLang) || scriptsDisagree(lists, targetLang)) {
    return [lists, head].join(' ');
  }
  if (needsTranslation(head, targetLang) || scriptsDisagree(head, targetLang)) {
    return [head, lists].join(' ');
  }
  return [head, lists].join(' ');
}

function payloadLooksForeign(payload: RecipePayload, targetLang: string): boolean {
  const sample = leftoverSourceSample(payload, targetLang);
  return needsTranslation(sample, targetLang) || scriptsDisagree(sample, targetLang);
}

function recipeFieldsChanged(a: RecipePayload, b: RecipePayload): boolean {
  return a.title !== b.title
    || a.description !== b.description
    || a.ingredients.length !== b.ingredients.length
    || a.instructions.length !== b.instructions.length
    || a.ingredients.some((line, i) => line !== b.ingredients[i])
    || a.instructions.some((line, i) => line !== b.instructions[i]);
}

async function translateIfNeeded(
  payload: RecipePayload,
  metaLang: string | undefined,
  targetLang: string,
): Promise<RecipePayload> {
  const sample = leftoverSourceSample(payload, targetLang);
  let from = await translateFrom(sample, metaLang, targetLang);
  // LLM often translates only title/description. The leftover lists (or a leftover
  // title) still have to force a second pass.
  if (!from && payloadLooksForeign(payload, targetLang)) {
    from = 'auto';
  }
  if (!from) return payload;
  return (await translateRecipe(payload, from, targetLang)) ?? payload;
}

// Translate a whole recipe while keeping field boundaries intact. Dedicated translation
// services first, the LLM only if every one of them is unreachable.
async function translateRecipe(
  payload: { title: string; description: string; ingredients: string[]; instructions: string[] },
  sourceLang: string,
  targetLang: string,
): Promise<typeof payload | null> {
  const items = [
    payload.title,
    payload.description,
    ...payload.ingredients,
    ...payload.instructions,
  ];

  const tr = await translateTexts(items, sourceLang, targetLang);
  if (tr) {
    const stepStart = 2 + payload.ingredients.length;
    return {
      title: tr[0],
      description: tr[1],
      ingredients: tr.slice(2, stepStart),
      instructions: tr.slice(stepStart),
    };
  }

  return await tryLlmTranslate(payload, targetLang);
}

// Translate an already-structured recipe into the app language.
// Used as a fallback when the translation endpoint is unavailable.
async function tryLlmTranslate(
  payload: { title: string; description: string; ingredients: string[]; instructions: string[] },
  targetLang: string,
): Promise<typeof payload | null> {
  const langName = llmLangName(targetLang);
  const payloadJson = JSON.stringify(payload);

  const out = await callLlm({
    // A translation is roughly as long as its source, so scale the reservation to the
    // payload: too small truncates the JSON, too large is rejected for exceeding TPM.
    max_tokens: budgetMaxTokens(
      payloadJson.length + 500,
      estimateTokens(payloadJson.length) * 3 + 400,
    ),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a recipe translator. Translate ALL recipe fields (title, description, ingredients, instructions) into ${langName} accurately. Keep every numeric quantity and unit exactly as given. Write ingredient names in nominative singular form. Return the same JSON shape with the same keys and the same array lengths. Never omit, merge or reorder items.`,
      },
      { role: 'user', content: payloadJson },
    ],
  }, 'translate');

  if (!out) return null;
  // Reject a malformed response rather than corrupting good source data
  if (!Array.isArray(out.ingredients) || !Array.isArray(out.instructions)) {
    llmDiag = 'translate_shape_mismatch';
    console.error('[llm] translate returned unexpected shape', JSON.stringify(out).slice(0, 300));
    return null;
  }
  return {
    title: typeof out.title === 'string' ? out.title : payload.title,
    description: typeof out.description === 'string' ? out.description : payload.description,
    ingredients: out.ingredients.map(String),
    instructions: out.instructions.map(String),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Warm isolates are reused between requests, so clear any diagnostic from the last one
  llmDiag = undefined;
  translateDiag = undefined;
  readerDiag = undefined;

  try {
    const body = await req.json();
    const lang = typeof body.lang === 'string' ? body.lang : 'ru';
    const url = body.url;
    const recipeIn = body.recipe;

    // Copy-to-my-book: translate an already parsed recipe into the caller's language.
    if (recipeIn && typeof recipeIn === 'object') {
      const payload = {
        title: String(recipeIn.title ?? ''),
        description: String(recipeIn.description ?? ''),
        ingredients: Array.isArray(recipeIn.ingredients) ? recipeIn.ingredients.map(String) : [],
        instructions: Array.isArray(recipeIn.instructions) ? recipeIn.instructions.map(String) : [],
      };
      const translated = await translateIfNeeded(payload, undefined, lang);
      const changed = recipeFieldsChanged(translated, payload);
      return new Response(
        JSON.stringify({ ...cleanTexts(translated), translated: changed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const imageIn = typeof body.image === 'string' ? body.image.trim() : '';
    if (imageIn) {
      if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(imageIn)) {
        return new Response(
          JSON.stringify({
            error: lang === 'ru'
              ? 'Нужен снимок JPEG, PNG или WebP.'
              : 'Please attach a JPEG, PNG or WebP screenshot.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (imageIn.length > SCREENSHOT_MAX_CHARS) {
        return new Response(
          JSON.stringify({
            error: lang === 'ru'
              ? 'Скрин слишком большой. Обрежьте его ближе к тексту рецепта.'
              : 'This screenshot is too large. Crop closer to the recipe text.',
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const transcript = await tryVisionTranscript(imageIn);
      if (!transcript) {
        return new Response(
          JSON.stringify({ error: screenshotVisionError(lang), llmError: llmDiag }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const priorText = typeof body.priorText === 'string' ? body.priorText.trim() : '';
      const combined = priorText
        ? `Page 1 of the same recipe (already read). Merge page 2 into ONE recipe. Do not drop cream, frosting or garnish lists.\n\n--- page 1 ---\n${priorText}\n\n--- page 2 ---\n${transcript}`
        : transcript;

      const parsed = await structureCaption(cleanSocialText(splitCaptionLines(combined)), lang);
      const visionRecipes = parsed.recipes.length
        ? parsed.recipes
        : [{
            title: parsed.structured?.title,
            description: parsed.structured?.description,
            ingredients: parsed.ingredients,
            instructions: parsed.instructions,
          }];
      const usable = visionRecipes.filter((recipe) =>
        (recipe.title && recipe.title.trim())
        || recipe.ingredients.length
        || recipe.instructions.length
      );
      if (!usable.length) {
        return new Response(
          JSON.stringify({ error: screenshotReadError(lang), llmError: llmDiag }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const translated = await translateRecipeList(
        usable,
        lang,
        undefined,
        usable[0].title || 'Recipe',
      );
      const first = translated[0];
      const isPartial = !first.ingredients.length && !first.instructions.length;
      return new Response(
        JSON.stringify({
          ...first,
          recipes: translated,
          sourceLang: undefined,
          translated: true,
          note: isPartial ? 'partial_screenshot' : undefined,
          llmError: llmDiag,
          translateError: translateDiag,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isFacebook = isFacebookUrl(url);
    const isSocial = /instagram\.com|tiktok\.com|facebook\.com|fb\.watch/i.test(url);
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);

    // ── Social media branch: microlink.io free API for OG metadata ──
    if (isSocial) {
      let sourceUrl = url;
      if (isFacebook) sourceUrl = await resolveFacebookUrl(url);

      let mlTitle: string | undefined;
      let mlDesc: string | undefined;
      let mlImage: string | undefined;

      const dropChromeMeta = () => {
        if (mlTitle && (
          looksLikeUrlJunk(mlTitle, sourceUrl)
          || looksLikeFacebookChrome(mlTitle)
          || looksLikeBio(sanitizeTitle(mlTitle))
        )) {
          mlTitle = undefined;
        }
        if (mlDesc && (isLoginWallText(mlDesc) || looksLikeFacebookChrome(mlDesc))) {
          mlDesc = undefined;
        }
      };

      const pickCaption = (title?: string, desc?: string) => {
        const d = unwrapSocialQuote(desc ?? '');
        const t = title ? stripMetaChrome(title) : '';
        const picked = t.length > d.length * 1.3 && t.length > d.length + 80 ? t : d;
        return isLoginWallText(picked) || looksLikeFacebookChrome(picked) ? '' : picked;
      };

      // Primary: microlink.io (bypasses CORS + bot-detection for public posts)
      try {
        const mlRes = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(sourceUrl)}&screenshot=false`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) },
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

      dropChromeMeta();
      let rawCaption = pickCaption(mlTitle, mlDesc);

      const ingestHtml = (html: string) => {
        if (isLoginWallText(html.slice(0, 8000))) return;
        const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        const pageOgTitle = extractMeta(html, 'og:title', 'property')
          ?? (pageTitle ? decodeEntities(pageTitle) : undefined);
        const pageOgDesc = extractMeta(html, 'og:description', 'property') ?? undefined;
        const pageImage = extractMeta(html, 'og:image', 'property')
          ?? extractMeta(html, 'og:image:url', 'property')
          ?? extractMeta(html, 'twitter:image', 'name')
          ?? extractMeta(html, 'twitter:image:src', 'name')
          ?? extractPageImage(html, sourceUrl);
        if (!mlTitle && pageOgTitle && !looksLikeFacebookChrome(pageOgTitle)) mlTitle = pageOgTitle;
        if (!mlDesc && pageOgDesc && !isLoginWallText(pageOgDesc)) mlDesc = pageOgDesc;
        if (!mlImage && isUsableImageUrl(pageImage)) mlImage = pageImage;
        const fromPage = htmlToCaption(html, sourceUrl);
        const embedded = /instagram\.com/i.test(sourceUrl) ? extractInstagramEmbeddedRecipe(html) : '';
        const pageCaption = embedded
          || (fromPage.text.length > 80 ? fromPage.text : pickCaption(pageOgTitle, pageOgDesc));
        rawCaption = betterSocialText(rawCaption, pageCaption);
      };

      // Direct HTML fills missing photo/title and a richer caption. Previously this ran only
      // when both were empty, so a stub image from Microlink skipped the page entirely.
      if (!mlImage || captionLooksThin(rawCaption)) {
        try {
          const pageRes = await fetchPage(sourceUrl);
          if (pageRes.ok) ingestHtml(await pageRes.text());
        } catch { /* ignore */ }
      }

      if (isFacebook && captionLooksThin(rawCaption)) {
        const oem = await fetchFacebookOembed(sourceUrl)
          ?? (sourceUrl !== url ? await fetchFacebookOembed(url) : undefined);
        if (oem?.text) {
          rawCaption = oem.text;
          if (!mlTitle && oem.author) mlTitle = oem.author;
        }
      }

      if (isFacebook && captionLooksThin(rawCaption)) {
        try {
          const mb = await fetchPage(toMbasicFacebookUrl(sourceUrl));
          if (mb.ok) ingestHtml(await mb.text());
        } catch { /* ignore */ }
      }

      dropChromeMeta();
      if (!rawCaption) rawCaption = pickCaption(mlTitle, mlDesc);

      // Jina + HTML proxy run whenever the caption cannot hold a recipe — not only on ellipsis.
      let usedReader = false;
      const applyReader = async (target = sourceUrl) => {
        usedReader = true;
        const full = await fetchFullText(target);
        if (full?.html && /instagram\.com/i.test(target)) {
          rawCaption = betterSocialText(rawCaption, extractInstagramEmbeddedRecipe(full.html));
        }
        if (full?.text) rawCaption = betterSocialText(rawCaption, full.text);
        if (!mlImage && full?.image) mlImage = full.image;
      };
      if (captionLooksThin(rawCaption)) await applyReader();

      if (isLoginWallText(rawCaption) || looksLikeFacebookChrome(rawCaption)) rawCaption = '';

      let cleanDesc = rawCaption ? cleanSocialText(splitCaptionLines(rawCaption)) : '';
      if (isLoginWallText(cleanDesc)) cleanDesc = '';
      let parsed = await structureCaption(cleanDesc, lang);

      // Quality gate: a card with no ingredients is not done while the reader is still untried.
      if (!parsed.ingredients.length && !usedReader) {
        await applyReader();
        if (isLoginWallText(rawCaption) || looksLikeFacebookChrome(rawCaption)) rawCaption = '';
        cleanDesc = rawCaption ? cleanSocialText(splitCaptionLines(rawCaption)) : '';
        if (isLoginWallText(cleanDesc)) cleanDesc = '';
        parsed = await structureCaption(cleanDesc, lang);
      }

      const { structured } = parsed;
      const finalIngredients = parsed.ingredients.filter((i) => !isJunkIngredient(i));
      const finalInstructions = parsed.instructions;
      const isPartial = !finalIngredients.length;
      const captionTruncated = /[…]\s*$/.test(rawCaption) || /\.\.\.\s*$/.test(rawCaption);

      if (isFacebook && (!cleanDesc || isLoginWallText(cleanDesc)) && !finalIngredients.length) {
        return new Response(
          JSON.stringify({ error: facebookReadError(lang), readerError: readerDiag }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!cleanDesc && !mlImage) {
        return new Response(
          JSON.stringify({
            error: lang === 'ru'
              ? 'Не удалось получить данные поста: соцсеть ничего не отдала, а сервис чтения сейчас недоступен. Попробуйте ещё раз через минуту.'
              : 'Could not read this post: the network returned nothing and the reader service is unavailable. Please try again in a minute.',
            readerError: readerDiag,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const structuredTitle = structured?.title?.trim() ?? '';
      const rawTitle = (structuredTitle
        && !looksLikeFacebookChrome(structuredTitle)
        && !looksLikeBio(structuredTitle))
        ? structuredTitle
        : stripMetaChrome(mlTitle ?? '');
      let finalTitle = sanitizeTitle(rawTitle);
      if (looksLikeFacebookChrome(finalTitle) || looksLikeBio(finalTitle)) finalTitle = '';
      if (finalTitle.length > 80) finalTitle = sanitizeTitle(finalTitle.split(/[.!?]/)[0]);
      if (!finalTitle || looksLikeBio(finalTitle) || looksLikeFacebookChrome(finalTitle)) {
        const firstLine = cleanDesc.split('\n').find((l) => {
          const candidate = sanitizeTitle(l.split(/[.!?]/)[0]);
          return candidate.length > 2
            && !looksLikeFacebookChrome(candidate)
            && !looksLikeBio(candidate);
        }) ?? '';
        const candidate = sanitizeTitle(firstLine.split(/[.!?]/)[0]);
        if (candidate.length > 2 && !looksLikeFacebookChrome(candidate) && !looksLikeBio(candidate)) {
          finalTitle = candidate;
        }
      }

      if (isFacebook && (!finalTitle || looksLikeFacebookChrome(finalTitle)) && !finalIngredients.length) {
        return new Response(
          JSON.stringify({ error: facebookReadError(lang), readerError: readerDiag }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const structuredDesc = structured?.description ?? '';
      let socialOut = {
        title: finalTitle,
        description: structuredDesc
          && !isLoginWallText(structuredDesc)
          && !looksLikeFacebookChrome(structuredDesc)
          && !looksLikeCommentBlurb(structuredDesc)
          ? structuredDesc
          : extractIntro(cleanDesc),
        ingredients: finalIngredients,
        instructions: finalInstructions,
      };
      socialOut = await translateIfNeeded(
        socialOut,
        undefined,
        lang,
      );

      const out = cleanTexts(socialOut);
      const extraRecipes = parsed.recipes.length > 1
        ? await translateRecipeList(parsed.recipes.slice(1), lang, undefined, out.title || 'Recipe')
        : [];
      const recipes = [out, ...extraRecipes].map((recipe) => ({ ...recipe, imageUrl: mlImage }));

      return new Response(
        JSON.stringify({
          ...out,
          categoryHint: '',
          imageUrl: mlImage,
          sourceLang: undefined,
          recipes,
          note: captionTruncated ? 'social_truncated' : isPartial ? 'partial_social' : undefined,
          llmError: llmDiag,
          translateError: translateDiag,
          readerError: readerDiag,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── YouTube branch: Data API v3 (primary) → oEmbed → page scrape, then LLM ──
    if (isYouTube) {
      let videoTitle = '';
      let videoThumb: string | undefined;
      let videoDesc = '';
      let sourceLang: string | undefined;

      const videoId = extractYouTubeId(url);
      const hasApiKey = !!Deno.env.get('YOUTUBE_API_KEY');

      // Step 1: official Data API — the only reliable description source server-side
      if (videoId) {
        const api = await fetchYouTubeViaApi(videoId);
        if (api) {
          videoTitle = api.title ?? '';
          videoThumb = api.thumbnail;
          videoDesc = api.description ?? '';
          sourceLang = api.sourceLang;
        }
      }

      // Step 2: oEmbed — no auth needed, fills title/thumbnail when the API is unavailable
      if (!videoTitle || !videoThumb) {
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
            { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) },
          );
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            if (!videoTitle) videoTitle = oembed.title ?? '';
            if (!videoThumb) videoThumb = oembed.thumbnail_url ?? undefined;
          }
        } catch { /* ignore */ }
      }

      // Step 3: page scrape — last resort, usually blocked from datacenter IPs
      if (!videoDesc) {
        try {
          const pageRes = await fetchPage(url);
          if (pageRes.ok) {
            const html = await pageRes.text();
            sourceLang ??= detectSourceLang(html);

            // Embedded player JSON holds the full, untruncated description
            videoDesc = extractYouTubeDescription(html);

            // VideoObject JSON-LD for title/thumbnail, and description only as a fallback
            const ldBlocks = extractLdJsonBlocks(html);
            for (const parsed of ldBlocks) {
              const node = Array.isArray(parsed)
                ? parsed.map(findVideoNode).find(Boolean)
                : findVideoNode(parsed);
              if (node) {
                if (!videoTitle && node.name) videoTitle = stripHtml(String(node.name));
                if (!videoDesc && node.description) videoDesc = stripHtml(String(node.description));
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
        } catch { /* page fetch failed — proceed with API/oEmbed data only */ }
      }

      // Step 4: clean noise then structure (LLM if available, regex fallback)
      const cleanDesc = cleanSocialText(videoDesc);
      const llmResult = cleanDesc ? await tryLlmStructure(cleanDesc, lang) : null;
      const llmRecipes = llmResult?.recipes?.length ? llmResult.recipes : (llmResult
        ? [{
            title: llmResult.title,
            description: llmResult.description,
            ingredients: llmResult.ingredients,
            instructions: llmResult.instructions,
          }]
        : []);
      const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };

      const firstLlm = llmRecipes[0];
      const finalIngredients = firstLlm?.ingredients?.length ? firstLlm.ingredients : regexResult.ingredients;
      const finalInstructions = splitLongSteps(
        firstLlm?.instructions?.length ? firstLlm.instructions : regexResult.instructions,
      );
      const finalTitle = (firstLlm?.title && firstLlm.title.trim()) ? firstLlm.title : videoTitle;
      const finalDescription = firstLlm?.description ?? cleanDesc;

      // Distinguish "no key configured" from "this video has no recipe in its description",
      // so an empty card is never returned without a reason the user can act on.
      let ytNote: string | undefined;
      if (!finalIngredients.length && !finalInstructions.length) {
        // No title either means the video itself is gone or private, which is worth saying —
        // "no recipe in the description" would send the user looking for a description that
        // was never reachable.
        if (!cleanDesc && !videoTitle) ytNote = 'youtube_unavailable';
        else if (!cleanDesc) ytNote = hasApiKey ? 'youtube_no_description' : 'youtube_missing_api_key';
        else ytNote = 'partial_social';
      }

      // As in the social branch: the regex fallback does not translate, so cover it here.
      let ytOut = {
        title: sanitizeTitle(finalTitle),
        description: finalDescription,
        ingredients: finalIngredients,
        instructions: finalInstructions,
      };
      ytOut = await translateIfNeeded(ytOut, sourceLang, lang);

      const out = cleanTexts(ytOut);
      const extraRecipes = llmRecipes.length > 1
        ? await translateRecipeList(llmRecipes.slice(1), lang, sourceLang, out.title || videoTitle)
        : [];
      const recipes = [out, ...extraRecipes].map((recipe) => ({ ...recipe, imageUrl: videoThumb }));

      return new Response(
        JSON.stringify({
          ...out,
          categoryHint: '',
          imageUrl: videoThumb,
          sourceLang,
          recipes,
          note: ytNote,
          llmError: llmDiag,
          translateError: translateDiag,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch the page (generic path) ──
    let html = '';
    let readerImage: string | undefined;
    let usedGenericReader = false;
    try {
      const pageRes = await fetchPage(url);
      if (pageRes.ok) html = await pageRes.text();
    } catch { /* fall through to the reader */ }

    // Datacenter IPs are often blocked. Jina then the HTML proxy recover the same page
    // that a browser can open, instead of returning 502 before any recipe logic runs.
    if (html.length < 800) {
      usedGenericReader = true;
      const full = await fetchFullText(url);
      if (full?.html && full.html.length > html.length) html = full.html;
      else if (full?.text) {
        html = `<article>${full.text.split('\n').map((l) => `<p>${l}</p>`).join('')}</article>`;
      }
      if (full?.image) readerImage = full.image;
    }

    if (!html) {
      return new Response(
        JSON.stringify({
          error: lang === 'ru'
            ? 'Не удалось открыть страницу. Попробуйте ещё раз через минуту.'
            : 'Could not open this page. Please try again in a minute.',
          readerError: readerDiag,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Detect page language from html lang, og:locale or content-language.
    // Augmented below with JSON-LD inLanguage once the Recipe node is resolved.
    let sourceLang = detectSourceLang(html);

    const ldBlocks = html ? extractLdJsonBlocks(html) : [];

    // Shared OG/Twitter meta extraction
    const ogTitle   = html ? extractMeta(html, 'og:title', 'property') : undefined;
    const ogDesc    = html ? extractMeta(html, 'og:description', 'property') : undefined;
    const ogImage   = html
      ? (extractMeta(html, 'og:image', 'property')
        ?? extractMeta(html, 'og:image:url', 'property')
        ?? extractMeta(html, 'og:image:secure_url', 'property'))
      : undefined;
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

    // No Recipe JSON-LD: read the article body instead. Falling back to og tags alone left
    // the card with a title and nothing else, and skipped translation entirely.
    if (!recipe) {
      let article = await recipeFromArticle(html, lang);
      if ((!article || !(article.recipeIngredient as unknown[])?.length) && !usedGenericReader) {
        usedGenericReader = true;
        const full = await fetchFullText(url);
        if (full?.html && full.html.length > html.length) {
          html = full.html;
          article = await recipeFromArticle(html, lang) ?? article;
        } else if (full?.text) {
          article = await recipeFromText(full.text, lang) ?? article;
        }
        if (full?.image) readerImage = full.image;
      }
      if (article || ogTitle || pageTitle) {
        recipe = {
          name: article?.name || ogTitle || pageTitle || '',
          description: article?.description || ogDesc || '',
          recipeIngredient: article?.recipeIngredient ?? [],
          recipeInstructions: article?.recipeInstructions ?? [],
        };
      } else {
        return new Response(
          JSON.stringify({ error: 'No recipe data found on this page' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else if (!Array.isArray(recipe.recipeIngredient) || !recipe.recipeIngredient.length) {
      let article = await recipeFromArticle(html, lang);
      if (!article && !usedGenericReader) {
        usedGenericReader = true;
        const full = await fetchFullText(url);
        if (full?.html) article = await recipeFromArticle(full.html, lang);
        else if (full?.text) article = await recipeFromText(full.text, lang);
        if (full?.image) readerImage = full.image;
      }
      if (article) {
        recipe.recipeIngredient = article.recipeIngredient;
        if (!flattenInstructions(recipe.recipeInstructions).length) {
          recipe.recipeInstructions = article.recipeInstructions;
        }
      }
    }

    if (!sourceLang && typeof recipe.inLanguage === 'string') {
      sourceLang = normalizeLang(recipe.inLanguage);
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
    if (!calories) calories = parseKcalFromHtml(html);

    let protein: string | undefined = extractNutrient(nutrition, 'proteinContent');
    if (!protein) protein = parseMacroFromHtml(html, 'белк[иа]');

    let fat: string | undefined = extractNutrient(nutrition, 'fatContent');
    if (!fat) fat = parseMacroFromHtml(html, 'жир[ыа]');

    let carbs: string | undefined = extractNutrient(nutrition, 'carbohydrateContent');
    if (!carbs) carbs = parseMacroFromHtml(html, 'углевод[ыа]');

    const servings = parseNutritionNumber(
      Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield,
    ) ?? parseNutritionNumber(html.match(/(\d+)\s*порц/i)?.[1]);

    // ── Image: JSON-LD → og:image → featured/microdata <img> ──
    let imageUrl: string | undefined;
    if (recipe.image) {
      imageUrl = extractImageUrl(recipe.image, url);
    }
    if (!imageUrl) {
      const metaImage =
        extractMeta(html, 'og:image', 'property') ??
        extractMeta(html, 'og:image:url', 'property') ??
        extractMeta(html, 'og:image:secure_url', 'property') ??
        extractMeta(html, 'twitter:image', 'name') ??
        extractMeta(html, 'twitter:image:src', 'name') ??
        ogImage ??
        twImage;
      imageUrl = isUsableImageUrl(metaImage)
        ? absolutizeUrl(metaImage, url)
        : undefined;
    }
    if (!imageUrl) imageUrl = extractPageImage(html, url);
    if (!imageUrl && isUsableImageUrl(readerImage)) imageUrl = readerImage;

    // ── Translate into the app language when the source page is in another language ──
    let outTitle = title;
    let outDesc = description ?? '';
    let outIngredients = ingredients;
    let outInstructions = instructions;

    // Content decides, because page metadata is wrong often enough to send a Russian recipe
    // off to be translated from Romanian; sourceLang is only the fallback signal.
    const original = { title, description: description ?? '', ingredients, instructions };
    const langSample = leftoverSourceSample(original, lang);
    const from = await translateFrom(langSample, sourceLang, lang);
    sourceLang = from ? (from === 'auto' ? sourceLang : from) : lang;

    const tr = await translateIfNeeded(
      original,
      sourceLang === lang ? undefined : sourceLang,
      lang,
    );
    outTitle = tr.title || outTitle;
    outDesc = tr.description || outDesc;
    if (tr.ingredients.length) outIngredients = tr.ingredients;
    if (tr.instructions.length) outInstructions = tr.instructions;
    const translated = recipeFieldsChanged(tr, original);

    return new Response(
      JSON.stringify({
        ...cleanTexts({
          title: outTitle,
          description: outDesc,
          ingredients: outIngredients,
          instructions: outInstructions,
        }),
        categoryHint: String(categoryHint),
        calories,
        protein,
        fat,
        carbs,
        servings,
        imageUrl,
        sourceLang,
        translated,
        llmError: llmDiag,
        translateError: translateDiag,
        readerError: readerDiag,
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
