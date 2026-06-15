import { useState, useMemo } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ThemeProvider, useTheme } from './i18n/ThemeContext';
import { Header, BottomNav } from './components/Header';
import { RecipeCard, CategoryFilter } from './components/RecipeCard';
import { AddRecipeModal } from './components/AddRecipeModal';
import { RecipeDetail } from './components/RecipeDetail';
import { ShoppingListView } from './components/ShoppingListView';
import { UtilitiesView } from './components/UtilitiesView';
import { useRecipeStore } from './hooks/useRecipeStore';
import { FullRecipe } from './types';
import { Search, ChefHat } from 'lucide-react';

type AppView = 'recipes' | 'shopping' | 'utilities';

function AppContent() {
	const { t } = useLanguage();
	const { theme } = useTheme();
	const {
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
	} = useRecipeStore();

	const [activeView, setActiveView] = useState<AppView>('recipes');
	const [selectedRecipe, setSelectedRecipe] = useState<FullRecipe | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('all');
	const [editingRecipe, setEditingRecipe] = useState<FullRecipe | null>(null);

	const filteredRecipes = useMemo(() => {
		let filtered = [...recipes];

		if (selectedCategory !== 'all') {
			filtered = filtered.filter((r) => r.recipe.category === selectedCategory);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((r) => {
				const hasMatch = r.translations.some(
					(t) =>
						t.title.toLowerCase().includes(query) ||
						t.description?.toLowerCase().includes(query),
				);
				return hasMatch;
			});
		}

		return filtered;
	}, [recipes, selectedCategory, searchQuery]);

	const handleOpenRecipe = (recipe: FullRecipe) => {
		setSelectedRecipe(recipe);
	};

	const handleCloseRecipe = () => {
		setSelectedRecipe(null);
		setEditingRecipe(null);
	};

	const handleEditRecipe = () => {
		setEditingRecipe(selectedRecipe);
		setSelectedRecipe(null);
		setShowAddModal(true);
	};

	const handleAddToShoppingList = (name: string, qty: number, unit: string) => {
		addToShoppingList(name, qty, unit, selectedRecipe?.recipe.id);
	};

	const handleSaveRecipe = (recipe: FullRecipe) => {
		if (editingRecipe) {
			updateRecipe(recipe);
		} else {
			addRecipe(recipe);
		}
		setEditingRecipe(null);
	};

	const openAddModal = () => {
		setShowAddModal(true);
		setEditingRecipe(null);
	};

	return (
		<div className={`min-h-screen ${theme.bgPrimary}`}>
			<Header onAddRecipe={openAddModal} />

			<main className='max-w-7xl mx-auto pb-24 pt-4'>
				{activeView === 'recipes' && (
					<>
						<div className='px-4 mb-4'>
							<div className='relative'>
								<Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder={t('searchPlaceholder')}
									className={`w-full pl-12 pr-4 py-3 ${theme.bgCard} rounded-xl border ${theme.border} focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-sm`}
								/>
							</div>
						</div>

						<div className='mb-4'>
							<CategoryFilter
								selectedCategory={selectedCategory}
								onSelectCategory={setSelectedCategory}
							/>
						</div>

						{filteredRecipes.length > 0 ? (
							<div className='px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
								{filteredRecipes.map((recipe) => (
									<RecipeCard
										key={recipe.recipe.id}
										recipe={recipe}
										onView={() => handleOpenRecipe(recipe)}
										onEdit={() => {
											setEditingRecipe(recipe);
											setShowAddModal(true);
										}}
										onDelete={() => deleteRecipe(recipe.recipe.id)}
										onToggleStatus={() => toggleRecipeStatus(recipe.recipe.id)}
									/>
								))}
							</div>
						) : (
							<div className='text-center py-12 px-4'>
								<div
									className={`w-20 h-20 mx-auto bg-gradient-to-br from-amber-100 to-rose-100 rounded-full flex items-center justify-center mb-4`}
								>
									<ChefHat className='w-10 h-10 text-amber-300' />
								</div>
								<p className={`${theme.textSecondary} text-lg`}>
									{t('noRecipes')}
								</p>
								<button
									onClick={openAddModal}
									className={`mt-4 px-6 py-2 ${theme.accentGradient} ${theme.accentHover} text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all`}
								>
									{t('addRecipe')}
								</button>
							</div>
						)}
					</>
				)}

				{activeView === 'shopping' && (
					// В App.tsx, внутри блока activeView === 'shopping'
					<ShoppingListView
						items={shoppingList}
						onToggle={toggleShoppingItem}
						onRemove={removeFromShoppingList}
						onClear={clearShoppingList}
						// Точечно меняем только эту строку:
						onAdd={(name: string) => {
							addShoppingItem({
								id: crypto.randomUUID(),
								name: name,
								checked: false,
							} as any);
						}}
					/>
				)}

				{activeView === 'utilities' && <UtilitiesView recipes={recipes} />}
			</main>

			<BottomNav activeView={activeView} onViewChange={setActiveView} />

			{selectedRecipe && (
				<RecipeDetail
					recipe={selectedRecipe}
					onClose={handleCloseRecipe}
					onEdit={handleEditRecipe}
					onDelete={() => {
						deleteRecipe(selectedRecipe.recipe.id);
						handleCloseRecipe();
					}}
					onAddToShoppingList={handleAddToShoppingList}
				/>
			)}

			<AddRecipeModal
				isOpen={showAddModal}
				onClose={() => {
					setShowAddModal(false);
					setEditingRecipe(null);
				}}
				onSave={handleSaveRecipe}
				editingRecipe={editingRecipe}
			/>
		</div>
	);
}

function App() {
	return (
		<ThemeProvider>
			<LanguageProvider>
				<AppContent />
			</LanguageProvider>
		</ThemeProvider>
	);
}

export default App;
