import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { RECIPE_CATEGORIES } from '../data/categories';
import { supabase } from '../lib/supabase';
import { X, Wand2, CreditCard as Edit3, Plus, Trash2, Loader2, CheckCircle, Link2, Download, Sparkles, Film, Camera, AlertCircle } from 'lucide-react';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: FullRecipe) => void;
  editingRecipe?: FullRecipe | null;
}

interface ParsedRecipe {
  title: string;
  description?: string;
  category: string;
  servings?: string;
  ingredients: { quantity: number; unit: string; name: string }[];
  steps: { instruction: string; timerMinutes?: number }[];
  imageUrl?: string;
  calories?: string;
  protein?: string;
  fat?: string;
  carbs?: string;
  sourceLang?: string;
  translated?: boolean;
  note?: string;
}

const capitalizeFirst = (s: string): string =>
  s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = objectUrl;
  });
}

function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('пицц') || t.includes('pizza'))                                                                   return 'pizza';
  if (t.includes('мясо') || t.includes('говядин') || t.includes('meat') || t.includes('beef'))                    return 'meat';
  if (t.includes('кур') || t.includes('chicken'))                                                                  return 'poultry';
  if (t.includes('рыб') || t.includes('fish'))                                                                     return 'fish';
  if (t.includes('блин') || t.includes('пиро') || t.includes('торт') || t.includes('cake') || t.includes('pastry')) return 'pastry';
  if (t.includes('салат') || t.includes('salad'))                                                                  return 'salad';
  if (t.includes('суп') || t.includes('soup'))                                                                     return 'soup';
  if (t.includes('пп') || t.includes('healthy'))                                                                   return 'healthy';
  return ''; // no confident match — user must select
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\./g, '');
  // Longer prefixes first: "килограмм" must not be read as "кг", "миллилитр" not as "литр"
  if (u.startsWith('килограмм')) return 'kg';
  if (u.startsWith('миллилитр')) return 'ml';
  if (u.startsWith('литр')) return 'l';
  if (u.startsWith('грамм')) return 'g';
  if (u.startsWith('штук')) return 'pcs';
  if (['г', 'гр', 'g', 'gram'].includes(u)) return 'g';
  if (['мл', 'ml'].includes(u)) return 'ml';
  if (['кг', 'kg'].includes(u)) return 'kg';
  if (['л', 'l'].includes(u)) return 'l';
  if (['шт', 'pcs', 'piece'].includes(u)) return 'pcs';
  if (u === 'cup' || u.startsWith('стакан')) return 'cup';
  if (['ст л', 'стл', 'tbsp', 'tablespoon'].includes(u)) return 'tbsp';
  if (['ч л', 'чл', 'tsp', 'teaspoon'].includes(u)) return 'tsp';
  if (['по вкусу', 'pinch'].includes(u) || u.startsWith('щепотк')) return 'tsp';
  if (['oz', 'унц'].includes(u)) return 'oz';
  if (['lb', 'фунт'].includes(u)) return 'lb';
  return 'g';
}

// Canonical unit codes stay in state and in the database; these are the ones the
// dictionary can render in the active language. Anything else is shown as-is.
const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'cup'];

// Unit alternatives shared by both patterns below. Longer alternatives come first so the
// longest match wins, and full Russian words are included because sources write both
// "500 г" and "500 грамм".
const UNIT_ALT =
  'килограмм[а-яё]*|миллилитр[а-яё]*|грамм[а-яё]*|литр[а-яё]*|штук[а-яё]*|стакан[а-яё]*|щепотк[а-яё]*|ст\\.?\\s*л\\.?|ч\\.?\\s*л\\.?|гр|кг|мл|шт|г|л|kg|ml|pcs|piece|cup|tbsp|tsp|oz|lb|pinch|g|l';

const QTY = '\\d+(?:[/.,]\\d+)?';

// "2 cups flour", "1/4 tsp salt", "400 г муки". The unit group requires a following space or
// end-of-string, otherwise a bare "л"/"г" would swallow the first letter of a word
// ("1 лавровый лист" -> unit "l", name "авровый лист").
const LEADING_QTY_RE = new RegExp(`^(${QTY})\\s*(?:(${UNIT_ALT})(?=\\s|$))?\\s*(.*)$`, 'i');

// "Куриные бедрышки 500 грамм", "Яйцо 1 шт." — quantity trails the name instead of leading it.
const TRAILING_QTY_RE = new RegExp(`^(.*?)[\\s,\\-–—]+(${QTY})\\s*(${UNIT_ALT})\\.?\\s*$`, 'i');

function toQuantity(raw: string): number {
  if (raw.includes('/')) {
    const p = raw.split('/');
    return parseFloat(p[0]) / parseFloat(p[1] || '1');
  }
  return parseFloat(raw.replace(',', '.')) || 1;
}

function parseIngredientString(raw: string): { quantity: number; unit: string; name: string } {
  const text = raw.trim();

  const lead = text.match(LEADING_QTY_RE);
  if (lead) {
    const name = (lead[3] ?? '').replace(/\s{2,}/g, ' ').trim();
    return {
      quantity: toQuantity(lead[1]),
      unit: lead[2] ? normalizeUnit(lead[2]) : 'pcs',
      name: name || text,
    };
  }

  const trail = text.match(TRAILING_QTY_RE);
  if (trail) {
    const name = trail[1].replace(/\s{2,}/g, ' ').trim();
    if (name) {
      return { quantity: toQuantity(trail[2]), unit: normalizeUnit(trail[3]), name };
    }
  }

  return { quantity: 1, unit: 'pcs', name: text };
}

// Explains why an import came back without ingredients or steps, so the user is never
// left with an empty card and no reason for it.
const IMPORT_NOTE_KEYS: Record<string, string> = {
  youtube_missing_api_key: 'noteYoutubeKey',
  youtube_no_description: 'noteYoutubeNoDesc',
  youtube_unavailable: 'noteYoutubeUnavailable',
  partial_social: 'notePartialSocial',
  social_truncated: 'noteSocialTruncated',
};

export function AddRecipeModal({ isOpen, onClose, onSave, editingRecipe }: AddRecipeModalProps) {
  const { language, t, tCategory } = useLanguage();
  const { theme } = useTheme();
  const unitLabel = (u: string) => (UNIT_KEYS.includes(u) ? t(u) : u);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedRecipe | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingPlatform, setLoadingPlatform] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importingStep, setImportingStep] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [ingredients, setIngredients] = useState([{ quantity: '1', unit: 'g', name: '' }]);
  const [steps, setSteps] = useState([{ instruction: '', timerMinutes: '' as string }]);

  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);

  const isEditMode = !!editingRecipe;

  // Centralised reset — no external deps so it is always stable
  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory(''); setSourceUrl(''); setServings('');
    setCalories(''); setProtein(''); setFat(''); setCarbs('');
    setIngredients([{ quantity: '1', unit: 'g', name: '' }]);
    setSteps([{ instruction: '', timerMinutes: '' }]);
    setImportUrl(''); setParseResult(null); setParseError(null); setLoadingPlatform('');
    setImportingStep(0); setImageUrl(undefined); setIsCompressing(false); setActiveTab('manual');
  };

  // Populate form from editingRecipe when modal opens; reset when opening for a new recipe
  useEffect(() => {
    if (!isOpen) return;
    if (editingRecipe) {
      const trans = editingRecipe.translations.find((t) => t.language === language) ||
        editingRecipe.translations.find((t) => t.language === 'ru');
      setTitle(trans?.title || '');
      setDescription(trans?.description || '');
      setCategory(editingRecipe.recipe.category);
      setSourceUrl(editingRecipe.recipe.sourceUrl || '');
      setServings(String(editingRecipe.recipe.servings || ''));
      setImageUrl(editingRecipe.recipe.imageUrl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = editingRecipe.recipe as any;
      setCalories(r.calories != null ? String(r.calories) : '');
      setProtein(r.protein != null ? String(r.protein) : '');
      setFat(r.fat != null ? String(r.fat) : '');
      setCarbs(r.carbs != null ? String(r.carbs) : '');

      setIngredients(editingRecipe.ingredients.map((ing) => {
        const ingTrans = ing.translations.find((t) => t.language === language) ||
          ing.translations.find((t) => t.language === 'ru');
        return { quantity: String(ing.quantity), unit: ing.unit, name: ingTrans?.name || '' };
      }));

      const sortedSteps = [...editingRecipe.steps].sort((a, b) => a.stepOrder - b.stepOrder);
      setSteps(sortedSteps.map((step) => {
        const stepTrans = step.translations.find((t) => t.language === language) ||
          step.translations.find((t) => t.language === 'ru');
        return { instruction: stepTrans?.instruction || '', timerMinutes: step.timerMinutes ? String(step.timerMinutes) : '' };
      }));
      setActiveTab('manual');
    } else {
      // New recipe — always start with a clean form
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingRecipe, language]);

  const addIngredient = () => setIngredients([...ingredients, { quantity: '1', unit: 'g', name: '' }]);
  const removeIngredient = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index));
  const updateIngredient = (index: number, field: string, value: string) => {
    const updated = [...ingredients];
    // @ts-expect-error dynamic field update
    updated[index][field] = value;
    setIngredients(updated);
  };

  const addStep = () => setSteps([...steps, { instruction: '', timerMinutes: '' }]);
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));
  const updateStep = (index: number, field: string, value: string) => {
    const updated = [...steps];
    // @ts-expect-error dynamic field update
    updated[index][field] = value;
    setSteps(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      setImageUrl(dataUrl);
    } catch {
      // compression failed — fall back to original file
      const reader = new FileReader();
      reader.onload = (ev) => setImageUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    // Clear stale state from a previous import
    setParseResult(null);
    setParseError(null);
    setImageUrl(undefined);

    // Detect platform for a friendlier loading label
    const url = importUrl.trim();
    const platform = /youtube|youtu\.be/i.test(url) ? 'YouTube'
      : /instagram/i.test(url) ? 'Instagram'
      : /tiktok/i.test(url) ? 'TikTok'
      : /facebook/i.test(url) ? 'Facebook'
      : '';
    setLoadingPlatform(platform);

    setIsParsing(true);
    setImportingStep(1);
    const progress = window.setInterval(() => {
      setImportingStep((s) => (s < 3 ? s + 1 : s));
    }, 8000);
    try {
      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { url, lang: language },
      });
      if (error || data?.error) throw new Error(error?.message ?? data?.error);
      setImportingStep(3);

      const parsedSteps: { instruction: string; timerMinutes?: number }[] =
        (data.instructions ?? []).map((instr: string) => {
          const timer = instr.match(/(\d+)\s*(мин|min|minutes)/i);
          return { instruction: instr, timerMinutes: timer ? parseInt(timer[1]) : undefined };
        });

      const parsedIngredients = (data.ingredients ?? []).map(parseIngredientString);

      setParseResult({
        title: data.title || t('importedRecipe'),
        description: data.description,
        category: detectCategory(`${data.categoryHint ?? ''} ${data.title ?? ''}`),
        servings: data.servings,
        ingredients: parsedIngredients,
        steps: parsedSteps,
        imageUrl: data.imageUrl,
        calories: data.calories,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs,
        sourceLang: data.sourceLang,
        translated: data.translated,
        note: data.note,
      });
      setImageUrl(data.imageUrl ?? undefined);
    } catch (e: unknown) {
      setParseResult(null);
      setImageUrl(undefined);
      const msg = e instanceof Error ? e.message : String(e);
      const timedOut = /timeout|timed out|abort|504|546|failed to send|network error/i.test(msg);
      setParseError(timedOut ? t('importTimedOut') : msg);
    } finally {
      window.clearInterval(progress);
      setIsParsing(false);
      setImportingStep(0);
    }
  };

  const useParsedRecipe = () => {
    if (!parseResult) return;
    setTitle(parseResult.title);
    setDescription(parseResult.description || '');
    setCategory(parseResult.category);
    setServings(parseResult.servings || '');
    setCalories(parseResult.calories || '');
    setProtein(parseResult.protein  || '');
    setFat(parseResult.fat          || '');
    setCarbs(parseResult.carbs      || '');
    setIngredients(
      parseResult.ingredients.length
        ? parseResult.ingredients.map(i => ({ ...i, quantity: String(i.quantity) }))
        : [{ quantity: '1', unit: 'g', name: '' }],
    );
    setSteps(
      parseResult.steps.length
        ? parseResult.steps.map(s => ({ instruction: s.instruction, timerMinutes: s.timerMinutes ? String(s.timerMinutes) : '' }))
        : [{ instruction: '', timerMinutes: '' }],
    );
    if (importUrl.trim()) setSourceUrl(importUrl);
    setActiveTab('manual');
    setParseResult(null);
    setParseError(null);
    setImportUrl('');
  };

  const handleSave = () => {
    if (!title.trim() || !category) return;
    const recipeId = editingRecipe?.recipe.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const servingsNum = parseFloat(servings) || 1;

    const newRecipe: FullRecipe = {
      recipe: {
        id: recipeId,
        category,
        status: editingRecipe?.recipe.status || 'want_to_cook',
        imageUrl,
        sourceUrl: sourceUrl || undefined,
        servings: servingsNum,
        calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined,
        fat: fat ? Number(fat) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        visibleToFriends: editingRecipe?.recipe.visibleToFriends ?? false,
        userId: editingRecipe?.recipe.userId,
        createdAt: editingRecipe?.recipe.createdAt || now,
        updatedAt: now,
      },
      translations: [
        { id: `t-${Date.now()}-ru`, recipeId, language: 'ru' as const, title, description },
        { id: `t-${Date.now()}-en`, recipeId, language: 'en' as const, title, description },
        { id: `t-${Date.now()}-de`, recipeId, language: 'de' as const, title, description },
      ],
      // The form always keeps one blank ingredient row for typing into; persisting it would
      // show up as a nameless "Unknown" line in the recipe card.
      ingredients: ingredients.filter((ing) => ing.name.trim()).map((ing, idx) => ({
        id: editingRecipe?.ingredients[idx]?.id || `i-${Date.now()}-${idx}`,
        recipeId,
        quantity: parseFloat(ing.quantity) || 0,
        unit: ing.unit,
        translations: [
          { id: `it-${Date.now()}-${idx}-ru`, ingredientId: `i-${Date.now()}-${idx}`, language: 'ru' as const, name: ing.name },
          { id: `it-${Date.now()}-${idx}-en`, ingredientId: `i-${Date.now()}-${idx}`, language: 'en' as const, name: ing.name },
          { id: `it-${Date.now()}-${idx}-de`, ingredientId: `i-${Date.now()}-${idx}`, language: 'de' as const, name: ing.name },
        ],
      })),
      // The form always keeps one blank step row for typing into; persisting it would show
      // up as an empty "Step 1" in the recipe card.
      steps: steps.filter((step) => step.instruction.trim()).map((step, idx) => ({
        id: editingRecipe?.steps.find((s) => s.stepOrder === idx + 1)?.id || `s-${Date.now()}-${idx}`,
        recipeId,
        stepOrder: idx + 1,
        timerMinutes: step.timerMinutes ? parseInt(step.timerMinutes) : undefined,
        translations: [
          { id: `st-${Date.now()}-${idx}-ru`, stepId: `s-${Date.now()}-${idx}`, language: 'ru' as const, instruction: step.instruction },
          { id: `st-${Date.now()}-${idx}-en`, stepId: `s-${Date.now()}-${idx}`, language: 'en' as const, instruction: step.instruction },
          { id: `st-${Date.now()}-${idx}-de`, stepId: `s-${Date.now()}-${idx}`, language: 'de' as const, instruction: step.instruction },
        ],
      })),
    };
    onSave(newRecipe);
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const inputCls = `w-full px-3 py-2 ${theme.input}`;
  const smallInputCls = `w-full px-2 py-2 text-sm ${theme.input}`;
  const loadingSteps = [
    { label: t('loadingFetch'), icon: Link2 },
    { label: t('loadingExtract'), icon: Download },
    { label: t('loadingAi'), icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[90vh] ${theme.card} overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${theme.border} ${theme.modalHeaderBg}`}>
          <h2 className={`text-xl font-bold ${theme.textPrimary}`}>
            {isEditMode ? t('editRecipe') : t('addRecipe')}
          </h2>
          <button onClick={onClose} className={`p-2 hover:bg-gray-100 rounded-full transition-colors`}>
            <X className={`w-5 h-5 ${theme.textSecondary}`} />
          </button>
        </div>

        {/* Tabs */}
        {!isEditMode && (
          <div className={`flex gap-2 p-2 border-b ${theme.border} ${theme.modalHeaderBg}`}>
            {([
              { key: 'manual', icon: Edit3, label: t('manualInput') },
              { key: 'ai',     icon: Wand2, label: t('aiSmartPaste') },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-semibold rounded-xl transition-all ${
                  activeTab === key
                    ? theme.chipActive
                    : `${theme.textSecondary} bg-transparent`
                }`}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {(isEditMode || activeTab === 'manual') ? (
            <div className="space-y-4">
              {/* Image */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-2`}>
                  {t('dishPhoto')}
                </label>
                {imageUrl ? (
                  <div className="relative group">
                    <img src={imageUrl} alt={title || 'Recipe'} referrerPolicy="no-referrer" className="w-full h-48 object-cover rounded-xl" />
                    <button onClick={() => setImageUrl(undefined)} className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed ${theme.inputBorder} rounded-xl cursor-pointer hover:border-orange-400 transition-colors`}>
                    {isCompressing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
                        <span className={`text-sm ${theme.textSecondary}`}>{t('compressing')}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Camera className="w-10 h-10 mb-2 text-orange-400" />
                        <span className="text-sm font-medium">{t('uploadPhoto')}</span>
                        <span className={`text-xs mt-1 ${theme.textSecondary}`}>PNG, JPG — макс. 1200px, JPEG 0.8</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} className="hidden" />
                  </label>
                )}
              </div>

              {/* Title */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('title')}</label>
                <input type="text" value={title} onChange={(e) => setTitle(capitalizeFirst(e.target.value))} className={inputCls} placeholder={t('titlePlaceholder')} />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('description')}</label>
                <textarea value={description} onChange={(e) => setDescription(capitalizeFirst(e.target.value))} rows={2} className={inputCls} placeholder={t('descriptionPlaceholder')} />
              </div>

              {/* Source URL */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('source')} URL</label>
                <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputCls} placeholder="https://..." />
              </div>

              {/* Category & Servings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('category')}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    <option value="" disabled>{t('selectCategory')}</option>
                    {RECIPE_CATEGORIES.map(cat => <option key={cat} value={cat}>{tCategory(cat)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('servings')}</label>
                  <input type="text" value={servings} onChange={(e) => setServings(e.target.value)} className={inputCls} placeholder={t('servingsPlaceholder')} />
                </div>
              </div>

              {/* Nutrition (КБЖУ) */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-2`}>
                  {t('nutritionPerServing')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <input
                      type="number" min="0" value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      className={smallInputCls}
                      placeholder={t('kcal')}
                    />
                    <p className={`text-xs mt-0.5 text-center ${theme.textSecondary}`}>{t('calories')}</p>
                  </div>
                  <div>
                    <input
                      type="number" min="0" value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      className={smallInputCls}
                      placeholder={t('g')}
                    />
                    <p className={`text-xs mt-0.5 text-center ${theme.textSecondary}`}>{t('protein')}</p>
                  </div>
                  <div>
                    <input
                      type="number" min="0" value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      className={smallInputCls}
                      placeholder={t('g')}
                    />
                    <p className={`text-xs mt-0.5 text-center ${theme.textSecondary}`}>{t('fat')}</p>
                  </div>
                  <div>
                    <input
                      type="number" min="0" value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      className={smallInputCls}
                      placeholder={t('g')}
                    />
                    <p className={`text-xs mt-0.5 text-center ${theme.textSecondary}`}>{t('carbs')}</p>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-2`}>{t('ingredients')}</label>
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" value={ing.quantity} onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)} className={`w-20 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder="1" />
                      <select value={ing.unit} onChange={(e) => updateIngredient(idx, 'unit', e.target.value)} className={`w-20 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm`}>
                        <option value="g">{t('g')}</option><option value="kg">{t('kg')}</option><option value="ml">{t('ml')}</option><option value="l">{t('l')}</option><option value="pcs">{t('pcs')}</option><option value="tbsp">{t('tbsp')}</option><option value="tsp">{t('tsp')}</option><option value="cup">{t('cup')}</option>
                      </select>
                      <input type="text" value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} className={`flex-1 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder={t('ingredientPlaceholder')} />
                      {ingredients.length > 1 && (
                        <button type="button" onClick={() => removeIngredient(idx)} className="p-2 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addIngredient} className={`mt-2 ${theme.textAccent} hover:opacity-80 text-sm font-medium flex items-center gap-1`}>
                  <Plus className="w-4 h-4" />{t('addIngredient')}
                </button>
              </div>

              {/* Steps */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-2`}>{t('steps')}</label>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className={`w-6 h-6 ${theme.tabActiveBg} ${theme.textAccent} rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1`}>{idx + 1}</span>
                      <textarea value={step.instruction} onChange={(e) => updateStep(idx, 'instruction', capitalizeFirst(e.target.value))} rows={2} className={`flex-1 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder={t('stepPlaceholder')} />
                      <input type="text" value={step.timerMinutes} onChange={(e) => updateStep(idx, 'timerMinutes', e.target.value)} className={`w-16 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder={t('minutes')} title={t('stepTimer')} />
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(idx)} className="p-2 text-gray-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addStep} className={`mt-2 ${theme.textAccent} hover:opacity-80 text-sm font-medium flex items-center gap-1`}>
                  <Plus className="w-4 h-4" />{t('addStep')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Block 1: Import by URL */}
              <div className={`${theme.inputBg} p-4 rounded-xl border ${theme.inputBorder}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Film className={`w-5 h-5 ${theme.textAccent}`} />
                  <h3 className={`font-semibold ${theme.textPrimary}`}>
                    {t('importByUrl')}
                  </h3>
                </div>
                <input
                  type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} disabled={isParsing}
                  className={`w-full px-4 py-3 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl ${theme.inputPlaceholder} text-sm disabled:opacity-50`}
                  placeholder={t('importUrlPlaceholder')}
                />
                <button onClick={handleImportUrl} disabled={!importUrl.trim() || isParsing} className={`mt-3 w-full py-3 ${theme.btnPrimary} font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}>
                  <Download className="w-5 h-5" />
                  {t('importAction')}
                </button>
              </div>

              {/* Loading Animation */}
              {isParsing && (
                <div className="space-y-2">
                  {loadingPlatform && (
                    <p className={`text-sm text-center ${theme.textSecondary}`}>
                      {`${t('importingFrom')} ${loadingPlatform}…`}
                    </p>
                  )}
                  {loadingSteps.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isActive = importingStep === idx + 1;
                    const isComplete = importingStep > idx + 1;
                    return (
                      <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? `${theme.tabActiveBg} border ${theme.borderAccent}` : isComplete ? 'bg-green-50 border border-green-200' : `${theme.bgSecondary} border ${theme.inputBorder}`}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? `${theme.accentPrimary} text-white` : isComplete ? 'bg-green-500 text-white' : `${theme.inputBorder} ${theme.textSecondary}`}`}>
                          {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : isComplete ? <CheckCircle className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                        </div>
                        <span className={`text-sm font-medium ${isActive ? theme.textAccent : isComplete ? 'text-green-700' : theme.textSecondary}`}>{step.label}</span>
                      </div>
                    );
                  })}
                  <p className={`text-xs text-center ${theme.textSecondary}`}>
                    {t('importTakesTime')}
                  </p>
                </div>
              )}

              {/* Hard error card */}
              {parseError && !isParsing && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">
                      {t('importFailed')}
                    </p>
                    <p className="text-red-600 text-sm mt-1">{parseError}</p>
                    <p className="text-red-500 text-xs mt-2">
                      {t('importFailedHint')}
                    </p>
                  </div>
                </div>
              )}

              {/* Language notice — only when the recipe could not be translated */}
              {parseResult?.sourceLang && parseResult.sourceLang !== language && !parseResult.translated && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {t('foreignPageNotice')}
                </div>
              )}

              {/* Parse Result */}
              {parseResult && !isParsing && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <span className="font-bold text-lg text-green-700">
                      {t('recipeParsed')}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{t('title')}</span>
                      <p className="font-bold text-gray-800 text-lg">{parseResult.title}</p>
                    </div>
                    {parseResult.description && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">{t('description')}</span>
                        <p className="text-gray-600 text-sm line-clamp-3">{parseResult.description}</p>
                      </div>
                    )}
                    {parseResult.ingredients.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">{t('ingredients')}</span>
                        <ul className="mt-1 space-y-1">
                          {parseResult.ingredients.map((ing, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                              <span className={`font-semibold ${theme.textAccent}`}>{ing.quantity} {unitLabel(ing.unit)}</span>
                              <span>{ing.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parseResult.steps.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">{t('steps')}</span>
                        <ol className="mt-1 space-y-1">
                          {parseResult.steps.map((step, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className={`w-5 h-5 ${theme.tabActiveBg} ${theme.textAccent} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>{idx + 1}</span>
                              <span>{step.instruction}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                  {/* Import note — shown when image/title found but no recipe text */}
                  {parseResult.note && IMPORT_NOTE_KEYS[parseResult.note] && (
                    <div className="flex items-start gap-2 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{t(IMPORT_NOTE_KEYS[parseResult.note])}</span>
                    </div>
                  )}
                  <div className="mt-4">
                    <button onClick={useParsedRecipe} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {t('useResult')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${theme.border} ${theme.bgSecondary}`}>
          <div className="flex gap-3">
            <button onClick={onClose} className={`flex-1 py-2.5 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl font-medium transition-colors`}>
              {t('cancel')}
            </button>
            <button onClick={handleSave} disabled={!title.trim() || !category} className={`flex-1 py-2.5 ${theme.btnPrimary} font-medium disabled:opacity-50 disabled:cursor-not-allowed`}>
              {isEditMode ? t('save') : t('add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
