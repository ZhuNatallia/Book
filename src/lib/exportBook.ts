import { FullRecipe, Language } from '../types';
import { isSampleRecipeId } from './recipeDb';

export type BookExportLabels = {
  appName: string;
  ingredients: string;
  steps: string;
  servings: string;
  notes: string;
  source: string;
};

function pick<T extends { language: string }>(rows: T[], lang: string): T | undefined {
  return rows.find((r) => r.language === lang) || rows.find((r) => r.language === 'ru') || rows[0];
}

export function ownRecipes(recipes: FullRecipe[]): FullRecipe[] {
  return recipes.filter((r) => !isSampleRecipeId(r.recipe.id));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipePlain(full: FullRecipe, lang: Language, categoryLabel: (key: string) => string) {
  const tr = pick(full.translations, lang);
  const ingredients = full.ingredients
    .map((ing) => {
      const name = pick(ing.translations, lang)?.name || ing.name || '';
      const qty = ing.quantity ? String(ing.quantity) : '';
      const unit = ing.unit || '';
      return { name, quantity: qty, unit, line: [qty, unit, name].filter(Boolean).join(' ') };
    })
    .filter((ing) => ing.name.trim());
  const steps = [...full.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => pick(step.translations, lang)?.instruction || step.instruction || '')
    .filter((s) => s.trim());
  return {
    id: full.recipe.id,
    title: tr?.title || '',
    description: tr?.description || '',
    category: categoryLabel(full.recipe.category),
    servings: full.recipe.servings,
    calories: full.recipe.calories ?? null,
    protein: full.recipe.protein ?? null,
    fat: full.recipe.fat ?? null,
    carbs: full.recipe.carbs ?? null,
    notes: full.recipe.notes || '',
    sourceUrl: full.recipe.sourceUrl || '',
    tags: full.recipe.tags ?? [],
    imageUrl: full.recipe.imageUrl?.startsWith('http') ? full.recipe.imageUrl : '',
    ingredients,
    steps,
  };
}

export function downloadBookJson(
  recipes: FullRecipe[],
  lang: Language,
  email: string | undefined,
  categoryLabel: (key: string) => string,
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    language: lang,
    email: email || null,
    recipes: ownRecipes(recipes).map((r) => recipePlain(r, lang, categoryLabel)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-recipe-book-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printBookPdf(
  recipes: FullRecipe[],
  lang: Language,
  labels: BookExportLabels,
  categoryLabel: (key: string) => string,
) {
  const items = ownRecipes(recipes).map((r) => recipePlain(r, lang, categoryLabel));
  const pages = items
    .map((r) => {
      const ings = r.ingredients
        .map((ing) => `<li>${escapeHtml(ing.line)}</li>`)
        .join('');
      const steps = r.steps
        .map((s, i) => `<li><span class="n">${i + 1}.</span> ${escapeHtml(s)}</li>`)
        .join('');
      const photo = r.imageUrl
        ? `<img src="${escapeHtml(r.imageUrl)}" alt="" />`
        : '';
      const notes = r.notes
        ? `<p class="notes"><strong>${escapeHtml(labels.notes)}:</strong> ${escapeHtml(r.notes)}</p>`
        : '';
      const source = r.sourceUrl
        ? `<p class="src">${escapeHtml(labels.source)}: ${escapeHtml(r.sourceUrl)}</p>`
        : '';
      return `<article>
        <h2>${escapeHtml(r.title)}</h2>
        <p class="meta">${escapeHtml(r.category)}${r.servings ? ` · ${escapeHtml(labels.servings)}: ${r.servings}` : ''}</p>
        ${r.description ? `<p>${escapeHtml(r.description)}</p>` : ''}
        ${photo}
        <h3>${escapeHtml(labels.ingredients)}</h3>
        <ul>${ings || '<li>—</li>'}</ul>
        <h3>${escapeHtml(labels.steps)}</h3>
        <ol class="steps">${steps || '<li>—</li>'}</ol>
        ${notes}
        ${source}
      </article>`;
    })
    .join('');

  const html = `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8" />
<title>${escapeHtml(labels.appName)}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #222; line-height: 1.45; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  .date { color: #666; font-size: 13px; margin-bottom: 32px; }
  article { break-inside: avoid; page-break-after: always; padding-bottom: 24px; }
  article:last-child { page-break-after: auto; }
  h2 { font-size: 22px; margin: 0 0 6px; }
  h3 { font-size: 15px; margin: 16px 0 8px; }
  .meta { color: #666; font-size: 13px; margin: 0 0 10px; }
  img { max-width: 100%; max-height: 280px; object-fit: contain; display: block; margin: 12px 0; }
  ul, .steps { padding-left: 20px; margin: 0; }
  .steps { list-style: none; padding-left: 0; }
  .steps .n { font-weight: 700; margin-right: 6px; }
  .notes, .src { font-size: 13px; color: #444; }
  .src { word-break: break-all; }
</style></head><body>
<h1>${escapeHtml(labels.appName)}</h1>
<p class="date">${escapeHtml(new Date().toLocaleDateString(lang))}</p>
${pages || `<p>—</p>`}
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    w.print();
  }, 400);
  return true;
}
