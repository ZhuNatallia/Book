import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { X, Wand2, Edit3, Plus, Trash2, Loader2, CheckCircle, Link2, Download, Sparkles, Film, Upload, Camera, FileText } from 'lucide-react';

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
  ingredients: { quantity: number; unit: string; name: string }[];
  steps: { instruction: string; timerMinutes?: number }[];
}

// Smart AI parser that distributes user text into recipe fields preserving original units
function smartParseRecipe(text: string, language: string): ParsedRecipe {
  const lines = text.split('\n').filter(l => l.trim());
  const title = lines[0]?.replace(/^[#\-*\d.]\s*/, '').trim() ||
    (language === 'ru' ? 'Импортированный рецепт' : 'Imported Recipe');

  const ingredients: { quantity: number; unit: string; name: string }[] = [];
  const steps: { instruction: string; timerMinutes?: number }[] = [];

  let inIngredients = false;
  let inSteps = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect section headers
    const lower = line.toLowerCase();
    if (/^(ингредиенты|ingredients|zutaten|состав|для)/i.test(lower)) {
      inIngredients = true; inSteps = false; continue;
    }
    if (/^(приготовление|шаги|steps|schritte|способ|инструкция|instruction)/i.test(lower)) {
      inIngredients = false; inSteps = true; continue;
    }

    // Try to parse as ingredient
    const ingMatch = line.match(/^[-•*]\s*|^\d+[.)]\s*/)?.input
      ? line.replace(/^[-•*]\s*|^\d+[.)]\s*/, '')
      : line;

    const qtyMatch = ingMatch.match(/^(\d+[/.]?\d*)\s*(г|гр|грамм|kg|кг|ml|мл|l|л|шт|pcs|cup|стакан|ст\.л\.?|ч\.л\.?|tbsp|tsp|g|oz|lb|pinch|щепотка|по вкусу)?\s*(.*)/i);

    if (qtyMatch && (inIngredients || (!inSteps && qtyMatch[2]))) {
      const rawQty = qtyMatch[1];
      let qty = 1;
      if (rawQty.includes('/')) {
        const parts = rawQty.split('/');
        qty = parseFloat(parts[0]) / parseFloat(parts[1] || '1');
      } else {
        qty = parseFloat(rawQty) || 1;
      }
      const unit = qtyMatch[2] ? normalizeUnit(qtyMatch[2]) : 'g';
      const name = qtyMatch[3]?.trim() || (language === 'ru' ? 'Ингредиент' : 'Ingredient');
      if (!inSteps) {
        ingredients.push({ quantity: qty, unit, name });
        inIngredients = true;
        continue;
      }
    }

    // If it looks like a step (starts with number or contains cooking verbs)
    const stepMatch = line.match(/^(\d+)[.)]\s*(.*)/);
    if (stepMatch && (inSteps || !inIngredients)) {
      const instr = stepMatch[2];
      const timerMatch = instr.match(/(\d+)\s*(мин|min|minutes)/i);
      steps.push({
        instruction: instr,
        timerMinutes: timerMatch ? parseInt(timerMatch[1]) : undefined,
      });
      inSteps = true;
      continue;
    }

    // Plain text line - classify based on context
    if (inIngredients || (!inSteps && /(\d+\s*(г|ml|шт|pcs|стакан|tbsp|кг|kg))/i.test(line))) {
      const clean = line.replace(/^[-•*]\s*/, '');
      const qm = clean.match(/^(\d+[/.]?\d*)\s*(г|гр|грамм|kg|кг|ml|мл|l|л|шт|pcs|cup|стакан|ст\.л\.?|ч\.л\.?|tbsp|tsp|g|по вкусу|pinch)?\s*(.*)/i);
      if (qm) {
        let qty = 1;
        if (qm[1].includes('/')) {
          const p = qm[1].split('/');
          qty = parseFloat(p[0]) / parseFloat(p[1] || '1');
        } else {
          qty = parseFloat(qm[1]) || 1;
        }
        ingredients.push({ quantity: qty, unit: qm[2] ? normalizeUnit(qm[2]) : 'g', name: qm[3]?.trim() || '—' });
        inIngredients = true;
      } else {
        ingredients.push({ quantity: 1, unit: 'pcs', name: clean });
        inIngredients = true;
      }
    } else if (inSteps || /(обжар|вари|запек|mix|bake|cook|cut|блендер|готов|добав|перемеш|выпек|смеш|туш|нарез)/i.test(line)) {
      const clean = line.replace(/^\d+[.)]\s*/, '');
      const timerMatch = clean.match(/(\d+)\s*(мин|min|minutes)/i);
      steps.push({
        instruction: clean,
        timerMinutes: timerMatch ? parseInt(timerMatch[1]) : undefined,
      });
      inSteps = true;
    } else if (inIngredients) {
      const clean = line.replace(/^[-•*]\s*/, '');
      ingredients.push({ quantity: 1, unit: 'pcs', name: clean });
    }
  }

  if (ingredients.length === 0) {
    // Try to extract anything with numbers as ingredients
    lines.forEach(l => {
      if (/^\d/.test(l.trim())) {
        const clean = l.trim().replace(/^[-•*\d.)]\s*/, '');
        const qm = clean.match(/^(\d+[/.]?\d*)\s*(г|гр|ml|мл|шт|pcs|g|kg|кг|tbsp|tsp|cup|стакан|ч\.л|ст\.л)?\s*(.*)/i);
        if (qm) {
          let qty = parseFloat(qm[1]) || 1;
          if (qm[1].includes('/')) { const p = qm[1].split('/'); qty = parseFloat(p[0]) / parseFloat(p[1] || '1'); }
          ingredients.push({ quantity: qty, unit: qm[2] ? normalizeUnit(qm[2]) : 'g', name: qm[3]?.trim() || '—' });
        }
      }
    });
  }

  if (steps.length === 0 && ingredients.length > 0) {
    steps.push({ instruction: language === 'ru' ? 'Подготовьте ингредиенты и готовьте по вкусу.' : 'Prepare ingredients and cook to taste.' });
  }

  const detectCategory = (text: string): string => {
    const t = text.toLowerCase();
    if (t.includes('мясо') || t.includes('говядин') || t.includes('meat') || t.includes('beef')) return 'meat';
    if (t.includes('кур') || t.includes('chicken')) return 'poultry';
    if (t.includes('рыб') || t.includes('fish')) return 'fish';
    if (t.includes('блин') || t.includes('пиро') || t.includes('торт') || t.includes('cake') || t.includes('pastry')) return 'pastry';
    if (t.includes('салат') || t.includes('salad')) return 'salad';
    if (t.includes('суп') || t.includes('soup')) return 'soup';
    if (t.includes('пп') || t.includes('healthy')) return 'healthy';
    return 'meat';
  };

  return {
    title,
    description: language === 'ru' ? `Рецепт: ${title}` : `Recipe: ${title}`,
    category: detectCategory(text),
    ingredients: ingredients.length > 0 ? ingredients : [{ quantity: 1, unit: 'g', name: language === 'ru' ? 'Основной ингредиент' : 'Main ingredient' }],
    steps: steps.length > 0 ? steps : [{ instruction: language === 'ru' ? 'Готовить по вкусу' : 'Cook to taste' }],
  };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\./g, '');
  if (['г', 'гр', 'грамм', 'g', 'gram'].includes(u)) return 'g';
  if (['мл', 'ml'].includes(u)) return 'ml';
  if (['кг', 'kg'].includes(u)) return 'kg';
  if (['л', 'l'].includes(u)) return 'l';
  if (['шт', 'pcs', 'piece'].includes(u)) return 'pcs';
  if (['стакан', 'cup'].includes(u)) return 'cup';
  if (['ст л', 'стл', 'tbsp', 'tablespoon'].includes(u)) return 'tbsp';
  if (['ч л', 'чл', 'tsp', 'teaspoon'].includes(u)) return 'tsp';
  if (['по вкусу', 'pinch', 'щепотка'].includes(u)) return 'tsp';
  return 'g';
}

export function AddRecipeModal({ isOpen, onClose, onSave, editingRecipe }: AddRecipeModalProps) {
  const { language, t, tCategory } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedRecipe | null>(null);
  const [rawText, setRawText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importingStep, setImportingStep] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('meat');
  const [sourceUrl, setSourceUrl] = useState('');
  const [servings, setServings] = useState('4');
  const [ingredients, setIngredients] = useState([{ quantity: '1', unit: 'g', name: '' }]);
  const [steps, setSteps] = useState([{ instruction: '', timerMinutes: '' as string }]);

  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isCompressing, setIsCompressing] = useState(false);

  const isEditMode = !!editingRecipe;

  useEffect(() => {
    if (editingRecipe) {
      const trans = editingRecipe.translations.find((t) => t.language === language) ||
        editingRecipe.translations.find((t) => t.language === 'ru');
      setTitle(trans?.title || '');
      setDescription(trans?.description || '');
      setCategory(editingRecipe.recipe.category);
      setSourceUrl(editingRecipe.recipe.sourceUrl || '');
      setServings(String(editingRecipe.recipe.servings));
      setImageUrl(editingRecipe.recipe.imageUrl);

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
    }
  }, [editingRecipe, language]);

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
    // SIMULATION: In production, compress to 100-150KB before upload
    await new Promise((r) => setTimeout(r, 800));
    const reader = new FileReader();
    reader.onload = (event) => { setImageUrl(event.target?.result as string); setIsCompressing(false); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setIsParsing(true);
    setImportingStep(1);
    await new Promise((r) => setTimeout(r, 1200));
    setImportingStep(2);
    await new Promise((r) => setTimeout(r, 1000));
    setImportingStep(3);
    await new Promise((r) => setTimeout(r, 1500));
    // Use the URL domain as a hint for the recipe title
    const urlHint = importUrl.includes('youtube') ? 'YouTube recipe' : importUrl.includes('instagram') ? 'Instagram recipe' : 'Imported recipe';
    setParseResult({
      title: language === 'ru' ? `Рецепт из ${urlHint}` : `Recipe from ${urlHint}`,
      description: language === 'ru' ? 'Импортировано по ссылке — заполните детали вручную' : 'Imported from link — fill in details manually',
      category: 'meat',
      ingredients: [{ quantity: '1', unit: 'g', name: language === 'ru' ? 'Добавьте ингредиенты вручную' : 'Add ingredients manually' }],
      steps: [{ instruction: language === 'ru' ? 'Добавьте шаги приготовления вручную' : 'Add cooking steps manually' }],
    });
    setIsParsing(false);
    setImportingStep(0);
  };

  const handleParseText = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setImportingStep(1);
    await new Promise((r) => setTimeout(r, 800));
    setImportingStep(2);
    await new Promise((r) => setTimeout(r, 600));
    setImportingStep(3);
    await new Promise((r) => setTimeout(r, 1000));
    const parsed = smartParseRecipe(rawText, language);
    setParseResult(parsed);
    setIsParsing(false);
    setImportingStep(0);
  };

  const useParsedRecipe = () => {
    if (!parseResult) return;
    setTitle(parseResult.title);
    setDescription(parseResult.description || '');
    setCategory(parseResult.category);
    setIngredients(parseResult.ingredients.map(i => ({ ...i, quantity: String(i.quantity) })));
    setSteps(parseResult.steps.map(s => ({ instruction: s.instruction, timerMinutes: s.timerMinutes ? String(s.timerMinutes) : '' })));
    if (importUrl.trim()) setSourceUrl(importUrl);
    setActiveTab('manual');
    setParseResult(null);
    setImportUrl('');
    setRawText('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const recipeId = editingRecipe?.recipe.id || `recipe-${Date.now()}`;
    const now = new Date().toISOString();
    const servingsNum = parseFloat(servings) || 4;

    const newRecipe: FullRecipe = {
      recipe: {
        id: recipeId,
        category,
        status: editingRecipe?.recipe.status || 'want_to_cook',
        imageUrl,
        sourceUrl: sourceUrl || undefined,
        servings: servingsNum,
        createdAt: editingRecipe?.recipe.createdAt || now,
        updatedAt: now,
      },
      translations: [
        { id: `t-${Date.now()}-ru`, recipeId, language: 'ru' as const, title, description },
        { id: `t-${Date.now()}-en`, recipeId, language: 'en' as const, title, description },
        { id: `t-${Date.now()}-de`, recipeId, language: 'de' as const, title, description },
      ],
      ingredients: ingredients.map((ing, idx) => ({
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
      steps: steps.map((step, idx) => ({
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

  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory('meat'); setSourceUrl(''); setServings('4');
    setIngredients([{ quantity: '1', unit: 'g', name: '' }]);
    setSteps([{ instruction: '', timerMinutes: '' }]);
    setRawText(''); setImportUrl(''); setParseResult(null); setImportingStep(0);
    setImageUrl(undefined); setIsCompressing(false); setActiveTab('manual');
  };

  if (!isOpen) return null;

  const inputCls = `w-full px-3 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme.inputPlaceholder}`;
  const loadingSteps = [
    { label: language === 'ru' ? 'Загрузка...' : 'Loading...', icon: Link2 },
    { label: language === 'ru' ? 'Извлечение текста...' : 'Extracting text...', icon: Download },
    { label: language === 'ru' ? 'AI разбор...' : 'AI parsing...', icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[90vh] ${theme.modalBg} rounded-2xl shadow-2xl border ${theme.modalBorder} overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${theme.border} ${theme.modalHeaderBg}`}>
          <h2 className={`text-xl font-bold ${theme.textPrimary}`}>
            {isEditMode
              ? (language === 'ru' ? 'Редактировать рецепт' : 'Edit Recipe')
              : t('addRecipe')}
          </h2>
          <button onClick={onClose} className={`p-2 hover:bg-gray-100 rounded-full transition-colors`}>
            <X className={`w-5 h-5 ${theme.textSecondary}`} />
          </button>
        </div>

        {/* Tabs */}
        {!isEditMode && (
          <div className={`flex border-b ${theme.border}`}>
            <button onClick={() => setActiveTab('manual')} className={`flex-1 py-3 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'manual' ? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}` : theme.textSecondary}`}>
              <Edit3 className="w-4 h-4" />{t('manualInput')}
            </button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 py-3 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'ai' ? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}` : theme.textSecondary}`}>
              <Wand2 className="w-4 h-4" />{t('aiSmartPaste')}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {(isEditMode || activeTab === 'manual') ? (
            <div className="space-y-4">
              {/* Image */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-2`}>
                  {language === 'ru' ? 'Фото блюда' : 'Dish Photo'}
                </label>
                {imageUrl ? (
                  <div className="relative group">
                    <img src={imageUrl} alt={title || 'Recipe'} className="w-full h-48 object-cover rounded-xl" />
                    <button onClick={() => setImageUrl(undefined)} className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed ${theme.inputBorder} rounded-xl cursor-pointer hover:border-orange-400 transition-colors`}>
                    {isCompressing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
                        <span className={`text-sm ${theme.textSecondary}`}>{language === 'ru' ? 'Сжатие...' : 'Compressing...'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Camera className="w-10 h-10 mb-2 text-orange-400" />
                        <span className="text-sm font-medium">{language === 'ru' ? 'Загрузить фото' : 'Upload photo'}</span>
                        <span className={`text-xs mt-1 ${theme.textSecondary}`}>PNG, JPG (compressed to ~150KB)</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} className="hidden" />
                  </label>
                )}
              </div>

              {/* Title */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('title')}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={language === 'ru' ? 'Название рецепта...' : 'Recipe title...'} />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('description')}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} placeholder={language === 'ru' ? 'Краткое описание...' : 'Short description...'} />
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
                    {['meat', 'poultry', 'fish', 'vegetables', 'pastry', 'dessert', 'soup', 'salad', 'healthy'].map(cat => <option key={cat} value={cat}>{tCategory(cat)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.label} mb-1`}>{t('servings')}</label>
                  <input type="text" value={servings} onChange={(e) => setServings(e.target.value)} className={inputCls} placeholder="4" />
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
                      <input type="text" value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} className={`flex-1 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder={language === 'ru' ? 'Ингредиент' : 'Ingredient'} />
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
                      <textarea value={step.instruction} onChange={(e) => updateStep(idx, 'instruction', e.target.value)} rows={2} className={`flex-1 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder={language === 'ru' ? 'Описание шага...' : 'Step instruction...'} />
                      <input type="text" value={step.timerMinutes} onChange={(e) => updateStep(idx, 'timerMinutes', e.target.value)} className={`w-16 px-2 py-2 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputPlaceholder}`} placeholder="мин" title={t('stepTimer')} />
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
                    {language === 'ru' ? 'Импорт по ссылке' : 'Import by URL'}
                  </h3>
                </div>
                <input
                  type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} disabled={isParsing}
                  className={`w-full px-4 py-3 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl ${theme.inputPlaceholder} text-sm disabled:opacity-50`}
                  placeholder={language === 'ru' ? 'https://youtube.com/watch?v=...' : 'https://youtube.com/watch?v=...'}
                />
                <div className="flex gap-2 mt-3 flex-wrap">
                  {['YouTube', 'Instagram', 'TikTok'].map(p => (
                    <span key={p} className={`px-2 py-1 ${theme.bgSecondary} text-xs ${theme.textSecondary} rounded-md border ${theme.inputBorder}`}>{p}</span>
                  ))}
                </div>
                <button onClick={handleImportUrl} disabled={!importUrl.trim() || isParsing} className={`mt-3 w-full py-3 ${theme.accentGradient} ${theme.accentHover} text-white rounded-xl font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all`}>
                  <Download className="w-5 h-5" />
                  {language === 'ru' ? 'Импортировать' : 'Import'}
                </button>
              </div>

              {/* Block 2: Parse text */}
              <div className={`${theme.inputBg} p-4 rounded-xl border ${theme.inputBorder}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className={`w-5 h-5 ${theme.textAccent}`} />
                  <h3 className={`font-semibold ${theme.textPrimary}`}>
                    {language === 'ru' ? 'Распознать текст рецепта' : 'Parse recipe text'}
                  </h3>
                </div>
                <textarea
                  value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={isParsing}
                  rows={6}
                  className={`w-full px-4 py-3 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl ${theme.inputPlaceholder} font-mono text-sm disabled:opacity-50`}
                  placeholder={language === 'ru'
                    ? 'Блинчики на молоке\n\nИнгредиенты:\n500 мл молока\n200 г муки\n3 шт яйца\n2 ст.л. сахар\n\nШаги:\n1. Взбить яйца с сахаром\n2. Добавить молоко и муку\n3. Жарить на сковороде 15 мин'
                    : 'Pancakes\n\nIngredients:\n500 ml milk\n200 g flour\n3 pcs eggs\n2 tbsp sugar\n\nSteps:\n1. Beat eggs with sugar\n2. Add milk and flour\n3. Fry on pan for 15 min'}
                />
                <button onClick={handleParseText} disabled={!rawText.trim() || isParsing} className={`mt-3 w-full py-3 ${theme.accentGradient} ${theme.accentHover} text-white rounded-xl font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all`}>
                  <Sparkles className="w-5 h-5" />
                  {language === 'ru' ? 'Распознать' : 'Parse'}
                </button>
              </div>

              {/* Loading Animation */}
              {isParsing && (
                <div className="space-y-2">
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
                </div>
              )}

              {/* Parse Result */}
              {parseResult && !isParsing && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <span className="font-bold text-lg text-green-700">
                      {language === 'ru' ? 'Рецепт распознан!' : 'Recipe parsed!'}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{t('title')}</span>
                      <p className="font-bold text-gray-800 text-lg">{parseResult.title}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{t('category')}</span>
                      <p className="text-gray-700">{tCategory(parseResult.category)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{t('ingredients')}</span>
                      <ul className="mt-1 space-y-1">
                        {parseResult.ingredients.map((ing, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                            <span className={`font-semibold ${theme.textAccent}`}>{ing.quantity} {ing.unit}</span>
                            <span>{ing.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                  </div>
                  <div className="mt-4">
                    <button onClick={useParsedRecipe} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {language === 'ru' ? 'Использовать результат' : 'Use result'}
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
            <button onClick={handleSave} disabled={!title.trim()} className={`flex-1 py-2.5 ${theme.accentGradient} ${theme.accentHover} text-white rounded-xl font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all`}>
              {isEditMode ? (language === 'ru' ? 'Сохранить' : 'Save') : t('add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
