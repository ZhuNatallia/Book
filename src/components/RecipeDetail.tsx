import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { FullRecipe } from '../types';
import { ShelfPicker } from './ShelfPicker';
import { hasMomsShelf } from '../data/shelves';
import { isSampleRecipeId, parseFiniteInput } from '../lib/recipeDb';
import { VisibilityEye } from './VisibilityEye';
import { FriendCircle, circlesFromVisible } from '../lib/friendCircles';
import { X, Minus, Plus, Play, Pause, RotateCcw, Clock, ShoppingBag, ExternalLink, Pencil, Trash2, ChefHat, UtensilsCrossed, Flame, CheckCircle, BookmarkPlus, Volume2, AlertCircle } from 'lucide-react';

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
const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'pinch', 'cup'];

const foldVoice = (text: string) =>
	text
		.toLowerCase()
		.replace(/ё/g, 'е')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[.!?,…'’«»"]+/g, ' ');

const STOP_WORDS = [
	'стоп',
	'stop',
	'stopp',
	'тоқта',
	'pare',
	'останови',
	'остановись',
	'хватит',
	'stój',
	'stoj',
	'ferma',
	'para',
	'arrête',
	'arrete',
	'arrêt',
	'arret',
];

const NEXT_WORDS = [
	'дальше',
	'продолжай',
	'продолжи',
	'continue',
	'next',
	'weiter',
	'далі',
	'dalej',
	'avanti',
	'sigue',
	'suivant',
	'әрі',
	'әрі қарай',
	'жалғастыр',
];

const voiceTokens = (text: string) => foldVoice(text).split(/\s+/).filter(Boolean);

const matchesVoice = (text: string, words: string[]) => {
	const folded = foldVoice(text);
	const tokens = voiceTokens(text);
	return words.some((word) => {
		const foldedWord = foldVoice(word);
		return foldedWord.includes(' ') ? folded.includes(foldedWord) : tokens.includes(foldedWord);
	});
};

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
	onChangeVisibility?: (circles: FriendCircle[]) => void;
	readOnly?: boolean;
	onCopy?: () => boolean | 'duplicate' | void;
	extraTags?: string[];
}

export function RecipeDetail({
	recipe,
	onClose,
	onEdit,
	onDelete,
	onAddToShoppingList,
	onUpdate,
	onChangeVisibility,
	readOnly = false,
	onCopy,
	extraTags = [],
}: RecipeDetailProps) {
	const { language, t } = useLanguage();
	const { theme, momsPaper } = useTheme();
	const [servings, setServings] = useState(recipe.recipe.servings || 4);
	const [scaling, setScaling] = useState(1);
	const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>(
		'ingredients',
	);
	const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
		new Set(),
	);
	const [addedToList, setAddedToList] = useState(false);
	const [copiedToBook, setCopiedToBook] = useState<'saved' | 'duplicate' | null>(null);
	const isPersonal = !readOnly && !isSampleRecipeId(recipe.recipe.id);
	const notebook = momsPaper && hasMomsShelf(recipe.recipe.tags);
	const [notes, setNotes] = useState(recipe.recipe.notes || '');
	const [imgFailed, setImgFailed] = useState(false);
	const [photoOpen, setPhotoOpen] = useState(false);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [listenError, setListenError] = useState<string | null>(null);
	const [stopReady, setStopReady] = useState(false);
	const [voicePaused, setVoicePaused] = useState(false);
	const readingRef = useRef(false);
	const voicePausedRef = useRef(false);
	const bargeHold = useRef(false);
	const continueAfter = useRef(0);
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const listenRef = useRef<SpeechRecognition | null>(null);
	const listenGen = useRef(0);
	const localListenRef = useRef<{ stop: () => Promise<void> } | null>(null);
	const localMode = useRef(false);
	const preparedStop = useRef<Promise<{
		wordLabels: () => string[];
		listen: (
			callback: (result: { scores: ArrayLike<number> }) => void,
			options?: {
				overlapFactor?: number;
				probabilityThreshold?: number;
				invokeCallbackOnNoiseAndUnknown?: boolean;
			},
		) => Promise<void>;
		stopListening: () => Promise<void>;
	} | null> | null>(null);
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
		const spoken = title === t('timerDone') ? title : `${t('timerDone')}. ${title}`;
		void speakAlert(spoken);
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
			readingRef.current = false;
			voicePausedRef.current = false;
			try {
				listenRef.current?.abort();
			} catch {
				/* already stopped */
			}
			listenRef.current = null;
			const local = localListenRef.current;
			localListenRef.current = null;
			try {
				void local?.stop()?.catch(() => undefined);
			} catch {
				/* already stopped */
			}
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
			readingRef.current = false;
			voicePausedRef.current = false;
			setVoicePaused(false);
			utteranceRef.current = null;
			try {
				listenRef.current?.abort();
			} catch {
				/* already stopped */
			}
			listenRef.current = null;
			const local = localListenRef.current;
			localListenRef.current = null;
			try {
				void local?.stop()?.catch(() => undefined);
			} catch {
				/* already stopped */
			}
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

	const stepsRef = useRef(realSteps);
	stepsRef.current = realSteps;
	const langRef = useRef(language);
	langRef.current = language;
	const indexRef = useRef(currentStepIndex);

	const loadVoices = () => {
		const synth = window.speechSynthesis;
		const existing = synth.getVoices();
		if (existing.length) return Promise.resolve(existing);
		return new Promise<SpeechSynthesisVoice[]>((resolve) => {
			const finish = () => {
				synth.removeEventListener('voiceschanged', finish);
				resolve(synth.getVoices());
			};
			synth.addEventListener('voiceschanged', finish);
			window.setTimeout(finish, 700);
		});
	};

	const voiceFor = (voices: SpeechSynthesisVoice[], lang: string) => {
		const locale = (SPEECH_LOCALES[lang] || 'ru-RU').toLowerCase();
		const prefix = lang.toLowerCase();
		return (
			voices.find((v) => v.lang.toLowerCase() === locale) ||
			voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix)) ||
			null
		);
	};

	const isStopCommand = (text: string) => matchesVoice(text, STOP_WORDS);
	const isNextCommand = (text: string) => matchesVoice(text, NEXT_WORDS);

	const stopListening = () => {
		listenGen.current += 1;
		localMode.current = false;
		setStopReady(false);
		const rec = listenRef.current;
		listenRef.current = null;
		const local = localListenRef.current;
		localListenRef.current = null;
		try {
			void local?.stop()?.catch(() => undefined);
		} catch {
			/* already stopped */
		}
		if (!rec) return;
		try {
			rec.abort();
		} catch {
			/* already stopped */
		}
	};

	const startLocalStop = async (generation: number) => {
		if (localListenRef.current || generation !== listenGen.current) return;
		if (!readingRef.current && !voicePausedRef.current) return;
		try {
			const recognizer = await prepareStopModel();
			if (!recognizer || generation !== listenGen.current || localListenRef.current) return;
			if (!readingRef.current && !voicePausedRef.current) return;
			const labels = recognizer.wordLabels();
			const stopAt = labels.indexOf('stop');
			const goAt = labels.indexOf('go');
			const ignore = new Set(['_background_noise_', '_unknown_']);
			let hits = 0;
			let holdUntil = 0;
			const handle = { stop: () => recognizer.stopListening() };
			localListenRef.current = handle;
			await recognizer.listen(
				(result) => {
					if (stopAt < 0) return;
					const scores = Array.from(result.scores as ArrayLike<number>);
					let best = -1;
					for (let i = 0; i < scores.length; i++) {
						if (ignore.has(labels[i])) continue;
						if (best < 0 || Number(scores[i]) > Number(scores[best])) best = i;
					}
					if (voicePausedRef.current) {
						if (performance.now() < continueAfter.current) return;
						const goScore = goAt >= 0 ? Number(scores[goAt] ?? 0) : 0;
						if (goScore >= 0.25 && best === goAt) resumeReading();
						return;
					}
					if (!readingRef.current) return;
					const score = Number(scores[stopAt] ?? 0);
					const heard = best === stopAt && score >= 0.2;
					const now = performance.now();
					if (!heard) {
						if (now < holdUntil) return;
						hits = 0;
						bargeHold.current = false;
						if (speechSynthesis.paused && readingRef.current) speechSynthesis.resume();
						return;
					}
					hits += 1;
					if (speechSynthesis.speaking && !speechSynthesis.paused) speechSynthesis.pause();
					bargeHold.current = true;
					holdUntil = now + 900;
					if (score >= 0.35 || hits >= 2) pauseByVoice();
				},
				{
					overlapFactor: 0.5,
					probabilityThreshold: 0.15,
					invokeCallbackOnNoiseAndUnknown: true,
				},
			);
			setStopReady(true);
			if (localListenRef.current !== handle) return;
			if (generation !== listenGen.current || (!readingRef.current && !voicePausedRef.current)) {
				localListenRef.current = null;
				void recognizer.stopListening().catch(() => undefined);
			}
		} catch {
			if (voicePausedRef.current || localListenRef.current === null) return;
			if (readingRef.current && generation === listenGen.current) {
				setListenError(t('voiceListenFailed'));
			}
		}
	};

	const prepareStopModel = () => {
		if (!preparedStop.current) {
			preparedStop.current = (async () => {
				await import('@tensorflow/tfjs');
				const speechCommands = await import('@tensorflow-models/speech-commands');
				const recognizer = speechCommands.create('BROWSER_FFT');
				await recognizer.ensureModelLoaded();
				return recognizer;
			})().catch(() => null);
		}
		return preparedStop.current;
	};

	useEffect(() => {
		if (activeTab === 'steps' && !showWatchInsteadOfSteps) void prepareStopModel();
	}, [activeTab, showWatchInsteadOfSteps]);

	const startListening = () => {
		const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!Ctor) {
			localMode.current = true;
			void startLocalStop(listenGen.current);
			return;
		}
		if (listenRef.current || localMode.current) return;
		const generation = listenGen.current;
		let cloudDead = false;
		const recognition = new Ctor();
		recognition.lang = SPEECH_LOCALES[langRef.current] || 'ru-RU';
		recognition.interimResults = true;
		recognition.continuous = true;
		recognition.maxAlternatives = 3;
		recognition.onresult = (event) => {
			if (!readingRef.current && !voicePausedRef.current) return;
			for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
				const row = event.results[i];
				const options = Math.max(row.length ?? 1, 1);
				for (let alt = 0; alt < options; alt++) {
					const text = row[alt]?.transcript ?? '';
					if (isStopCommand(text)) {
						pauseByVoice();
						return;
					}
					if (isNextCommand(text)) {
						if (performance.now() < continueAfter.current) return;
						resumeReading();
						return;
					}
				}
			}
		};
		recognition.onerror = (event) => {
			const code = (event as Event & { error?: string }).error ?? '';
			if (code === 'not-allowed' || code === 'service-not-allowed') {
				setListenError(t('voiceMicDenied'));
				if (listenRef.current === recognition) listenRef.current = null;
				return;
			}
			if (code === 'aborted' || code === 'no-speech') return;
			if (code === 'network') {
				cloudDead = true;
				if (listenRef.current === recognition) listenRef.current = null;
				if (voicePausedRef.current) {
					window.setTimeout(() => {
						if (!voicePausedRef.current || generation !== listenGen.current) return;
						startListening();
					}, 700);
					return;
				}
				localMode.current = true;
				void startLocalStop(generation);
			}
		};
		recognition.onend = () => {
			if (listenRef.current === recognition) listenRef.current = null;
			if (cloudDead || localMode.current) return;
			const keep = readingRef.current || voicePausedRef.current;
			if (!keep || generation !== listenGen.current) return;
			window.setTimeout(() => {
				if (!(readingRef.current || voicePausedRef.current) || generation !== listenGen.current) return;
				startListening();
			}, 300);
		};
		listenRef.current = recognition;
		try {
			recognition.start();
		} catch {
			listenRef.current = null;
			window.setTimeout(() => {
				if (!(readingRef.current || voicePausedRef.current) || generation !== listenGen.current) return;
				startListening();
			}, 300);
		}
	};

	const pauseByVoice = () => {
		if (!readingRef.current) return;
		readingRef.current = false;
		utteranceRef.current = null;
		voicePausedRef.current = true;
		bargeHold.current = false;
		continueAfter.current = performance.now() + 1600;
		localMode.current = false;
		setVoicePaused(true);
		setIsSpeaking(false);
		setStopReady(true);
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		const rec = listenRef.current;
		listenRef.current = null;
		try {
			rec?.abort();
		} catch {
			/* already stopped */
		}
		startListening();
		void startLocalStop(listenGen.current);
	};

	const resumeReading = () => {
		if (!voicePausedRef.current) return;
		voicePausedRef.current = false;
		setVoicePaused(false);
		readFrom(indexRef.current);
	};

	const stopReading = () => {
		readingRef.current = false;
		voicePausedRef.current = false;
		setVoicePaused(false);
		utteranceRef.current = null;
		stopListening();
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		setIsSpeaking(false);
	};

	const speakText = async (text: string, chain: boolean) => {
		if (!('speechSynthesis' in window) || !text.trim()) return;
		const voices = await loadVoices();
		if (chain && !readingRef.current) return;
		utteranceRef.current = null;
		speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utteranceRef.current = utterance;
		utterance.lang = SPEECH_LOCALES[langRef.current] || 'ru-RU';
		utterance.rate = 0.9;
		const voice = voiceFor(voices, langRef.current);
		if (voice) utterance.voice = voice;
		utterance.onend = () => {
			if (utteranceRef.current !== utterance) return;
			if (!chain || !readingRef.current) {
				setIsSpeaking(false);
				return;
			}
			const next = indexRef.current + 1;
			if (next < stepsRef.current.length) {
				indexRef.current = next;
				setCurrentStepIndex(next);
				const nextText = getStepInstruction(stepsRef.current[next]).trim();
				if (nextText) void speakText(nextText, true);
				else stopReading();
			} else {
				stopReading();
			}
		};
		utterance.onerror = () => {
			if (utteranceRef.current !== utterance) return;
		};
		setIsSpeaking(true);
		speechSynthesis.speak(utterance);
		window.setTimeout(() => {
			if (bargeHold.current) return;
			if (speechSynthesis.paused && readingRef.current) speechSynthesis.resume();
		}, 250);
	};

	const speakAlert = (text: string) => {
		readingRef.current = false;
		stopListening();
		void speakText(text, false);
	};

	const readFrom = (idx: number) => {
		const steps = stepsRef.current;
		if (!('speechSynthesis' in window) || steps.length === 0) return;
		const safe = Math.min(Math.max(idx, 0), steps.length - 1);
		const text = getStepInstruction(steps[safe]).trim();
		if (!text) return;
		readingRef.current = true;
		indexRef.current = safe;
		setListenError(null);
		setCurrentStepIndex(safe);
		const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (AudioCtx) {
			if (!beepCtx.current) beepCtx.current = new AudioCtx();
			void beepCtx.current.resume();
		}
		void startLocalStop(listenGen.current);
		startListening();
		void speakText(text, true);
	};

	const readCurrentStep = () => {
		readFrom(indexRef.current);
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
			className={`fixed inset-0 z-[70] overflow-hidden flex flex-col ${
				notebook ? 'notebook-paper' : theme.bgPrimary
			}`}
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
						className={`w-full h-full flex flex-col items-center justify-center relative ${
							notebook ? '' : theme.bgPrimary
						}`}
					>
						{!notebook && (
							<>
						<div className='absolute top-8 right-8 w-20 h-20 bg-orange-200/40 rounded-full' />
						<div className='absolute bottom-12 left-12 w-16 h-16 bg-rose-200/40 rounded-full' />
						<div className='absolute top-1/4 left-1/4 w-10 h-10 bg-amber-200/30 rounded-full' />
						<div className='absolute bottom-1/3 right-1/4 w-8 h-8 bg-orange-200/30 rounded-full' />
							</>
						)}

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

				{!readOnly && isPersonal && onChangeVisibility && (
					<div className='z-10 absolute top-4 left-16'>
						<VisibilityEye
							circles={circlesFromVisible(
								recipe.recipe.visibleToFriends,
								recipe.recipe.visibleCircles,
							)}
							onChange={onChangeVisibility}
							buttonClassName={`p-2 rounded-full backdrop-blur-sm shadow-md border ${
								recipe.recipe.visibleToFriends
									? 'bg-white/90 text-emerald-600 border-emerald-200'
									: 'bg-white/90 text-gray-500 border-white/60'
							}`}
							iconClassName='w-5 h-5'
						/>
					</div>
				)}

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
						const result = onCopy?.();
						if (result === false) return;
						setCopiedToBook(result === 'duplicate' ? 'duplicate' : 'saved');
						window.setTimeout(() => setCopiedToBook(null), 2500);
					}}
					className='z-10 absolute top-4 right-4 max-w-[calc(100%-5rem)] px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors flex items-center gap-1.5'
				>
					{copiedToBook === 'saved' ? (
						<CheckCircle className='w-4 h-4 text-emerald-600 flex-shrink-0' />
					) : copiedToBook === 'duplicate' ? (
						<AlertCircle className='w-4 h-4 text-amber-600 flex-shrink-0' />
					) : (
						<BookmarkPlus className='w-4 h-4 text-gray-700 flex-shrink-0' />
					)}
					<span className='text-xs sm:text-sm font-medium text-gray-800 truncate'>
						{copiedToBook === 'saved'
							? t('savedToMyBook')
							: copiedToBook === 'duplicate'
								? t('recipeAlreadyExists')
								: t('saveToMyBook')}
					</span>
				</button>
				)}

			</div>

			{/* Content */}
			<div className='flex-1 overflow-y-auto pb-4'>
				{/* Title block — in document flow, below photo */}
				<div className={`px-4 sm:px-6 pt-5 pb-4 border-b ${theme.border}`}>
					<h1 className={notebook ? 'notebook-title line-clamp-3' : `text-2xl sm:text-3xl font-bold ${theme.textPrimary} line-clamp-3`}>
						{translation.title}
					</h1>
					{translation.description && (
						<p className={notebook ? 'notebook-desc mt-2 whitespace-pre-line' : `${theme.textSecondary} text-base mt-2 leading-relaxed whitespace-pre-line`}>
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
						<div className={notebook ? '' : 'space-y-3'}>
							{realIngredients.map((ing) => {
								const name = getIngredientName(ing);
								const scaledQty =
									(ing.quantity / (recipe.recipe.servings || 4)) * servings;
								const isChecked = checkedIngredients.has(ing.id);

								return (
									<label
										key={ing.id}
										className={
											notebook
												? `notebook-hand notebook-ing ${isChecked ? 'is-checked' : ''}`
												: `flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer border ${
														isChecked
															? `${theme.tabActiveBg} border-${theme.borderAccent || 'orange-500'}`
															: `${theme.bgSecondary} border-transparent hover:bg-black/5 dark:hover:bg-white/5`
													}`
										}
									>
										<input
											type='checkbox'
											checked={isChecked}
											onChange={() => toggleIngredientCheck(ing.id)}
											className='w-5 h-5 mt-0.5 shrink-0 rounded border-gray-400 dark:border-gray-500 text-orange-500 focus:ring-orange-500 bg-transparent'
										/>
										<span className='flex-1 flex items-start gap-x-2 notebook-ing-text min-w-0'>
											<span
												className={
													notebook
														? 'notebook-qty whitespace-nowrap'
														: `font-bold ${theme.textAccent} whitespace-nowrap shrink-0`
												}
											>
												{scaledQty % 1 === 0 ? scaledQty : scaledQty.toFixed(1)}
												&nbsp;
												{formatUnit(ing.unit)}
											</span>
											<span className={notebook ? '' : `${theme.textPrimary} font-medium text-base min-w-0 break-words`}>
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
						<div className={notebook ? '' : 'space-y-4'}>
							{realSteps.length > 0 && (
								<button
									type='button'
									onClick={isSpeaking ? stopReading : readCurrentStep}
									className={`w-full py-3 rounded-2xl ${theme.accentGradient} ${theme.headerText} font-medium flex items-center justify-center gap-2 ${notebook ? 'mb-4' : ''}`}
								>
									<Volume2 className='w-5 h-5' />
									{isSpeaking
										? t('stopReading')
										: `${t('readStep')} ${Math.min(currentStepIndex, realSteps.length - 1) + 1}`}
								</button>
							)}
							{(isSpeaking || voicePaused) && !listenError && (
								<p className={`text-center text-sm ${theme.textSecondary} ${notebook ? 'mb-4' : '-mt-2'}`}>
									{voicePaused ? t('voiceSayNext') : stopReady ? t('voiceSayStop') : t('voiceStopArming')}
								</p>
							)}
							{listenError && (
								<p className={`text-center text-sm text-red-600 ${notebook ? 'mb-4' : '-mt-2'}`}>
									{listenError}
								</p>
							)}
							{realSteps.map((step, idx) => (
								<button
									type='button'
									key={step.id}
									onClick={() => {
										indexRef.current = idx;
										if (readingRef.current) readFrom(idx);
										else setCurrentStepIndex(idx);
									}}
									className={
										notebook
											? `notebook-hand notebook-step ${idx === currentStepIndex ? 'is-current' : ''}`
											: `w-full text-left flex gap-4 items-start p-4 rounded-2xl ${
													idx === currentStepIndex
														? `${theme.tabActiveBg} border ${theme.borderAccent}`
														: theme.bgSecondary
												}`
									}
								>
									{notebook ? (
										<span className="notebook-step-num">{idx + 1}.</span>
									) : (
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${theme.btnPrimary}`}
									>
										{idx + 1}
									</div>
									)}
									<div className='flex-1'>
										<p className={notebook ? '' : `${theme.textPrimary} font-medium text-base`}>
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
