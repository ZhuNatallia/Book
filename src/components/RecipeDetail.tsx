import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { X, Minus, Plus, Play, Clock, ShoppingBag, ExternalLink, Pencil, Trash2, ChefHat, UtensilsCrossed, Flame, CheckCircle } from 'lucide-react';

// Recipes imported from a video or a social post often have no written steps. For those we
// link back to the original instead of showing an empty step list.
const VIDEO_SOURCES = [
	{ match: /youtube\.com|youtu\.be/i, labelKey: 'watchOnYoutube' },
	{ match: /instagram\.com/i,         labelKey: 'watchOnInstagram' },
	{ match: /tiktok\.com/i,            labelKey: 'watchOnTiktok' },
	{ match: /facebook\.com|fb\.watch/i, labelKey: 'watchOnFacebook' },
] as const;

// Units are stored in canonical form and rendered from the dictionary of the active language
const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'cup'];

function videoSourceLabel(url?: string) {
	if (!url) return undefined;
	return VIDEO_SOURCES.find((s) => s.match.test(url))?.labelKey;
}

interface RecipeDetailProps {
	recipe: FullRecipe;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onAddToShoppingList: (name: string, qty: number, unit: string) => void;
	readOnly?: boolean;
}

export function RecipeDetail({
	recipe,
	onClose,
	onEdit,
	onDelete,
	onAddToShoppingList,
	readOnly = false,
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
	const formatUnit = (unit: string) => {
		if (!unit) return '';
		const u = unit.toLowerCase().trim();
		return UNIT_KEYS.includes(u) ? t(u) : unit;
	};
	const r = recipe.recipe as any;

	const translation =
		recipe.translations.find((tr) => tr.language === language) ||
		recipe.translations.find((tr) => tr.language === 'ru')!;

	const sortedSteps = [...recipe.steps].sort(
		(a, b) => a.stepOrder - b.stepOrder,
	);

	const handleScaling = (newServings: number) => {
		if (newServings < 1) return;
		setServings(newServings);
		setScaling(newServings / (recipe.recipe.servings || 4));
	};

	const getIngredientName = (ingredient: (typeof recipe.ingredients)[0]) => {
		const trans = ingredient.translations.find((t) => t.language === language);
		return trans?.name || ingredient.translations[0]?.name || 'Unknown';
	};

	const getStepInstruction = (step: (typeof recipe.steps)[0]) => {
		const trans = step.translations.find((t) => t.language === language);
		return trans?.instruction || step.translations[0]?.instruction || '';
	};

	// Blank steps can exist on recipes saved before empty rows were filtered out on save,
	// so filter here too rather than migrating stored data.
	const realSteps = sortedSteps.filter((step) => getStepInstruction(step).trim());
	const realIngredients = recipe.ingredients.filter((ing) =>
		ing.translations.some((t) => t.name.trim()),
	);
	const watchLabelKey = videoSourceLabel(recipe.recipe.sourceUrl);
	const showWatchInsteadOfSteps = realSteps.length === 0 && !!watchLabelKey;

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
				{recipe.recipe.imageUrl ? (
					<img
						src={recipe.recipe.imageUrl}
						alt={translation.title}
						// Imported photos are hotlinked, and many recipe sites answer 403 to a
						// request that carries our Referer
						referrerPolicy='no-referrer'
						className='w-full h-full object-cover'
					/>
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

			</div>

			{/* Content */}
			<div className='flex-1 overflow-y-auto pb-4'>
				{/* Title block — in document flow, below photo */}
				<div className={`px-4 sm:px-6 pt-5 pb-4 border-b ${theme.border}`}>
					<h1 className={`text-2xl sm:text-3xl font-bold ${theme.textPrimary} line-clamp-3`}>
						{translation.title}
					</h1>
					{translation.description && (
						<p className={`${theme.textSecondary} text-sm sm:text-base mt-2 leading-relaxed whitespace-pre-line`}>
							{translation.description}
						</p>
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
						<span className={`text-sm font-medium ${theme.textSecondary}`}>
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
					{(r.caloriesPerServing || r.calories) && (
						<div className='flex items-center gap-2 text-xs sm:text-sm font-medium flex-wrap'>
							<span className='flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 shadow-sm'>
								<Flame className='w-4 h-4 text-orange-500' />
								{Math.round(
									(r.caloriesPerServing || r.calories) * scaling,
								)}{' '}
								{t('kcal')}
							</span>
							{r.protein && (
								<span className='text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20'>
									{`${t('proteinShort')}: ${Math.round(r.protein * scaling)}${t('g')}`}
								</span>
							)}
							{r.fat && (
								<span className='text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20'>
									{`${t('fatShort')}: ${Math.round(r.fat * scaling)}${t('g')}`}
								</span>
							)}
							{r.carbs && (
								<span className='text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20'>
									{`${t('carbsShort')}: ${Math.round(r.carbs * scaling)}${t('g')}`}
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
						className={`flex-1 py-3 font-medium text-sm transition-colors ${
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
							className={`flex-1 m-1.5 py-2 px-2 ${theme.btnPrimary} font-medium flex items-center justify-center gap-1.5 text-center text-xs sm:text-sm leading-tight`}
						>
							<Play className='w-4 h-4 flex-shrink-0' />
							{t(watchLabelKey)}
						</a>
					) : (
						<button
							onClick={() => setActiveTab('steps')}
							className={`flex-1 py-3 font-medium text-sm transition-colors ${
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
											<span className={`${theme.textPrimary} ml-2 font-medium`}>
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
							{realSteps.map((step, idx) => (
								<div
									key={step.id}
									className={`flex gap-4 items-start p-4 ${theme.bgSecondary} rounded-xl`}
								>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${theme.btnPrimary}`}
									>
										{idx + 1}
									</div>
									<div className='flex-1'>
										<p className={`${theme.textPrimary} font-medium`}>
											{getStepInstruction(step)}
										</p>
										{step.timerMinutes && (
											<div
												className={`flex items-center gap-1 mt-2 ${theme.textAccent} text-sm`}
											>
												<Clock className='w-4 h-4' />
												{step.timerMinutes} {t('minutes')}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
