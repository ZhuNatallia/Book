import { useState, useCallback, useEffect, useRef } from 'react';
import { FullRecipe, ShoppingItem, Language, MealPlan, MealPlanEntry } from '../types';
import { sampleRecipes } from '../data/sampleRecipes';
import {
  deleteRemoteRecipe,
  fetchUserRecipes,
  isSampleRecipeId,
  isUuid,
  persistFullRecipe,
  cloneRecipeForUser,
  translateCloneToLang,
  updateRecipeFlags,
  RecipeFlagPatch,
} from '../lib/recipeDb';
import { fetchMealPlan, persistMealPlan } from '../lib/mealPlanDb';
import {
  BookCache,
  EMPTY_MEAL_PLAN,
  SyncJob,
  emptyBookCache,
  loadBookCache,
  saveBookCache,
} from '../lib/localCache';
import { ingredientMergeKey, pickDisplayName } from '../lib/ingredientMerge';

function mergeByNameUnit(prev: ShoppingItem[], name: string, quantity: number, unit: string, recipeId?: string): ShoppingItem[] {
  const key = ingredientMergeKey(name, unit);
  const existing = prev.find(
    (item) => ingredientMergeKey(item.ingredientName, item.unit || '') === key,
  );
  if (existing) {
    return prev.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            quantity: (item.quantity || 0) + quantity,
            ingredientName: pickDisplayName(item.ingredientName, name),
          }
        : item,
    );
  }
  return [
    ...prev,
    {
      id: crypto.randomUUID(),
      ingredientName: name,
      quantity,
      unit,
      recipeId,
      checked: false,
    },
  ];
}

function applyPendingJobs(recipes: FullRecipe[], jobs: SyncJob[]): FullRecipe[] {
	let next = recipes;
	for (const job of jobs) {
		if (job.type === 'persistRecipe') {
			const id = job.recipe.recipe.id;
			if (next.some((r) => r.recipe.id === id)) {
				next = next.map((r) => (r.recipe.id === id ? job.recipe : r));
			} else {
				next = [...next, job.recipe];
			}
		} else if (job.type === 'updateFlags') {
			next = next.map((r) => {
				if (r.recipe.id !== job.recipeId) return r;
				return {
					...r,
					recipe: {
						...r.recipe,
						...(job.patch.status !== undefined ? { status: job.patch.status } : {}),
						...(job.patch.visibleToFriends !== undefined
							? { visibleToFriends: job.patch.visibleToFriends }
							: {}),
						...(job.patch.lastCookedAt !== undefined
							? { lastCookedAt: job.patch.lastCookedAt ?? undefined }
							: {}),
						...(job.patch.notes !== undefined ? { notes: job.patch.notes ?? undefined } : {}),
						...(job.patch.tags !== undefined ? { tags: job.patch.tags } : {}),
					},
				};
			});
		} else if (job.type === 'deleteRecipe') {
			next = next.filter((r) => r.recipe.id !== job.recipeId);
		}
	}
	return next;
}

export function useRecipeStore(userId?: string) {
	const [recipes, setRecipes] = useState<FullRecipe[]>(() => {
		if (!userId) return sampleRecipes;
		const cache = loadBookCache(userId);
		return cache ? [...sampleRecipes, ...cache.recipes] : sampleRecipes;
	});
	const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
		if (!userId) return [];
		return loadBookCache(userId)?.shoppingList ?? [];
	});
	const [mealPlan, setMealPlan] = useState<MealPlan>(() => {
		if (!userId) return EMPTY_MEAL_PLAN;
		return loadBookCache(userId)?.mealPlan ?? EMPTY_MEAL_PLAN;
	});
	const [syncing, setSyncing] = useState(false);
	const queueRef = useRef<SyncJob[]>(userId ? loadBookCache(userId)?.queue ?? [] : []);
	const recipesRef = useRef(recipes);
	const shoppingRef = useRef(shoppingList);
	const mealPlanRef = useRef(mealPlan);
	recipesRef.current = recipes;
	shoppingRef.current = shoppingList;
	mealPlanRef.current = mealPlan;

	const persistCache = useCallback(() => {
		if (!userId) return;
		const cache: BookCache = {
			recipes: recipesRef.current.filter((r) => !isSampleRecipeId(r.recipe.id)),
			shoppingList: shoppingRef.current,
			mealPlan: mealPlanRef.current,
			queue: queueRef.current,
		};
		saveBookCache(userId, cache);
	}, [userId]);

	const enqueue = useCallback((job: SyncJob) => {
		queueRef.current = [...queueRef.current, job];
		persistCache();
	}, [persistCache]);

	const flushQueue = useCallback(async () => {
		if (!userId || !navigator.onLine) return;
		const jobs = [...queueRef.current];
		if (jobs.length === 0) return;
		setSyncing(true);
		const remaining: SyncJob[] = [];
		for (const job of jobs) {
			try {
				if (job.type === 'persistRecipe') {
					await persistFullRecipe(userId, job.recipe);
				} else if (job.type === 'updateFlags') {
					await updateRecipeFlags(job.recipeId, job.patch);
				} else if (job.type === 'deleteRecipe') {
					await deleteRemoteRecipe(job.recipeId);
				} else if (job.type === 'persistMealPlan') {
					await persistMealPlan(userId, job.plan);
				}
			} catch {
				remaining.push(job);
			}
		}
		queueRef.current = remaining;
		persistCache();
		setSyncing(false);
	}, [userId, persistCache]);

	const runRemote = useCallback(async (job: SyncJob) => {
		if (!userId) return;
		if (!navigator.onLine) {
			enqueue(job);
			return;
		}
		try {
			if (job.type === 'persistRecipe') {
				const saved = await persistFullRecipe(userId, job.recipe);
				setRecipes((prev) =>
					prev.map((r) =>
						r.recipe.id === job.recipe.recipe.id || r.recipe.id === saved.recipe.id ? saved : r,
					),
				);
			} else if (job.type === 'updateFlags') {
				await updateRecipeFlags(job.recipeId, job.patch);
			} else if (job.type === 'deleteRecipe') {
				await deleteRemoteRecipe(job.recipeId);
			} else if (job.type === 'persistMealPlan') {
				await persistMealPlan(userId, job.plan);
			}
		} catch {
			enqueue(job);
		}
	}, [userId, enqueue]);

	useEffect(() => {
		persistCache();
	}, [recipes, shoppingList, mealPlan, persistCache]);

	const mealPlanHydrated = useRef(false);
	useEffect(() => {
		mealPlanHydrated.current = false;
	}, [userId]);
	useEffect(() => {
		if (!userId) return;
		if (!mealPlanHydrated.current) {
			mealPlanHydrated.current = true;
			return;
		}
		const timer = window.setTimeout(() => {
			void runRemote({ type: 'persistMealPlan', plan: mealPlan });
		}, 400);
		return () => window.clearTimeout(timer);
	}, [mealPlan, userId, runRemote]);

	useEffect(() => {
		if (!userId) {
			setRecipes(sampleRecipes);
			setShoppingList([]);
			setMealPlan(EMPTY_MEAL_PLAN);
			queueRef.current = [];
			return;
		}
		const cached = loadBookCache(userId) ?? emptyBookCache();
		queueRef.current = cached.queue;
		setRecipes([...sampleRecipes, ...cached.recipes]);
		setShoppingList(cached.shoppingList);
		setMealPlan(cached.mealPlan);

		let cancelled = false;
		(async () => {
			try {
				await flushQueue();
				const [remote, remotePlan] = await Promise.all([
					fetchUserRecipes(userId),
					fetchMealPlan(userId),
				]);
				if (cancelled) return;
				setRecipes([...sampleRecipes, ...applyPendingJobs(remote, queueRef.current)]);
				if (queueRef.current.every((j) => j.type !== 'persistMealPlan')) {
					setMealPlan(remotePlan);
				}
			} catch (err) {
				console.error(err);
			}
		})();

		const onOnline = () => {
			void flushQueue();
		};
		window.addEventListener('online', onOnline);
		return () => {
			cancelled = true;
			window.removeEventListener('online', onOnline);
		};
	}, [userId, flushQueue]);

	const addRecipe = useCallback((recipe: FullRecipe) => {
		setRecipes((prev) => [...prev, recipe]);
		if (!userId || isSampleRecipeId(recipe.recipe.id)) return;
		void runRemote({ type: 'persistRecipe', recipe });
	}, [userId, runRemote]);

	const copyRecipe = useCallback(async (full: FullRecipe, lang: Language) => {
		if (!userId) return;
		const clone = cloneRecipeForUser(full, userId);
		let toSave = clone;
		try {
			if (navigator.onLine) {
				toSave = await translateCloneToLang(clone, lang);
			}
		} catch (err) {
			console.error(err);
		}
		addRecipe(toSave);
	}, [userId, addRecipe]);

	const updateRecipe = useCallback((updatedRecipe: FullRecipe) => {
		setRecipes((prev) =>
			prev.map((r) =>
				r.recipe.id === updatedRecipe.recipe.id ? updatedRecipe : r,
			),
		);
		if (!userId || isSampleRecipeId(updatedRecipe.recipe.id)) return;
		void runRemote({ type: 'persistRecipe', recipe: updatedRecipe });
	}, [userId, runRemote]);

	const deleteRecipe = useCallback((recipeId: string) => {
		setRecipes((prev) => prev.filter((r) => r.recipe.id !== recipeId));
		setMealPlan((prev) => ({
			...prev,
			entries: prev.entries.filter((e) => e.recipeId !== recipeId),
		}));
		if (!userId || isSampleRecipeId(recipeId) || !isUuid(recipeId)) return;
		void runRemote({ type: 'deleteRecipe', recipeId });
	}, [userId, runRemote]);

	const toggleRecipeStatus = useCallback((recipeId: string) => {
		let patch: RecipeFlagPatch = {};
		setRecipes((prev) => {
			const next = prev.map((r) => {
				if (r.recipe.id !== recipeId) return r;
				const status: FullRecipe['recipe']['status'] =
					r.recipe.status === 'want_to_cook' ? 'cooked_liked' : 'want_to_cook';
				const lastCookedAt =
					status === 'cooked_liked' ? new Date().toISOString() : r.recipe.lastCookedAt;
				patch = { status, lastCookedAt: lastCookedAt ?? null };
				return {
					...r,
					recipe: {
						...r.recipe,
						status,
						lastCookedAt,
					},
				};
			});
			return next;
		});
		if (userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
			void runRemote({ type: 'updateFlags', recipeId, patch });
		}
	}, [userId, runRemote]);

	const toggleVisibility = useCallback((recipeId: string) => {
		let nextVisible = false;
		setRecipes((prev) => {
			const next = prev.map((r) => {
				if (r.recipe.id !== recipeId) return r;
				nextVisible = !r.recipe.visibleToFriends;
				return {
					...r,
					recipe: {
						...r.recipe,
						visibleToFriends: nextVisible,
					},
				};
			});
			return next;
		});
		if (userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
			void runRemote({
				type: 'updateFlags',
				recipeId,
				patch: { visibleToFriends: nextVisible },
			});
		}
	}, [userId, runRemote]);

	const addToShoppingList = useCallback(
		(ingredientName: string, quantity: number, unit: string, recipeId?: string) => {
			setShoppingList((prev) => mergeByNameUnit(prev, ingredientName, quantity, unit, recipeId));
		},
		[],
	);

	const toggleShoppingItem = useCallback((itemId: string) => {
		setShoppingList((prev) =>
			prev.map((item) =>
				item.id === itemId ? { ...item, checked: !item.checked } : item,
			),
		);
	}, []);

	const removeFromShoppingList = useCallback((itemId: string) => {
		setShoppingList((prev) => prev.filter((item) => item.id !== itemId));
	}, []);

	const clearShoppingList = useCallback(() => {
		setShoppingList([]);
	}, []);

	const addShoppingItem = useCallback((name: string) => {
		setShoppingList((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				ingredientName: name,
				checked: false,
			},
		]);
	}, []);

	const saveMealPlan = useCallback((plan: MealPlan) => {
		const dayCount = Math.min(7, Math.max(1, plan.dayCount));
		const seenIds = new Set<string>();
		const normalized: MealPlan = {
			dayCount,
			entries: plan.entries
				.filter((entry) => {
					if (seenIds.has(entry.id)) return false;
					seenIds.add(entry.id);
					return true;
				})
				.map((entry, idx) => ({
					...entry,
					dayIndex: entry.dayIndex != null && entry.dayIndex < dayCount ? entry.dayIndex : null,
					sortOrder: idx,
				})),
		};
		setMealPlan(normalized);
	}, []);

	const toggleInMenu = useCallback((recipeId: string) => {
		setMealPlan((prev) => {
			const exists = prev.entries.some((e) => e.recipeId === recipeId);
			if (exists) {
				return { ...prev, entries: prev.entries.filter((e) => e.recipeId !== recipeId) };
			}
			return {
				...prev,
				entries: [
					...prev.entries,
					{
						id: crypto.randomUUID(),
						recipeId,
						dayIndex: null,
						sortOrder: prev.entries.length,
					} satisfies MealPlanEntry,
				],
			};
		});
	}, []);

	const getTranslation = useCallback(
		(
			recipe: FullRecipe,
			language: Language,
		): { title: string; description?: string } => {
			const translation = recipe.translations.find(
				(t) => t.language === language,
			);
			if (translation) {
				return {
					title: translation.title,
					description: translation.description,
				};
			}
			const fallback = recipe.translations.find((t) => t.language === 'ru');
			return fallback
				? { title: fallback.title, description: fallback.description }
				: { title: 'Untitled' };
		},
		[],
	);

	const getIngredientName = useCallback(
		(ingredient: FullRecipe['ingredients'][0], language: Language): string => {
			const translation = ingredient.translations.find(
				(t) => t.language === language,
			);
			if (translation) {
				return translation.name;
			}
			const fallback = ingredient.translations.find((t) => t.language === 'ru');
			return fallback?.name || 'Unknown';
		},
		[],
	);

	const getStepInstruction = useCallback(
		(step: FullRecipe['steps'][0], language: Language): string => {
			const translation = step.translations.find(
				(t) => t.language === language,
			);
			if (translation) {
				return translation.instruction;
			}
			const fallback = step.translations.find((t) => t.language === 'ru');
			return fallback?.instruction || '';
		},
		[],
	);

	return {
		recipes,
		shoppingList,
		mealPlan,
		syncing,
		addRecipe,
		copyRecipe,
		updateRecipe,
		deleteRecipe,
		toggleRecipeStatus,
		toggleVisibility,
		addToShoppingList,
		toggleShoppingItem,
		removeFromShoppingList,
		clearShoppingList,
		addShoppingItem,
		saveMealPlan,
		toggleInMenu,
		getTranslation,
		getIngredientName,
		getStepInstruction,
	};
}

export function useVoiceSimulation() {
	const [isListening, setIsListening] = useState(false);
	const [spokenText, setSpokenText] = useState('');

	const startListening = useCallback(() => {
		setIsListening(true);
		setSpokenText('');
	}, []);

	const stopListening = useCallback(() => {
		setIsListening(false);
		setSpokenText('');
	}, []);

	const simulateVoiceCommand = useCallback(
		(
			_onNext?: () => void,
			_onPrevious?: () => void,
			_onQuery?: (query: string) => void,
		) => {
			const phrases = [
				'Дальше',
				'Next',
				'Weiter',
				'Сколько сахара?',
				'How much sugar?',
			];
			let index = 0;

			const interval = setInterval(() => {
				if (isListening && index < phrases.length) {
					setSpokenText(phrases[index]);
					index++;
				} else {
					clearInterval(interval);
				}
			}, 3000);

			return () => clearInterval(interval);
		},
		[isListening],
	);

	const speak = useCallback((text: string) => {
		if ('speechSynthesis' in window) {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = 0.9;
			speechSynthesis.speak(utterance);
		}
	}, []);

	return {
		isListening,
		spokenText,
		startListening,
		stopListening,
		simulateVoiceCommand,
		speak,
	};
}
