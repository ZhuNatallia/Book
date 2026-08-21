import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { ShelfPicker } from './ShelfPicker';
import { isSampleRecipeId, parseFiniteInput } from '../lib/recipeDb';
import { X, Minus, Plus, Play, Pause, RotateCcw, Clock, ShoppingBag, ExternalLink, Pencil, Trash2, ChefHat, UtensilsCrossed, Flame, CheckCircle, BookmarkPlus, Volume2 } from 'lucide-react';

// Recipes imported from a video or a social post often have no written steps. For those we
// link back to the original instead of showing an empty step list.
const VIDEO_SOURCES = [
	{ match: /youtube\.com|youtu\.be/i, labelKey: 'watchOnYoutube' },
	{ match: /instagram\.com/i,         labelKey: 'watchOnInstagram' },
	{ match: /tiktok\.com/i,            labelKey: 'watchOnTiktok' },
] as const;

const FB_VIDEO_RE = /fb\.watch|facebook\.com\/(?:watch|reel|reels|videos\/|share\/v\/)/i;

function videoSourceLabel(url?: string) {
	if (!url) return undefined;
	if (/facebook\.com|fb\.watch/i.test(url)) {
		return FB_VIDEO_RE.test(url) ? 'watchOnFacebook' : 'viewSourceOnFacebook';
	}
	return VIDEO_SOURCES.find((s) => s.match.test(url))?.labelKey;
}

// Units are stored in canonical form and rendered from the dictionary of the active language
const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'cup'];

const SPEECH_LOCALES: Record<string, string> = {
	ru: 'ru-RU',
	en: 'en-US',
	de: 'de-DE',
	uk: 'uk-UA',
	pl: 'pl-PL',
	it: 'it-IT',
	es: 'es-ES',
	fr: 'fr-FR',
	kk: 'kk-KZ',
};

interface RecipeDetailProps {
	recipe: FullRecipe;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onAddToShoppingList: (name: string, qty: number, unit: string) => void;
	onUpdate?: (recipe: FullRecipe) => void;
	readOnly?: boolean;
	onCopy?: () => boolean | void;
	extraTags?: string[];
}

export function RecipeDetail({
	recipe,
	onClose,
	onEdit,
	onDelete,
	onAddToShoppingList,
	onUpdate,
	readOnly = false,
	onCopy,
	extraTags = [],
}: RecipeDetailProps) {
	const { language, t } = useLanguage();
	const { theme } = useTheme();
	const [servings, setServings] = useState(recipe.recipe.servings || 4);
	const [scaling, setScaling] = useState(1);
	const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>(
		'ingredients',
	);
	const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
		new Set(),
	);
	const [addedToList, setAddedToList] = useState(false);
	const [copiedToBook, setCopiedToBook] = useState(false);
	const isPersonal = !readOnly && !isSampleRecipeId(recipe.recipe.id);
	const [notes, setNotes] = useState(recipe.recipe.notes || '');
	const [imgFailed, setImgFailed] = useState(false);
	const [photoOpen, setPhotoOpen] = useState(false);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [timer, setTimer] = useState<{ stepId: string; remaining: number; running: boolean } | null>(null);
	const beepCtx = useRef<AudioContext | null>(null);

	const playTimerDone = async (title: string) => {
		try {
			navigator.vibrate?.(200);
		} catch {
			/* ignore */
		}
		try {
			const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!beepCtx.current) beepCtx.current = new Ctx();
			const ctx = beepCtx.current;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.frequency.value = 880;
			gain.gain.value = 0.08;
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start();
			osc.stop(ctx.currentTime + 0.4);
		} catch {
			/* ignore */
		}
		if ('Notification' in window) {
			if (Notification.permission === 'default') {
				try {
					await Notification.requestPermission();
				} catch {
					/* ignore */
				}
			}
			if (Notification.permission === 'granted') {
				try {
					new Notification(t('timerDone'), { body: title });
				} catch {
					/* ignore */
				}
			}
		}
	};

	useEffect(() => {
		return () => {
			if ('speechSynthesis' in window) speechSynthesis.cancel();
		};
	}, []);

	useEffect(() => {
		if (!timer?.running) return;
		const id = window.setInterval(() => {
			setTimer((prev) => {
				if (!prev || !prev.running) return prev;
				if (prev.remaining <= 1) {
					window.setTimeout(() => {
						const step = recipe.steps.find((s) => s.id === prev.stepId);
						const text =
							step?.translations.find((tr) => tr.language === language)?.instruction ||
							step?.translations[0]?.instruction ||
							t('timerDone');
						void playTimerDone(text);
					}, 0);
					return { ...prev, remaining: 0, running: false };
				}
				return { ...prev, remaining: prev.remaining - 1 };
			});
		}, 1000);
		return () => window.clearInterval(id);
	}, [timer?.running, timer?.stepId, language, recipe.steps, t]);

	useEffect(() => {
		setNotes(recipe.recipe.notes || '');
		setCurrentStepIndex(0);
		setTimer(null);
		setImgFailed(false);
		setPhotoOpen(false);
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		setIsSpeaking(false);
	}, [recipe.recipe.id, recipe.recipe.notes, recipe.recipe.imageUrl]);
	const formatUnit = (unit: string) => {
		if (!unit) return '';
		const u = unit.toLowerCase().trim();
		return UNIT_KEYS.includes(u) ? t(u) : unit;
	};
	const r = recipe.recipe as any;
	const kcal = parseFiniteInput(r.caloriesPerServing ?? r.calories);
	const proteinVal = parseFiniteInput(r.protein);
	const fatVal = parseFiniteInput(r.fat);
	const carbsVal = parseFiniteInput(r.carbs);
	const factor = Number.isFinite(scaling) ? scaling : 1;

	const translation =
		recipe.translations.find((tr) => tr.language === language) ||
		recipe.translations.find((tr) => tr.language === 'ru') ||
		recipe.translations[0] || {
			id: '',
			recipeId: recipe.recipe.id,
			language,
			title: '',
			description: undefined as string | undefined,
		};

	const sortedSteps = [...recipe.steps].sort(
		(a, b) => a.stepOrder - b.stepOrder,
	);

	const handleScaling = (newServings: number) => {
		if (newServings < 1) return;
		setServings(newServings);
		const base = parseFiniteInput(recipe.recipe.servings) || 4;
		setScaling(newServings / base);
	};

	const getIngredientName = (ingredient: (typeof recipe.ingredients)[0]) => {
		const trans =
			ingredient.translations.find((t) => t.language === language) ||
			ingredient.translations.find((t) => t.language === 'ru') ||
			ingredient.translations[0];
		return trans?.name || t('title');
	};

	const getStepInstruction = (step: (typeof recipe.steps)[0]) => {
		const trans =
			step.translations.find((t) => t.language === language) ||
			step.translations.find((t) => t.language === 'ru') ||
			step.translations[0];
		return trans?.instruction || '';
	};

	// Blank steps can exist on recipes saved before empty rows were filtered out on save,
	// so filter here too rather than migrating stored data.
	const realSteps = sortedSteps.filter((step) => getStepInstruction(step).trim());
	const realIngredients = recipe.ingredients.filter((ing) =>
		ing.translations.some((t) => t.name.trim()),
	);
	const watchLabelKey = videoSourceLabel(recipe.recipe.sourceUrl);
	const showWatchInsteadOfSteps = realSteps.length === 0 && !!watchLabelKey;

	useEffect(() => {
		const cooking = activeTab === 'steps' && !showWatchInsteadOfSteps;
		const keepAwake = cooking || !!timer?.running;
		if (!cooking) {
			if ('speechSynthesis' in window) speechSynthesis.cancel();
			setIsSpeaking(false);
		}
		if (!keepAwake || !('wakeLock' in navigator)) return;

		let released = false;
		let sentinel: { release: () => Promise<void> } | null = null;

		const request = async () => {
			try {
				sentinel = await navigator.wakeLock.request('screen');
			} catch {
				sentinel = null;
			}
		};
		void request();

		const onVisibility = () => {
			if (document.visibilityState === 'visible' && !released) void request();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			released = true;
			document.removeEventListener('visibilitychange', onVisibility);
			void sentinel?.release();
		};
	}, [activeTab, showWatchInsteadOfSteps, timer?.running]);

	const stopReading = () => {
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		setIsSpeaking(false);
	};

	const readCurrentStep = () => {
		if (!('speechSynthesis' in window) || realSteps.length === 0) return;
		const idx = Math.min(currentStepIndex, realSteps.length - 1);
		const text = getStepInstruction(realSteps[idx]).trim();
		if (!text) return;
		speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = SPEECH_LOCALES[language] || 'ru-RU';
		utterance.rate = 0.9;
		const prefix = language.toLowerCase();
		const voice = speechSynthesis
			.getVoices()
			.find((v) => v.lang.toLowerCase().startsWith(prefix));
		if (voice) utterance.voice = voice;
		utterance.onend = () => setIsSpeaking(false);
		utterance.onerror = () => setIsSpeaking(false);
		setIsSpeaking(true);
		speechSynthesis.speak(utterance);
	};

	const toggleIngredientCheck = (id: string) => {
		const newSet = new Set(checkedIngredients);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		setCheckedIngredients(newSet);
	};

	const addCheckedToShoppingList = () => {
		realIngredients.forEach((ing) => {
			if (checkedIngredients.has(ing.id)) {
				const name = getIngredientName(ing);
				const scaledQty =
					(ing.quantity / (recipe.recipe.servings || 4)) * servings;
				onAddToShoppingList(name, scaledQty, ing.unit);
			}
		});
		setCheckedIngredients(new Set());
		setAddedToList(true);
		setTimeout(() => setAddedToList(false), 2500);
	};

	return (
		<div
			className={`fixed inset-0 z-[60] ${theme.bgCard} overflow-hidden flex flex-col`}
		>
			{/* Header Image */}
			<div className='relative h-64 sm:h-80 flex-shrink-0'>
				{recipe.recipe.imageUrl && !imgFailed ? (
					<button
						type="button"
						onClick={() => setPhotoOpen(true)}
						className="w-full h-full bg-black/10"
						title={translation.title}
					>
						<img
							src={recipe.recipe.imageUrl}
							alt={translation.title}
							referrerPolicy="no-referrer"
							className="w-full h-full object-contain"
							onError={() => setImgFailed(true)}
						/>
					</button>
				) : (
					<div
						className={`w-full h-full ${theme.bgPrimary} flex flex-col items-center justify-center relative`}
					>
						<div className='absolute top-8 right-8 w-20 h-20 bg-orange-200/40 rounded-full' />
						<div className='absolute bottom-12 left-12 w-16 h-16 bg-rose-200/40 rounded-full' />
						<div className='absolute top-1/4 left-1/4 w-10 h-10 bg-amber-200/30 rounded-full' />
						<div className='absolute bottom-1/3 right-1/4 w-8 h-8 bg-orange-200/30 rounded-full' />

						<div className='relative'>
							{recipe.recipe.category === 'pastry' ||
							recipe.recipe.category === 'dessert' ? (
								<div className='w-28 h-28 rounded-3xl flex items-center justify-center shadow-lg transform rotate-3 bg-gradient-to-br from-amber-200 to-orange-200'>
									<ChefHat className='w-14 h-14 text-amber-600' />
								</div>
							) : recipe.recipe.category === 'soup' ||
							  recipe.recipe.category === 'salad' ? (
								<div className='w-28 h-28 rounded-3xl flex items-center justify-center shadow-lg bg-gradient-to-br from-green-200 to-emerald-200'>
									<UtensilsCrossed className='w-14 h-14 text-green-600' />
								</div>
							) : (
								<div className='w-28 h-28 rounded-3xl flex items-center justify-center shadow-lg transform -rotate-2 bg-gradient-to-br from-orange-200 to-rose-200'>
									<ChefHat className='w-14 h-14 text-orange-600' />
								</div>
							)}
						</div>
						<p className={`mt-4 text-sm ${theme.textSecondary} font-medium`}>
							{t('noPhotoAdded')}
						</p>
					</div>
				)}
				<div className='absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/30 to-transparent' />

			<button
				onClick={onClose}
				className='z-10 absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors'
			>
					<X className='w-5 h-5 text-gray-700' />
				</button>

				{!readOnly && (
				<div className='z-10 absolute top-4 right-4 flex gap-2'>
					<button
						onClick={onEdit}
						title={t('edit')}
						className='p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors'
					>
						<Pencil className='w-5 h-5 text-gray-700' />
					</button>
					<button
						onClick={() => {
							if (window.confirm(t('deleteConfirm'))) onDelete();
						}}
						className='p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-rose-100 transition-colors'
					>
						<Trash2 className='w-5 h-5 text-rose-500' />
					</button>
				</div>
				)}

				{readOnly && onCopy && (
				<button
					onClick={() => {
						if (onCopy?.() === false) return;
						setCopiedToBook(true);
						window.setTimeout(() => setCopiedToBook(false), 2500);
					}}
					className='z-10 absolute top-4 right-4 max-w-[calc(100%-5rem)] px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors flex items-center gap-1.5'
				>
					{copiedToBook ? (
						<CheckCircle className='w-4 h-4 text-emerald-600 flex-shrink-0' />
					) : (
						<BookmarkPlus className='w-4 h-4 text-gray-700 flex-shrink-0' />
					)}
					<span className='text-xs sm:text-sm font-medium text-gray-800 truncate'>
						{copiedToBook ? t('savedToMyBook') : t('saveToMyBook')}
					</span>
				</button>
				)}

			</div>

			{/* Content */}
			<div className='flex-1 overflow-y-auto pb-4'>
				{/* Title block — in document flow, below photo */}
				<div className={`px-4 sm:px-6 pt-5 pb-4 border-b ${theme.border}`}>
					<h1 className={`text-2xl sm:text-3xl font-bold ${theme.textPrimary} line-clamp-3`}>
						{translation.title}
					</h1>
					{translation.description && (
						<p className={`${theme.textSecondary} text-base mt-2 leading-relaxed whitespace-pre-line`}>
							{translation.description}
						</p>
					)}
					{isPersonal && recipe.recipe.lastCookedAt && (
						<p className={`text-xs mt-2 ${theme.textSecondary}`}>
							{t('lastCooked')}{' '}
							{new Date(recipe.recipe.lastCookedAt).toLocaleDateString(language, {
								day: 'numeric',
								month: 'short',
							})}
						</p>
					)}
					{isPersonal && (
						<div className="mt-4 space-y-3">
							<label className={`block text-sm font-semibold ${theme.textPrimary}`}>{t('myNotes')}</label>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								onBlur={() => {
									if ((recipe.recipe.notes || '') === notes) return;
									onUpdate?.({
										...recipe,
										recipe: { ...recipe.recipe, notes, updatedAt: new Date().toISOString() },
									});
								}}
								rows={3}
								placeholder={t('notesPlaceholder')}
								className={`w-full px-3 py-2.5 text-base ${theme.input}`}
							/>
							<p className={`text-sm font-semibold ${theme.textPrimary}`}>{t('shelves')}</p>
							<ShelfPicker
								tags={recipe.recipe.tags || []}
								extraTags={extraTags}
								onChange={(tags) =>
									onUpdate?.({
										...recipe,
										recipe: { ...recipe.recipe, tags, updatedAt: new Date().toISOString() },
									})
								}
							/>
						</div>
					)}
					{recipe.recipe.sourceUrl && (
						<a
							href={recipe.recipe.sourceUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='inline-flex items-center gap-1 text-sm text-orange-500 hover:text-orange-400 mt-3'
						>
							{t('source')} <ExternalLink className='w-3.5 h-3.5' />
						</a>
					)}
				</div>

				{/* Serving Scaler & КБЖУ в один ряд */}
				<div
					className={`p-4 border-b ${theme.border} flex flex-wrap items-center justify-between gap-4 bg-black/5 dark:bg-white/5`}
				>
					<div className='flex items-center gap-3'>
						<span className={`text-base font-medium ${theme.textSecondary}`}>
							{t('servings')}
						</span>
						<div
							className={`flex items-center gap-3 rounded-full px-4 py-1.5 ${theme.tabActiveBg}`}
						>
							<button
								onClick={() => handleScaling(servings - 1)}
								disabled={servings <= 1}
								className='p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors disabled:opacity-30'
							>
								<Minus className={`w-4 h-4 ${theme.textAccent}`} />
							</button>
							<span
								className={`text-lg font-bold ${theme.textAccent} w-8 text-center`}
							>
								{servings}
							</span>
							<button
								onClick={() => handleScaling(servings + 1)}
								className='p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors'
							>
								<Plus className={`w-4 h-4 ${theme.textAccent}`} />
							</button>
						</div>
					</div>

					{/* Интегрированный блок динамического расчета КБЖУ */}
					{(kcal != null || proteinVal != null || fatVal != null || carbsVal != null) && (
						<div className='flex items-center gap-2 text-xs sm:text-sm font-medium flex-wrap'>
							{kcal != null && (
							<span className='flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 shadow-sm'>
								<Flame className='w-4 h-4 text-orange-500' />
								{Math.round(kcal * factor)}{' '}
								{t('kcal')}
							</span>
							)}
							{proteinVal != null && (
								<span className='text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20'>
									{`${t('proteinShort')}: ${Math.round(proteinVal * factor)}${t('g')}`}
								</span>
							)}
							{fatVal != null && (
								<span className='text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20'>
									{`${t('fatShort')}: ${Math.round(fatVal * factor)}${t('g')}`}
								</span>
							)}
							{carbsVal != null && (
								<span className='text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20'>
									{`${t('carbsShort')}: ${Math.round(carbsVal * factor)}${t('g')}`}
								</span>
							)}
						</div>
					)}
				</div>

				{scaling !== 1 && (
					<div className='px-4 pt-2'>
						<p className={`text-xs ${theme.textAccent}`}>
							{'x' + scaling.toFixed(2)}{' '}
							{t('fromBase')}
						</p>
					</div>
				)}

				{/* Tabs */}
				<div className={`flex items-stretch border-b ${theme.border} mt-2`}>
					<button
						onClick={() => setActiveTab('ingredients')}
						className={`flex-1 py-3 font-medium text-base transition-colors ${
							activeTab === 'ingredients' || showWatchInsteadOfSteps
								? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}`
								: `${theme.textSecondary} hover:text-gray-400 dark:hover:text-gray-200`
						}`}
					>
						{t('ingredients')} ({realIngredients.length})
					</button>
					{showWatchInsteadOfSteps ? (
						<a
							href={recipe.recipe.sourceUrl}
							target='_blank'
							rel='noopener noreferrer'
							className={`flex-1 m-1.5 py-2 px-2 ${theme.btnPrimary} font-medium flex items-center justify-center gap-1.5 text-center text-sm sm:text-base leading-tight`}
						>
							{watchLabelKey === 'viewSourceOnFacebook'
								? <ExternalLink className='w-4 h-4 flex-shrink-0' />
								: <Play className='w-4 h-4 flex-shrink-0' />}
							{t(watchLabelKey)}
						</a>
					) : (
						<button
							onClick={() => setActiveTab('steps')}
							className={`flex-1 py-3 font-medium text-base transition-colors ${
								activeTab === 'steps'
									? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}`
									: `${theme.textSecondary} hover:text-gray-400 dark:hover:text-gray-200`
							}`}
						>
							{t('steps')} ({realSteps.length})
						</button>
					)}
				</div>

				{/* Tab Content */}
				<div className='p-4'>
					{(activeTab === 'ingredients' || showWatchInsteadOfSteps) && (
						<div className='space-y-3'>
							{realIngredients.map((ing) => {
								const name = getIngredientName(ing);
								const scaledQty =
									(ing.quantity / (recipe.recipe.servings || 4)) * servings;
								const isChecked = checkedIngredients.has(ing.id);

								return (
									<label
										key={ing.id}
										className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer border ${
											isChecked
												? `${theme.tabActiveBg} border-${theme.borderAccent || 'orange-500'}`
												: `${theme.bgSecondary} border-transparent hover:bg-black/5 dark:hover:bg-white/5`
										}`}
									>
										<input
											type='checkbox'
											checked={isChecked}
											onChange={() => toggleIngredientCheck(ing.id)}
											className='w-5 h-5 rounded border-gray-400 dark:border-gray-500 text-orange-500 focus:ring-orange-500 bg-transparent'
										/>
										<span className='flex-1 flex items-baseline'>
											<span
												className={`font-bold ${theme.textAccent} min-w-[70px] inline-block`}
											>
												{scaledQty % 1 === 0 ? scaledQty : scaledQty.toFixed(1)}{' '}
												{formatUnit(ing.unit)}
											</span>
											<span className={`${theme.textPrimary} ml-2 font-medium text-base`}>
												{name}
											</span>
										</span>
									</label>
								);
							})}

							{checkedIngredients.size > 0 && (
								<button
									onClick={addCheckedToShoppingList}
									className={`w-full py-3 ${theme.btnPrimary} font-medium flex items-center justify-center gap-2 mt-4`}
								>
									<ShoppingBag className='w-5 h-5' />
									{t('addToShoppingList')} ({checkedIngredients.size})
								</button>
							)}
							{addedToList && (
								<div className='mt-2 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium'>
									<CheckCircle className='w-4 h-4' />
									{t('addedToShoppingList')}
								</div>
							)}
						</div>
					)}

					{activeTab === 'steps' && !showWatchInsteadOfSteps && (
						<div className='space-y-4'>
							{realSteps.length > 0 && (
								<button
									type='button'
									onClick={isSpeaking ? stopReading : readCurrentStep}
									className={`w-full py-3 rounded-2xl ${theme.accentGradient} text-white font-medium flex items-center justify-center gap-2`}
								>
									<Volume2 className='w-5 h-5' />
									{isSpeaking
										? t('stopReading')
										: `${t('readStep')} ${Math.min(currentStepIndex, realSteps.length - 1) + 1}`}
								</button>
							)}
							{realSteps.map((step, idx) => (
								<button
									type='button'
									key={step.id}
									onClick={() => setCurrentStepIndex(idx)}
									className={`w-full text-left flex gap-4 items-start p-4 rounded-2xl ${
										idx === currentStepIndex
											? `${theme.tabActiveBg} border ${theme.borderAccent}`
											: theme.bgSecondary
									}`}
								>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${theme.btnPrimary}`}
									>
										{idx + 1}
									</div>
									<div className='flex-1'>
										<p className={`${theme.textPrimary} font-medium text-base`}>
											{getStepInstruction(step)}
										</p>
										{step.timerMinutes && (
											<div
												className={`flex items-center gap-2 mt-2 ${theme.textAccent} text-sm`}
												onClick={(e) => e.stopPropagation()}
											>
												<Clock className='w-4 h-4' />
												{timer?.stepId === step.id
													? `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, '0')}`
													: `${step.timerMinutes} ${t('minutes')}`}
												<button
													type="button"
													className="p-1 rounded-lg hover:bg-white/50"
													onClick={() => {
														if (timer?.stepId === step.id && timer.running) {
															setTimer({ ...timer, running: false });
															return;
														}
														if (timer?.stepId === step.id && !timer.running && timer.remaining > 0) {
															setTimer({ ...timer, running: true });
															return;
														}
														setTimer({
															stepId: step.id,
															remaining: (step.timerMinutes || 0) * 60,
															running: true,
														});
													}}
													title={timer?.stepId === step.id && timer.running ? t('timerPause') : t('timerResume')}
												>
													{timer?.stepId === step.id && timer.running ? (
														<Pause className="w-4 h-4" />
													) : (
														<Play className="w-4 h-4" />
													)}
												</button>
												{timer?.stepId === step.id && (
													<button
														type="button"
														className="p-1 rounded-lg hover:bg-white/50"
														onClick={() =>
															setTimer({
																stepId: step.id,
																remaining: (step.timerMinutes || 0) * 60,
																running: false,
															})
														}
														title={t('timerReset')}
													>
														<RotateCcw className="w-4 h-4" />
													</button>
												)}
											</div>
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
			{photoOpen && recipe.recipe.imageUrl && (
				<button
					type="button"
					className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-3"
					onClick={() => setPhotoOpen(false)}
				>
					<img
						src={recipe.recipe.imageUrl}
						alt={translation.title}
						referrerPolicy="no-referrer"
						className="max-w-full max-h-full object-contain"
					/>
				</button>
			)}
		</div>
	);
}
