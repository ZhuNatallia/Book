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
const MEASURE = /(?<!\w)\d+[.,]?\d*\s*(г|гр|кг|мл|л|шт|ст\.?\s*л\.?|ч\.?\s*л\.?|стакан|стак|щепотк|g|kg|ml|oz|lb|cup|tbsp|tsp|pcs|piece)\b/i;

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

function stripMetaChrome(raw: string): string {
  let s = raw.trim();
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
  for (const m of postSection.matchAll(READER_IMAGE_RE)) {
    const src = m[1];
    if (/emoji\.php|rsrc\.php|static\.|\.ico(\?|$)|\.svg(\?|$)/i.test(src)) continue;
    if (!/scontent|fbcdn|cdninstagram|tiktokcdn/i.test(src)) continue;
    return src;
  }
  return undefined;
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

function htmlToCaption(html: string): { text: string; image?: string } {
  const text = extractArticleText(html);
  const image =
    extractMeta(html, 'og:image', 'property') ??
    extractMeta(html, 'twitter:image', 'name') ??
    extractMeta(html, 'twitter:image:src', 'name');
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

  const fromHtml = htmlToCaption(html);
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
    || looksLikeFacebookChrome(s);
}

async function structureCaption(
  cleanDesc: string,
  lang: string,
): Promise<{
  structured: { title?: string; description?: string; ingredients: string[]; instructions: string[] } | null;
  ingredients: string[];
  instructions: string[];
}> {
  const structured = cleanDesc.length > 50 ? await tryLlmStructure(cleanDesc, lang) : null;
  const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };
  return {
    structured,
    ingredients: structured?.ingredients?.length ? structured.ingredients : regexResult.ingredients,
    instructions: splitLongSteps(
      structured?.instructions?.length ? structured.instructions : regexResult.instructions,
    ),
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
const BIO_WORDS = /(врач|нутрициолог|диетолог|коуч|тренер|психолог|блогер|блоггер|эксперт|автор|шеф|повар|доктор|md|phd|doctor|nutritionist|dietitian|coach|chef|blogger|author|founder)/i;

// Detect when a sanitized title is still just an account bio rather than a recipe name.
function looksLikeBio(t: string): boolean {
  const sep = (t.match(/[|•·]/g) ?? []).length;
  if (sep >= 2) return true;                    // "Name | role • role" is a bio, not a dish
  if (sep >= 1 && BIO_WORDS.test(t)) return true; // separator + profession word
  return sep >= 1 && !/\d/.test(t) && t.split(/\s+/).length < 12;
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
function extractNutrient(nutrition: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!nutrition) return undefined;
  const raw = nutrition[key];
  if (raw === undefined || raw === null) return undefined;
  const m = String(raw).replace(',', '.').match(/[\d.]+/);
  return m ? Math.round(Number(m[0])).toString() : undefined;
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

// llama-3.1-8b-instant is deprecated by Groq with a 2026-08-16 shutdown.
// Overridable via GROQ_MODEL so the next migration needs no code change.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

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
async function callLlm(body: Record<string, unknown>, label: string): Promise<any | null> {
  const llm = resolveLlm();
  if (!llm) return null;

  // Only the gpt-oss family accepts reasoning_effort (low/medium/high); other Groq models
  // reject the field outright, so it is added conditionally. 'low' minimises the tokens
  // burned on reasoning before the model starts writing JSON.
  const extras = llm.model.startsWith('openai/gpt-oss')
    ? { reasoning_effort: 'low' }
    : {};

  const post = (payload: Record<string, unknown>) =>
    fetch(llm.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: llm.model, ...extras, ...payload }),
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
      console.error(`[llm] ${label} failed`, res.status, llm.model, detail);
      return null;
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      llmDiag = `${label}_empty_content`;
      console.error(`[llm] ${label} empty content`, JSON.stringify(json).slice(0, 300));
      return null;
    }

    const parsed = parseLlmJson(content);
    if (!parsed) {
      llmDiag = `${label}_bad_json`;
      console.error(`[llm] ${label} unparseable JSON`, content.slice(0, 300));
      return null;
    }
    return parsed;
  } catch (err) {
    llmDiag = `${label}_exception: ${String(err).slice(0, 200)}`;
    console.error(`[llm] ${label} threw`, err);
    return null;
  }
}

// Optional LLM structuring — supports Groq (free) or OpenAI.
// Priority: GROQ_API_KEY (free) → OPENAI_API_KEY (paid). Returns null when no key is set.
async function tryLlmStructure(
  rawText: string,
  targetLang: string,
  maxChars = 3000,
): Promise<{ title?: string; description?: string; ingredients: string[]; instructions: string[] } | null> {
  if (rawText.length < 50) return null;

  const text = rawText.slice(0, maxChars);
  const out = await callLlm({
    // Extraction discards filler, so the result is smaller than the source
    max_tokens: budgetMaxTokens(text.length + 800, 3000),
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `You are a recipe extraction assistant.
Extract ONLY recipe content from the text below. Ignore all social media metadata (likes, views, comments, shares, follower counts, platform names like "Instagram Reel", "TikTok video").

Respond in ${llmLangName(targetLang)}. Translate if the source is in a different language.

Return ONLY valid JSON with these keys:
- title: the dish name ONLY (e.g. "Шоколадное печенье"). Never include author handles (@username), account names, platform labels ("Instagram Reel"), or engagement numbers. If no clear dish name exists, return "".
- description: brief intro / context sentence(s) only (max 2 sentences, or empty string "")
- ingredients: array of strings, each one ingredient with quantity + unit + name, e.g. "200г муки" or "2 яйца"
- instructions: array of strings, one short step per array item, in order. Never return the whole method as a single item: split it into separate steps at each distinct action (prepare, mix, bake, assemble, ...).

If no recipe is found return { "title": "", "description": "", "ingredients": [], "instructions": [] }.
Do not invent data not present in the text.

Text:
${text}`,
    }],
  }, 'structure');

  if (!out) return null;
  return {
    title: typeof out.title === 'string' ? out.title : undefined,
    description: typeof out.description === 'string' ? out.description : undefined,
    ingredients: Array.isArray(out.ingredients) ? out.ingredients.map(String) : [],
    instructions: Array.isArray(out.instructions) ? out.instructions.map(String) : [],
  };
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

async function translateIfNeeded(
  payload: { title: string; description: string; ingredients: string[]; instructions: string[] },
  metaLang: string | undefined,
  targetLang: string,
): Promise<typeof payload> {
  const sample = [payload.title, payload.description, ...payload.ingredients.slice(0, 5)].join(' ');
  let from = await translateFrom(sample, metaLang, targetLang);
  // Body can already be in the app language (LLM structured it) while the title is still
  // the original. translateFrom then sees "already German" and skips the Russian title.
  if (!from && (needsTranslation(payload.title, targetLang) || scriptsDisagree(payload.title, targetLang))) {
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
      const changed = translated.title !== payload.title || translated.description !== payload.description;
      return new Response(
        JSON.stringify({ ...cleanTexts(translated), translated: changed }),
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
        if (mlTitle && (looksLikeUrlJunk(mlTitle, sourceUrl) || looksLikeFacebookChrome(mlTitle))) {
          mlTitle = undefined;
        }
        if (mlDesc && (isLoginWallText(mlDesc) || looksLikeFacebookChrome(mlDesc))) {
          mlDesc = undefined;
        }
      };

      const pickCaption = (title?: string, desc?: string) => {
        const d = desc ?? '';
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
          ?? extractMeta(html, 'twitter:image', 'name')
          ?? extractMeta(html, 'twitter:image:src', 'name');
        if (!mlTitle && pageOgTitle && !looksLikeFacebookChrome(pageOgTitle)) mlTitle = pageOgTitle;
        if (!mlDesc && pageOgDesc && !isLoginWallText(pageOgDesc)) mlDesc = pageOgDesc;
        if (!mlImage && pageImage) mlImage = pageImage;
        const fromPage = htmlToCaption(html);
        const pageCaption = fromPage.text.length > 80 ? fromPage.text : pickCaption(pageOgTitle, pageOgDesc);
        if (pageCaption.length > rawCaption.length && !isLoginWallText(pageCaption)) {
          rawCaption = pageCaption;
        }
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
        if (full && full.text.length > rawCaption.length && !isLoginWallText(full.text)) {
          rawCaption = full.text;
        }
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

      const rawTitle = (structured?.title && structured.title.trim() && !looksLikeFacebookChrome(structured.title))
        ? structured.title
        : stripMetaChrome(mlTitle ?? '');
      let finalTitle = sanitizeTitle(rawTitle);
      if (looksLikeFacebookChrome(finalTitle)) finalTitle = '';
      if (finalTitle.length > 80) finalTitle = sanitizeTitle(finalTitle.split(/[.!?]/)[0]);
      if (!finalTitle || looksLikeBio(finalTitle) || looksLikeFacebookChrome(finalTitle)) {
        const firstLine = cleanDesc.split('\n').find((l) => l.trim().length > 3) ?? '';
        const candidate = sanitizeTitle(firstLine.split(/[.!?]/)[0]);
        if (candidate.length > 2 && !looksLikeFacebookChrome(candidate)) finalTitle = candidate;
      }

      if (isFacebook && (!finalTitle || looksLikeFacebookChrome(finalTitle)) && !finalIngredients.length) {
        return new Response(
          JSON.stringify({ error: facebookReadError(lang), readerError: readerDiag }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let socialOut = {
        title: finalTitle,
        description: structured?.description && !isLoginWallText(structured.description) && !looksLikeFacebookChrome(structured.description)
          ? structured.description
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

      return new Response(
        JSON.stringify({
          ...out,
          categoryHint: '',
          imageUrl: mlImage,
          sourceLang: undefined,
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
      const regexResult = cleanDesc ? parseDescriptionText(cleanDesc) : { ingredients: [], instructions: [] };

      const finalIngredients = llmResult?.ingredients?.length ? llmResult.ingredients : regexResult.ingredients;
      const finalInstructions = splitLongSteps(
        llmResult?.instructions?.length ? llmResult.instructions : regexResult.instructions,
      );
      const finalTitle = (llmResult?.title && llmResult.title.trim()) ? llmResult.title : videoTitle;
      const finalDescription = llmResult?.description ?? cleanDesc;

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

      return new Response(
        JSON.stringify({
          ...out,
          categoryHint: '',
          imageUrl: videoThumb,
          sourceLang,
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
        twImage ??
        readerImage;
    }

    // ── Translate into the app language when the source page is in another language ──
    let outTitle = title;
    let outDesc = description ?? '';
    let outIngredients = ingredients;
    let outInstructions = instructions;

    // Content decides, because page metadata is wrong often enough to send a Russian recipe
    // off to be translated from Romanian; sourceLang is only the fallback signal.
    const langSample = [title, ...ingredients.slice(0, 5), instructions[0] ?? ''].join(' ');
    const from = await translateFrom(langSample, sourceLang, lang);
    let translated = false;
    sourceLang = from ? (from === 'auto' ? sourceLang : from) : lang;

    const tr = await translateIfNeeded(
      { title, description: description ?? '', ingredients, instructions },
      sourceLang === lang ? undefined : sourceLang,
      lang,
    );
    if (tr.title !== title || tr.description !== (description ?? '')) {
      translated = true;
      outTitle = tr.title || outTitle;
      outDesc = tr.description || outDesc;
      if (tr.ingredients.length) outIngredients = tr.ingredients;
      if (tr.instructions.length) outInstructions = tr.instructions;
    }

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
