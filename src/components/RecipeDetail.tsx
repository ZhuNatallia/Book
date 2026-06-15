import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe, SpeechRecognition } from '../types';
import {
	X,
	Minus,
	Plus,
	Mic,
	Play,
	Pause,
	SkipForward,
	SkipBack,
	Clock,
	ShoppingBag,
	ExternalLink,
	Edit2,
	Trash2,
	Volume2,
	ChefHat,
	UtensilsCrossed,
	Flame,
} from 'lucide-react';

interface RecipeDetailProps {
	recipe: FullRecipe;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onAddToShoppingList: (name: string, qty: number, unit: string) => void;
}

export function RecipeDetail({
	recipe,
	onClose,
	onEdit,
	onDelete,
	onAddToShoppingList,
}: RecipeDetailProps) {
	const { language, t } = useLanguage();
	const { theme } = useTheme();
	const [servings, setServings] = useState(recipe.recipe.servings || 4);
	const [scaling, setScaling] = useState(1);
	const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>(
		'ingredients',
	);
	const [showHandsFree, setShowHandsFree] = useState(false);
	const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
		new Set(),
	);
	const formatUnit = (unit: string) => {
		if (!unit) return '';
		const u = unit.toLowerCase().trim();
		if (language === 'ru') {
			if (u === 'g') return 'г';
			if (u === 'kg') return 'кг';
			if (u === 'ml') return 'мл';
			if (u === 'l') return 'л';
			if (u === 'pcs') return 'шт';
			if (u === 'tsp') return 'ч.л.';
			if (u === 'tbsp') return 'ст.л.';
			if (u === 'cup') return 'ст.';
		}
		if (language === 'de') {
			if (u === 'pcs') return 'Stk.';
			if (u === 'tsp') return 'TL';
			if (u === 'tbsp') return 'EL';
			if (u === 'cup') return 'Becher';
		}
		return unit;
	};
	const r = recipe.recipe as any;

	if (r && !r.caloriesPerServing && !r.calories) {
		r.calories = 420;
		r.protein = 25;
		r.fat = 12;
		r.carbs = 45;
	}

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
		recipe.ingredients.forEach((ing) => {
			if (checkedIngredients.has(ing.id)) {
				const name = getIngredientName(ing);
				const scaledQty =
					(ing.quantity / (recipe.recipe.servings || 4)) * servings;
				onAddToShoppingList(name, scaledQty, ing.unit);
			}
		});
		setCheckedIngredients(new Set());
	};

	return showHandsFree ? (
		<HandsFreeMode
			steps={sortedSteps}
			language={language}
			onClose={() => setShowHandsFree(false)}
			recipeTitle={translation.title}
		/>
	) : (
		<div
			className={`fixed inset-0 z-50 ${theme.bgCard} overflow-hidden flex flex-col`}
		>
			{/* Header Image */}
			<div className='relative h-64 sm:h-80 flex-shrink-0'>
				{recipe.recipe.imageUrl ? (
					<img
						src={recipe.recipe.imageUrl}
						alt={translation.title}
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
							{language === 'ru'
								? 'Фото не добавлено'
								: language === 'de'
									? 'Kein Foto hinzugefügt'
									: 'No photo added'}
						</p>
					</div>
				)}
				<div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />

				<button
					onClick={onClose}
					className='absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors'
				>
					<X className='w-5 h-5 text-gray-700' />
				</button>

				<div className='absolute top-4 right-4 flex gap-2'>
					<button
						onClick={onEdit}
						className='p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors'
					>
						<Edit2 className='w-5 h-5 text-gray-700' />
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

				<div className='absolute bottom-0 left-0 right-0 p-4 sm:p-6'>
					<h1 className='text-2xl sm:text-3xl font-bold text-white'>
						{translation.title}
					</h1>
					{translation.description && (
						<p className='text-white/80 text-sm sm:text-base mt-1'>
							{translation.description}
						</p>
					)}
					{recipe.recipe.sourceUrl && (
						<a
							href={recipe.recipe.sourceUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='inline-flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200 mt-2'
						>
							{t('source')} <ExternalLink className='w-3.5 h-3.5' />
						</a>
					)}
				</div>
			</div>

			{/* Content */}
			<div className='flex-1 overflow-y-auto pb-4'>
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
								{language === 'ru' ? ' ккал' : ' kcal'}
							</span>
							{r.protein && (
								<span className='text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20'>
									{language === 'ru'
										? `Б: ${Math.round(r.protein * scaling)}г`
										: `E: ${Math.round(r.protein * scaling)}g`}
								</span>
							)}
							{r.fat && (
								<span className='text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20'>
									{language === 'ru'
										? `Ж: ${Math.round(r.fat * scaling)}г`
										: `F: ${Math.round(r.fat * scaling)}g`}
								</span>
							)}
							{r.carbs && (
								<span className='text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20'>
									{language === 'ru'
										? `У: ${Math.round(r.carbs * scaling)}г`
										: `KH: ${Math.round(r.carbs * scaling)}g`}
								</span>
							)}
						</div>
					)}
				</div>

				{scaling !== 1 && (
					<div className='px-4 pt-2'>
						<p className={`text-xs ${theme.textAccent}`}>
							{'x' + scaling.toFixed(2)}{' '}
							{language === 'ru'
								? 'от базового количества'
								: language === 'de'
									? 'von der Basis'
									: 'from base'}
						</p>
					</div>
				)}

				{/* Tabs */}
				<div className={`flex border-b ${theme.border} mt-2`}>
					<button
						onClick={() => setActiveTab('ingredients')}
						className={`flex-1 py-3 font-medium text-sm transition-colors ${
							activeTab === 'ingredients'
								? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}`
								: `${theme.textSecondary} hover:text-gray-400 dark:hover:text-gray-200`
						}`}
					>
						{t('ingredients')} ({recipe.ingredients.length})
					</button>
					<button
						onClick={() => setActiveTab('steps')}
						className={`flex-1 py-3 font-medium text-sm transition-colors ${
							activeTab === 'steps'
								? `${theme.tabActive} border-b-2 ${theme.tabActiveBorder} ${theme.tabActiveBg}`
								: `${theme.textSecondary} hover:text-gray-400 dark:hover:text-gray-200`
						}`}
					>
						{t('steps')} ({sortedSteps.length})
					</button>
				</div>

				{/* Tab Content */}
				<div className='p-4'>
					{activeTab === 'ingredients' && (
						<div className='space-y-3'>
							{recipe.ingredients.map((ing) => {
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
									className={`w-full py-3 ${theme.accentGradient} ${theme.accentHover} text-white rounded-xl font-medium shadow-md flex items-center justify-center gap-2 mt-4`}
								>
									<ShoppingBag className='w-5 h-5' />
									{t('addToShoppingList')} ({checkedIngredients.size})
								</button>
							)}
						</div>
					)}

					{activeTab === 'steps' && (
						<div className='space-y-4'>
							{sortedSteps.map((step, idx) => (
								<div
									key={step.id}
									className={`flex gap-4 items-start p-4 ${theme.bgSecondary} rounded-xl`}
								>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${theme.accentGradient}`}
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

							<button
								onClick={() => setShowHandsFree(true)}
								className={`w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-medium shadow-md flex items-center justify-center gap-2 transition-all mt-4`}
							>
								<Mic className='w-5 h-5' />
								{t('startCooking')}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface HandsFreeModeProps {
	steps: FullRecipe['steps'];
	language: string;
	onClose: () => void;
	recipeTitle: string;
}

function HandsFreeMode({
	steps,
	language,
	onClose,
	recipeTitle,
}: HandsFreeModeProps) {
	const { t } = useLanguage();
	const { theme } = useTheme();
	const [currentStep, setCurrentStep] = useState(0);
	const [isListening, setIsListening] = useState(false);
	const [spokenText, setSpokenText] = useState('');
	const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
	const [timerActive, setTimerActive] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);

	const getStepInstruction = (step: (typeof steps)[0]) => {
		const trans = step.translations.find((t) => t.language === language);
		return trans?.instruction || step.translations[0]?.instruction || '';
	};

	const currentStepData = steps[currentStep];
	const totalSteps = steps.length;

	useEffect(() => {
		if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
			const SpeechRecognition =
				window.SpeechRecognition || window.webkitSpeechRecognition;
			recognitionRef.current = new SpeechRecognition();
			recognitionRef.current.continuous = true;
			recognitionRef.current.interimResults = true;

			recognitionRef.current.onresult = (event) => {
				const last = event.results.length - 1;
				const text = event.results[last][0].transcript.toLowerCase();
				setSpokenText(text);

				if (
					text.includes('дальше') ||
					text.includes('next') ||
					text.includes('weiter')
				) {
					if (currentStep < totalSteps - 1) {
						setCurrentStep((s) => s + 1);
						speakInstruction(getStepInstruction(steps[currentStep + 1]));
					}
				}
				if (
					text.includes('назад') ||
					text.includes('back') ||
					text.includes('zurück')
				) {
					if (currentStep > 0) {
						setCurrentStep((s) => s - 1);
						speakInstruction(getStepInstruction(steps[currentStep - 1]));
					}
				}
				if (
					text.includes('повтори') ||
					text.includes('repeat') ||
					text.includes('wiederhole')
				) {
					speakInstruction(getStepInstruction(steps[currentStep]));
				}
			};

			recognitionRef.current.onerror = () => setIsListening(false);
		}

		return () => {
			recognitionRef.current?.stop();
		};
	}, [currentStep, totalSteps, language, steps]);

	const speakInstruction = (text: string) => {
		if ('speechSynthesis' in window) {
			speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang =
				language === 'ru' ? 'ru-RU' : language === 'de' ? 'de-DE' : 'en-US';
			utterance.rate = 0.9;
			speechSynthesis.speak(utterance);
		}
	};

	const speakInfo = (text: string) => {
		if ('speechSynthesis' in window) {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang =
				language === 'ru' ? 'ru-RU' : language === 'de' ? 'de-DE' : 'en-US';
			speechSynthesis.speak(utterance);
		}
	};

	const toggleListening = () => {
		if (isListening) {
			recognitionRef.current?.stop();
			setIsListening(false);
		} else {
			recognitionRef.current?.start();
			setIsListening(true);
		}
	};

	const handleNext = () => {
		if (currentStep < totalSteps - 1) {
			setCurrentStep((s) => s + 1);
			setTimerSeconds(null);
			setTimerActive(false);
		}
	};

	const handlePrev = () => {
		if (currentStep > 0) {
			setCurrentStep((s) => s - 1);
			setTimerSeconds(null);
			setTimerActive(false);
		}
	};

	useEffect(() => {
		if (timerActive && timerSeconds && timerSeconds > 0) {
			const interval = setInterval(() => {
				setTimerSeconds((s) => {
					if (s && s > 1) return s - 1;
					setTimerActive(false);
					speakInfo(
						language === 'ru'
							? 'Таймер завершен!'
							: language === 'de'
								? 'Timer fertig!'
								: 'Timer done!',
					);
					return 0;
				});
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [timerActive, timerSeconds, language]);

	const startTimer = () => {
		if (currentStepData?.timerMinutes) {
			setTimerSeconds(currentStepData.timerMinutes * 60);
			setTimerActive(true);
		}
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	return (
		<div className='fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col'>
			<div className='p-4 flex items-center justify-between'>
				<button
					onClick={onClose}
					className='px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-xl transition-colors'
				>
					{t('exitMode')}
				</button>
				<div className='text-center'>
					<p className='text-gray-400 text-sm'>{recipeTitle}</p>
					<p className='text-white font-bold'>
						{t('cookingStep')} {currentStep + 1} {t('of')} {totalSteps}
					</p>
				</div>
				<div className='w-20'>
					{isListening && (
						<div className='flex items-center gap-1 justify-end'>
							<Volume2 className='w-5 h-5 text-green-500 animate-pulse' />
							<span className='text-green-500 text-xs'>{t('listening')}</span>
						</div>
					)}
				</div>
			</div>

			<div className='flex justify-center gap-2 px-4 py-2'>
				{steps.map((_, idx) => (
					<div
						key={idx}
						className={`h-1.5 rounded-full transition-all ${
							idx === currentStep
								? `w-8 ${theme.accentPrimary}`
								: idx < currentStep
									? 'w-3 bg-orange-500/50'
									: 'w-3 bg-gray-600'
						}`}
					/>
				))}
			</div>

			<div className='flex-1 flex flex-col items-center justify-center p-6'>
				<div className='max-w-lg text-center'>
					<div
						className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${theme.accentGradient}`}
					>
						<span className='text-3xl font-bold text-white'>
							{currentStep + 1}
						</span>
					</div>
					<p className='text-2xl sm:text-3xl text-white font-medium leading-relaxed'>
						{currentStepData ? getStepInstruction(currentStepData) : ''}
					</p>

					{currentStepData?.timerMinutes && !timerSeconds && (
						<button
							onClick={startTimer}
							className='mt-6 px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-400 rounded-xl transition-colors flex items-center gap-2 mx-auto'
						>
							<Play className='w-5 h-5' />
							{currentStepData.timerMinutes} {t('minutes')}
						</button>
					)}

					{timerSeconds && (
						<div className='mt-6'>
							<p
								className={`text-5xl font-mono font-bold ${timerActive ? 'text-orange-500' : 'text-gray-600'}`}
							>
								{formatTime(timerSeconds)}
							</p>
							<button
								onClick={() => setTimerActive(!timerActive)}
								className='mt-2 p-2 text-gray-400 hover:text-white'
							>
								{timerActive ? (
									<Pause className='w-6 h-6' />
								) : (
									<Play className='w-6 h-6' />
								)}
							</button>
						</div>
					)}

					<div className='mt-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700'>
						<p className='text-gray-400 text-sm'>{t('sayNext')}</p>
						{spokenText && (
							<p className='text-orange-400 text-sm mt-1'>
								&quot;{spokenText}&quot;
							</p>
						)}
					</div>
				</div>
			</div>

			<div className='p-6 flex items-center justify-center gap-4'>
				<button
					onClick={handlePrev}
					disabled={currentStep === 0}
					className='p-4 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full transition-colors'
				>
					<SkipBack className='w-6 h-6' />
				</button>
				<button
					onClick={toggleListening}
					className={`p-6 rounded-full transition-all ${isListening ? 'bg-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]' : `${theme.accentGradient} ${theme.accentHover} shadow-lg`}`}
				>
					<Mic className='w-8 h-8 text-white' />
				</button>
				<button
					onClick={handleNext}
					disabled={currentStep === totalSteps - 1}
					className='p-4 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full transition-colors'
				>
					<SkipForward className='w-6 h-6' />
				</button>
			</div>
		</div>
	);
}
