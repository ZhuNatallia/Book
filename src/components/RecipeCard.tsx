import { FullRecipe } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import {
	Clock,
	User,
	ExternalLink,
	Heart,
	Flame,
	ChefHat,
	Trash2,
	Edit2,
	UtensilsCrossed,
	Home,
} from 'lucide-react';

interface RecipeCardProps {
	recipe: FullRecipe;
	onEdit: () => void;
	onDelete: () => void;
	onView: () => void;
	onToggleStatus: () => void;
}

export function RecipeCard({
	recipe,
	onEdit,
	onDelete,
	onView,
	onToggleStatus,
}: RecipeCardProps) {
	const r = recipe.recipe as any;
	const { language, t, tCategory } = useLanguage();
	const { theme } = useTheme();

	const translation =
		recipe.translations.find((tr) => tr.language === language) ||
		recipe.translations.find((tr) => tr.language === 'ru')!;

	if (r && !r.caloriesPerServing && !r.calories) {
		r.calories = 420;
		r.protein = 25;
		r.fat = 12;
		r.carbs = 45;
	}

	return (
		<div
			className={`group relative ${theme.bgCard} rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border ${theme.border}`}
		>
			<div className='relative aspect-[4/3] overflow-hidden'>
				{recipe.recipe.imageUrl ? (
					<img
						src={recipe.recipe.imageUrl}
						alt={translation.title}
						className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
					/>
				) : (
					<div
						className={`w-full h-full ${theme.bgPrimary} flex flex-col items-center justify-center relative`}
					>
						<div className='absolute top-4 right-4 w-12 h-12 bg-orange-200/50 rounded-full' />
						<div className='absolute bottom-6 left-6 w-8 h-8 bg-rose-200/50 rounded-full' />
						<div className='absolute top-1/3 left-1/4 w-6 h-6 bg-amber-200/40 rounded-full' />

						<div className='relative'>
							{recipe.recipe.category === 'pastry' ||
							recipe.recipe.category === 'dessert' ? (
								<div className='w-20 h-20 bg-gradient-to-br from-amber-200 to-orange-200 rounded-2xl flex items-center justify-center shadow-sm transform rotate-3'>
									<ChefHat className='w-10 h-10 text-amber-600' />
								</div>
							) : recipe.recipe.category === 'soup' ? (
								<div className='w-20 h-20 bg-gradient-to-br from-rose-200 to-orange-200 rounded-2xl flex items-center justify-center shadow-sm'>
									<UtensilsCrossed className='w-10 h-10 text-rose-600' />
								</div>
							) : (
								<div className='w-20 h-20 bg-gradient-to-br from-orange-200 to-amber-200 rounded-2xl flex items-center justify-center shadow-sm transform -rotate-2'>
									<ChefHat className='w-10 h-10 text-orange-600' />
								</div>
							)}
						</div>

						<p className={`mt-3 text-xs ${theme.textSecondary} font-medium`}>
							{language === 'ru'
								? 'Нет фото'
								: language === 'de'
									? 'Kein Foto'
									: 'No photo'}
						</p>
					</div>
				)}

				<button
					onClick={(e) => {
						e.stopPropagation();
						onToggleStatus();
					}}
					className={`absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-200 ${
						recipe.recipe.status === 'cooked_liked'
							? 'bg-green-500/80 text-white border-green-400 hover:bg-green-600'
							: 'bg-amber-500/80 text-white border-amber-400 hover:bg-amber-600'
					}`}
				>
					{recipe.recipe.status === 'cooked_liked' ? (
						<span className='flex items-center gap-1'>
							<Heart className='w-3 h-3 fill-current' />
							{t('cookedLiked')}
						</span>
					) : (
						<span className='flex items-center gap-1'>
							<Clock className='w-3 h-3' />
							{t('wantToCook')}
						</span>
					)}
				</button>

				<div className='absolute bottom-3 left-3 flex items-center gap-1 text-[10px] font-bold text-zinc-800 flex-wrap z-10'>
					<div className='flex items-center gap-0.5 bg-orange-500 text-white px-1.5 py-0.5 rounded-md shadow-sm'>
						<Flame className='w-3 h-3' />
						<span>
							{r.calories || r.caloriesPerServing}{' '}
							{language === 'ru' ? 'ккал' : 'kcal'}
						</span>
					</div>
					{r.protein && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{language === 'ru' ? `Б: ${r.protein}г` : `E: ${r.protein}g`}
						</span>
					)}
					{r.fat && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{language === 'ru' ? `Ж: ${r.fat}г` : `F: ${r.fat}g`}
						</span>
					)}
					{r.carbs && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{language === 'ru' ? `У: ${r.carbs}г` : `KH: ${r.carbs}g`}
						</span>
					)}
				</div>

				<div className='absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10'>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onEdit();
						}}
						className={`p-2 ${theme.bgCard}/90 rounded-full shadow-md hover:bg-white transition-colors`}
					>
						<Edit2 className='w-4 h-4 text-gray-700' />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (window.confirm(t('deleteConfirm'))) onDelete();
						}}
						className='p-2 bg-white/90 rounded-full shadow-md hover:bg-rose-100 transition-colors'
					>
						<Trash2 className='w-4 h-4 text-rose-500' />
					</button>
				</div>

				<div className='absolute bottom-3 right-3 px-2.5 py-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 z-10'>
					{tCategory(recipe.recipe.category)}
				</div>
			</div>

			<div className='p-4 flex flex-col flex-grow'>
				<h3
					className={`font-bold text-lg ${theme.textPrimary} mb-1 line-clamp-1`}
				>
					{translation.title}
				</h3>
				{translation.description && (
					<p
						className={`text-sm ${theme.textSecondary} line-clamp-2 mb-3 flex-grow`}
					>
						{translation.description}
					</p>
				)}

				<div className='flex items-center justify-between mt-auto pt-2 border-t border-gray-50 dark:border-zinc-800/50'>
					<div
						className={`flex items-center gap-3 text-xs ${theme.textSecondary}`}
					>
						<span className='flex items-center gap-1'>
							<User className='w-3.5 h-3.5' />
							{recipe.recipe.servings} {t('portions')}
						</span>
					</div>

					{recipe.recipe.sourceUrl && (
						<a
							href={recipe.recipe.sourceUrl}
							target='_blank'
							rel='noopener noreferrer'
							onClick={(e) => e.stopPropagation()}
							className='flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors'
						>
							{t('source')}
							<ExternalLink className='w-3 h-3' />
						</a>
					)}
				</div>

				<button
					onClick={onView}
					className={`mt-4 w-full py-2.5 px-4 bg-gradient-to-r ${theme.catFilterActive} text-white font-semibold rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] text-sm`}
				>
					{t('viewRecipe')}
				</button>
			</div>
		</div>
	);
}

interface CategoryFilterProps {
	selectedCategory: string;
	onSelectCategory: (category: string) => void;
}

export function CategoryFilter({
	selectedCategory,
	onSelectCategory,
}: CategoryFilterProps) {
	const { tCategory } = useLanguage();
	const { theme } = useTheme();

	const categories = [
		{ id: 'all', label: <Home className='w-4 h-4' /> },
		{ id: 'meat', label: tCategory('meat') },
		{ id: 'fish', label: tCategory('fish') },
		{ id: 'vegetables', label: tCategory('vegetables') },
		{ id: 'pastry', label: tCategory('pastry') },
		{ id: 'dessert', label: tCategory('dessert') },
		{ id: 'soup', label: tCategory('soup') },
		{ id: 'salad', label: tCategory('salad') },
		{ id: 'healthy', label: tCategory('healthy') },
		{ id: 'preserves', label: tCategory('preserves') },
		{ id: 'other', label: tCategory('other') },
	];

	return (
		<div className='w-full px-4 mb-4'>
			<div className='flex flex-wrap gap-2 justify-center'>
				{categories.map((cat) => (
					<button
						key={cat.id}
						onClick={() => onSelectCategory(cat.id)}
						className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 capitalize flex items-center justify-center ${
							selectedCategory === cat.id
								? `bg-gradient-to-r ${theme.catFilterActive} text-white shadow-md`
								: theme.catFilterInactive
						}`}
					>
						{cat.label}
					</button>
				))}
			</div>
		</div>
	);
}
