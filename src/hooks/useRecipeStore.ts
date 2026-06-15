import { useState, useCallback } from 'react';
import { FullRecipe, ShoppingItem, Language } from '../types';
import { sampleRecipes } from '../data/sampleRecipes';

export function useRecipeStore() {
	const [recipes, setRecipes] = useState<FullRecipe[]>(sampleRecipes);
	const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

	const addRecipe = useCallback((recipe: FullRecipe) => {
		setRecipes((prev) => [...prev, recipe]);
	}, []);

	const updateRecipe = useCallback((updatedRecipe: FullRecipe) => {
		setRecipes((prev) =>
			prev.map((r) =>
				r.recipe.id === updatedRecipe.recipe.id ? updatedRecipe : r,
			),
		);
	}, []);

	const deleteRecipe = useCallback((recipeId: string) => {
		setRecipes((prev) => prev.filter((r) => r.recipe.id !== recipeId));
	}, []);

	const toggleRecipeStatus = useCallback((recipeId: string) => {
		setRecipes((prev) =>
			prev.map((r) =>
				r.recipe.id === recipeId
					? {
							...r,
							recipe: {
								...r.recipe,
								status:
									r.recipe.status === 'want_to_cook'
										? 'cooked_liked'
										: 'want_to_cook',
							},
						}
					: r,
			),
		);
	}, []);

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

	// В файле useRecipeStore.ts
	// В файле useRecipeStore.ts
	const addShoppingItem = useCallback((name: string) => {
		setShoppingList((prev) => [
			...prev,
			{
				// Используем crypto.randomUUID() для гарантированно уникальных ключей
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
			// fallback to russian
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
			// Simulate voice recognition with visual feedback
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
		// Simulate TTS - in real app would use Web Speech API
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
