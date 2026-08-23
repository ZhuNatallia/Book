import { useState, useMemo, useEffect, useRef } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ThemeProvider, useTheme } from './i18n/ThemeContext';
import { AuthProvider, useAuth } from './i18n/AuthContext';
import { PlanProvider, usePlan, ownRecipeCount } from './i18n/PlanContext';
import { Header, BottomNav, BottomNavView } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { AuthScreen } from './components/AuthScreen';
import { supabase } from './lib/supabase';
import { RecipeCard } from './components/RecipeCard';
import { RecipeFilterBar, RecipeStatusFilter } from './components/RecipeFilterBar';
import { AddRecipeModal } from './components/AddRecipeModal';
import { RecipeDetail } from './components/RecipeDetail';
import { ShoppingListView } from './components/ShoppingListView';
import { MeasurementConverterView } from './components/MeasurementConverterView';
import { FridgeSearchView } from './components/FridgeSearchView';
import { FriendsView } from './components/FriendsView';
import { MealPlanView } from './components/MealPlanView';
import { useRecipeStore } from './hooks/useRecipeStore';
import { FullRecipe, RecipeSort } from './types';
import { useOnline } from './lib/online';
import { isPresetShelf } from './data/shelves';
import { recipeMatchesQuery } from './lib/recipeSearch';
import { remainingShoppingItems } from './lib/ingredientMerge';
import { ChefHat } from 'lucide-react';

type AppView = BottomNavView;

function AppContent() {
	const { t, language } = useLanguage();
	const { theme } = useTheme();
	const { session, loading: authLoading } = useAuth();
	const { canAddRecipe, syncRecipeCount, giftNotice, redeemPendingGift } = usePlan();
	const online = useOnline();
	const [welcomeDone, setWelcomeDone] = useState(false);
	const hadSession = useRef(false);

	useEffect(() => {
		if (hadSession.current && !session) {
			setWelcomeDone(false);
		}
		hadSession.current = Boolean(session);
	}, [session]);

	useEffect(() => {
		if (!session || !online) return;
		void redeemPendingGift();
	}, [session, online, redeemPendingGift]);

	const handleSignOut = async () => {
		await supabase.auth.signOut();
	};

	const {
		recipes,
		shoppingList,
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
		pantry,
		addPantryItem,
		removePantryItem,
		mealPlan,
		saveMealPlan,
		toggleInMenu,
		syncing,
	} = useRecipeStore(session?.user.id);

	useEffect(() => {
		syncRecipeCount(ownRecipeCount(recipes));
	}, [recipes, syncRecipeCount]);

	const [activeView, setActiveView] = useState<AppView>('recipes');
	const [showFridge, setShowFridge] = useState(false);
	const [selectedRecipe, setSelectedRecipe] = useState<FullRecipe | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('all');
	const [statusFilter, setStatusFilter] = useState<RecipeStatusFilter>('all');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState<RecipeSort>('newest');
	const [editingRecipe, setEditingRecipe] = useState<FullRecipe | null>(null);
	const [headerCompact, setHeaderCompact] = useState(false);
	const [openSettingsTo, setOpenSettingsTo] = useState<'plan' | null>(null);
	const filterBarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!giftNotice) return;
		if (giftNotice.status === 'ok' || giftNotice.status === 'already' || giftNotice.status === 'already_plus') {
			setOpenSettingsTo('plan');
		}
	}, [giftNotice]);

	useEffect(() => {
		if (activeView !== 'recipes' || showFridge) {
			setHeaderCompact(false);
			return;
		}
		const el = filterBarRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => setHeaderCompact(!entry.isIntersecting),
			{ threshold: 0, rootMargin: '-72px 0px 0px 0px' },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [activeView, showFridge]);

	const filteredRecipes = useMemo(() => {
		let filtered = [...recipes];

		if (selectedCategory !== 'all') {
			filtered = filtered.filter((r) => r.recipe.category === selectedCategory);
		}

		if (statusFilter !== 'all') {
			filtered = filtered.filter((r) => r.recipe.status === statusFilter);
		}

		if (searchQuery.trim()) {
			filtered = filtered.filter((r) => recipeMatchesQuery(r, searchQuery));
		}

		if (selectedTags.length > 0) {
			filtered = filtered.filter((r) =>
				selectedTags.some((tag) => (r.recipe.tags || []).includes(tag)),
			);
		}

		filtered.sort((a, b) => {
			if (sortBy === 'title') {
				const ta = a.translations.find((tr) => tr.language === language)?.title
					|| a.translations[0]?.title
					|| '';
				const tb = b.translations.find((tr) => tr.language === language)?.title
					|| b.translations[0]?.title
					|| '';
				return ta.localeCompare(tb, language);
			}
			if (sortBy === 'lastCooked') {
				const aa = a.recipe.lastCookedAt || '';
				const bb = b.recipe.lastCookedAt || '';
				if (!aa && !bb) return 0;
				if (!aa) return 1;
				if (!bb) return -1;
				return bb.localeCompare(aa);
			}
			return (b.recipe.createdAt || '').localeCompare(a.recipe.createdAt || '');
		});

		return filtered;
	}, [recipes, selectedCategory, statusFilter, searchQuery, selectedTags, sortBy, language]);

	const extraTags = useMemo(() => {
		const set = new Set<string>();
		for (const r of recipes) {
			for (const tag of r.recipe.tags || []) {
				if (!isPresetShelf(tag)) set.add(tag);
			}
		}
		return [...set];
	}, [recipes]);

	const displayShopping = useMemo(
		() => remainingShoppingItems(shoppingList, pantry),
		[shoppingList, pantry],
	);

	useEffect(() => {
		if (!selectedRecipe) return;
		const fresh = recipes.find((r) => r.recipe.id === selectedRecipe.recipe.id);
		if (fresh && fresh !== selectedRecipe) setSelectedRecipe(fresh);
	}, [recipes, selectedRecipe]);

	if (authLoading) {
		return (
			<div className={`min-h-screen flex items-center justify-center ${theme.bgPrimary}`}>
				<div className={`w-12 h-12 bg-gradient-to-br ${theme.headerLogoGradient} rounded-xl flex items-center justify-center shadow-lg animate-pulse`}>
					<ChefHat className="w-7 h-7 text-white" />
				</div>
			</div>
		);
	}

	if (!session) {
		if (!welcomeDone) {
			return <Onboarding onComplete={() => setWelcomeDone(true)} />;
		}
		return <AuthScreen />;
	}

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
			if (!canAddRecipe) {
				setOpenSettingsTo('plan');
				return;
			}
			addRecipe(recipe);
		}
		setEditingRecipe(null);
	};

	const openAddModal = () => {
		setShowAddModal(true);
		setEditingRecipe(null);
	};

	const openPlanSettings = () => {
		setShowAddModal(false);
		setOpenSettingsTo('plan');
	};

	const handleCopyRecipe = (recipe: FullRecipe) => {
		if (!canAddRecipe) {
			openPlanSettings();
			return false;
		}
		void copyRecipe(recipe, language);
		return true;
	};

	return (
		<div className={`min-h-screen ${theme.bgPrimary}`}>
			<Header
				onAddRecipe={openAddModal}
				onSignOut={handleSignOut}
				onGoHome={() => {
					setShowFridge(false);
					setShowAddModal(false);
					setSelectedRecipe(null);
					setActiveView('recipes');
					setSelectedCategory('all');
					setStatusFilter('all');
					setSearchQuery('');
					setSelectedTags([]);
				}}
				compact={headerCompact && activeView === 'recipes' && !showFridge}
				userId={session.user.id}
				email={session.user.email}
				online={online}
				syncing={syncing}
				openSettingsTo={openSettingsTo}
				onOpenSettingsConsumed={() => setOpenSettingsTo(null)}
				recipes={recipes}
			/>

			<main className='max-w-7xl mx-auto pb-24 pt-4'>
				{showFridge && (
					<FridgeSearchView
						recipes={recipes}
						pantry={pantry}
						onAddPantry={(name) => addPantryItem(name)}
						onRemovePantry={removePantryItem}
						onOpenRecipe={handleOpenRecipe}
						onClose={() => setShowFridge(false)}
					/>
				)}

				{!showFridge && activeView === 'recipes' && (
					<>
						<div
							ref={filterBarRef}
							className={`sticky z-40 pb-1 ${theme.bgPrimary} ${
								headerCompact ? 'top-14' : 'top-[72px]'
							}`}
						>
							<RecipeFilterBar
								selectedCategory={selectedCategory}
								onSelectCategory={setSelectedCategory}
								statusFilter={statusFilter}
								onSelectStatus={setStatusFilter}
								searchQuery={searchQuery}
								onSearchChange={setSearchQuery}
								onFridgeSearch={() => setShowFridge(true)}
								extraTags={extraTags}
								selectedTags={selectedTags}
								onSelectTags={setSelectedTags}
								sortBy={sortBy}
								onSortChange={setSortBy}
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
										onToggleVisibility={() => toggleVisibility(recipe.recipe.id)}
										onToggleMenu={
											recipe.recipe.id.startsWith('sample-')
												? undefined
												: () => toggleInMenu(recipe.recipe.id)
										}
										inMenu={mealPlan.entries.some((e) => e.recipeId === recipe.recipe.id)}
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
									{recipes.length > 0 ? t('noMatchingRecipes') : t('noRecipes')}
								</p>
								{recipes.length === 0 && (
								<button
									onClick={openAddModal}
									className={`mt-4 px-6 py-2 ${theme.btnPrimary} font-medium`}
								>
									{t('addRecipe')}
								</button>
								)}
							</div>
						)}
					</>
				)}

				{!showFridge && activeView === 'shopping' && (
					// В App.tsx, внутри блока activeView === 'shopping'
					<ShoppingListView
						items={displayShopping}
						onToggle={toggleShoppingItem}
						onRemove={removeFromShoppingList}
						onClear={clearShoppingList}
						onAdd={(name: string) => addShoppingItem(name)}
					/>
				)}

				{!showFridge && activeView === 'menu' && (
					<MealPlanView
						recipes={recipes}
						mealPlan={mealPlan}
						onChange={saveMealPlan}
						onSendToShopping={(items) => {
							items.forEach((item) => addToShoppingList(item.name, item.quantity, item.unit));
							setActiveView('shopping');
						}}
					/>
				)}

				{!showFridge && activeView === 'converter' && (
					<MeasurementConverterView />
				)}

				{!showFridge && activeView === 'friends' && session && (
					online ? (
					<FriendsView
						currentUserId={session.user.id}
						onOpenRecipe={handleOpenRecipe}
						onCopyRecipe={handleCopyRecipe}
					/>
					) : (
						<p className={`text-center py-12 ${theme.textSecondary}`}>{t('offlineHint')}</p>
					)
				)}
			</main>

			<BottomNav
				activeView={activeView}
				onViewChange={(view) => {
					setShowFridge(false);
					setActiveView(view);
				}}
			/>

			{selectedRecipe && (
				<RecipeDetail
					recipe={selectedRecipe}
					readOnly={
						!!selectedRecipe.recipe.userId &&
						selectedRecipe.recipe.userId !== session.user.id
					}
					onClose={handleCloseRecipe}
					onEdit={handleEditRecipe}
					onDelete={() => {
						deleteRecipe(selectedRecipe.recipe.id);
						handleCloseRecipe();
					}}
					onAddToShoppingList={handleAddToShoppingList}
					onUpdate={updateRecipe}
					extraTags={extraTags}
					onCopy={
						selectedRecipe.recipe.userId &&
						selectedRecipe.recipe.userId !== session.user.id
							? () => handleCopyRecipe(selectedRecipe)
							: undefined
					}
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
				extraTags={extraTags}
				existingRecipes={recipes}
				onOpenExisting={(recipe) => {
					setShowAddModal(false);
					setEditingRecipe(null);
					setSelectedRecipe(recipe);
				}}
				onNeedPlan={openPlanSettings}
			/>
		</div>
	);
}

function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<LanguageProvider>
					<AppWithPlan />
				</LanguageProvider>
			</AuthProvider>
		</ThemeProvider>
	);
}

function AppWithPlan() {
	const { session } = useAuth();
	return (
		<PlanProvider userId={session?.user.id}>
			<AppContent />
		</PlanProvider>
	);
}

export default App;
