import { useState, useCallback, useEffect } from 'react';
import { FullRecipe, ShoppingItem, Language } from '../types';
import { sampleRecipes } from '../data/sampleRecipes';
import {
  deleteRemoteRecipe,
  fetchUserRecipes,
  isSampleRecipeId,
  isUuid,
  persistFullRecipe,
  updateRecipeFlags,
} from '../lib/recipeDb';

export function useRecipeStore(userId?: string) {
	const [recipes, setRecipes] = useState<FullRecipe[]>(sampleRecipes);
	const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

	useEffect(() => {
		if (!userId) {
			setRecipes(sampleRecipes);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const remote = await fetchUserRecipes(userId);
				if (!cancelled) {
					setRecipes([...sampleRecipes, ...remote]);
				}
			} catch (err) {
				console.error(err);
				if (!cancelled) setRecipes(sampleRecipes);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId]);

	const addRecipe = useCallback((recipe: FullRecipe) => {
		setRecipes((prev) => [...prev, recipe]);
		if (!userId || isSampleRecipeId(recipe.recipe.id)) return;
		void persistFullRecipe(userId, recipe)
			.then((saved) => {
				setRecipes((prev) =>
					prev.map((r) => (r.recipe.id === recipe.recipe.id || r.recipe.id === saved.recipe.id ? saved : r)),
				);
			})
			.catch((err) => console.error(err));
	}, [userId]);

	const updateRecipe = useCallback((updatedRecipe: FullRecipe) => {
		setRecipes((prev) =>
			prev.map((r) =>
				r.recipe.id === updatedRecipe.recipe.id ? updatedRecipe : r,
			),
		);
		if (!userId || isSampleRecipeId(updatedRecipe.recipe.id)) return;
		void persistFullRecipe(userId, updatedRecipe).catch((err) => console.error(err));
	}, [userId]);

	const deleteRecipe = useCallback((recipeId: string) => {
		setRecipes((prev) => prev.filter((r) => r.recipe.id !== recipeId));
		if (!userId || isSampleRecipeId(recipeId) || !isUuid(recipeId)) return;
		void deleteRemoteRecipe(recipeId).catch((err) => console.error(err));
	}, [userId]);

	const toggleRecipeStatus = useCallback((recipeId: string) => {
		setRecipes((prev) => {
			const next = prev.map((r) => {
				if (r.recipe.id !== recipeId) return r;
				const status: FullRecipe['recipe']['status'] =
					r.recipe.status === 'want_to_cook' ? 'cooked_liked' : 'want_to_cook';
				return {
					...r,
					recipe: {
						...r.recipe,
						status,
					},
				};
			});
			const updated = next.find((r) => r.recipe.id === recipeId);
			if (updated && userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
				void updateRecipeFlags(recipeId, { status: updated.recipe.status }).catch((err) =>
					console.error(err),
				);
			}
			return next;
		});
	}, [userId]);

	const toggleVisibility = useCallback((recipeId: string) => {
		setRecipes((prev) => {
			const next = prev.map((r) =>
				r.recipe.id === recipeId
					? {
							...r,
							recipe: {
								...r.recipe,
								visibleToFriends: !r.recipe.visibleToFriends,
							},
						}
					: r,
			);
			const updated = next.find((r) => r.recipe.id === recipeId);
			if (updated && userId && isUuid(recipeId) && !isSampleRecipeId(recipeId)) {
				void updateRecipeFlags(recipeId, {
					visibleToFriends: updated.recipe.visibleToFriends,
				}).catch((err) => console.error(err));
			}
			return next;
		});
	}, [userId]);

	const addToShoppingList = useCallback(
		(
			ingredientName: string,
			quantity: number,
			unit: string,
			recipeId?: string,
		) => {
			setShoppingList((prev) => {
				const existing = prev.find(
					(item) =>
						item.ingredientName.toLowerCase() === ingredientName.toLowerCase(),
				);
				if (existing) {
					return prev.map((item) =>
						item.ingredientName.toLowerCase() === ingredientName.toLowerCase()
							? {
									...item,
									quantity: (item.quantity || 0) + quantity,
								}
							: item,
					);
				}
				return [
					...prev,
					{
						id: `shop-${Date.now()}`,
						ingredientName,
						quantity,
						unit,
						recipeId,
						checked: false,
					},
				];
			});
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
		addRecipe,
		updateRecipe,
		deleteRecipe,
		toggleRecipeStatus,
		toggleVisibility,
		addToShoppingList,
		toggleShoppingItem,
		removeFromShoppingList,
		clearShoppingList,
		addShoppingItem,
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
