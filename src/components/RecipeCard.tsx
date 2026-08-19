import type { ReactNode } from 'react';
import { FullRecipe } from '../types';
import { RECIPE_CATEGORIES } from '../data/categories';
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
	Pencil,
	UtensilsCrossed,
	Eye,
	EyeOff,
	BookmarkPlus,
} from 'lucide-react';

interface RecipeCardProps {
	recipe: FullRecipe;
	onEdit: () => void;
	onDelete: () => void;
	onView: () => void;
	onToggleStatus: () => void;
	onToggleVisibility?: () => void;
	onCopy?: () => void;
	isOwner?: boolean;
}

export function RecipeCard({
	recipe,
	onEdit,
	onDelete,
	onView,
	onToggleStatus,
	onToggleVisibility,
	onCopy,
	isOwner = true,
}: RecipeCardProps) {
	const r = recipe.recipe as any;
	const { language, t, tCategory } = useLanguage();
	const { theme } = useTheme();

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

	return (
		<div
			className={`group relative flex flex-col h-full ${theme.card} overflow-hidden`}
		>
			<div className='relative aspect-[4/3] shrink-0 overflow-hidden'>
				{recipe.recipe.imageUrl ? (
					<img
						src={recipe.recipe.imageUrl}
						alt={translation.title}
						referrerPolicy='no-referrer'
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
							{t('noPhoto')}
						</p>
					</div>
				)}

				<div className='absolute top-3 left-3 flex items-center gap-2 z-10'>
					{isOwner && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleStatus();
							}}
							className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-200 ${
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
					)}
					{isOwner && !recipe.recipe.id.startsWith('sample-') && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleVisibility?.();
							}}
							title={
								recipe.recipe.visibleToFriends
									? t('visibleToFriends')
									: t('hiddenFromFriends')
							}
							className={`p-2 rounded-full backdrop-blur-md border shadow-sm transition-all duration-200 ${
								recipe.recipe.visibleToFriends
									? 'bg-white/90 text-emerald-600 border-emerald-200 hover:bg-emerald-50'
									: 'bg-white/90 text-gray-500 border-white/60 hover:bg-gray-100'
							}`}
						>
							{recipe.recipe.visibleToFriends ? (
								<Eye className='w-4 h-4' />
							) : (
								<EyeOff className='w-4 h-4' />
							)}
						</button>
					)}
				</div>

				<div className='absolute bottom-3 left-3 flex items-center gap-1 text-[10px] font-bold text-zinc-800 flex-wrap z-10'>
					<div className='flex items-center gap-0.5 bg-orange-500 text-white px-1.5 py-0.5 rounded-md shadow-sm'>
						<Flame className='w-3 h-3' />
						<span>
							{r.calories || r.caloriesPerServing}{' '}
							{t('kcal')}
						</span>
					</div>
					{r.protein && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{`${t('proteinShort')}: ${r.protein}${t('g')}`}
						</span>
					)}
					{r.fat && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{`${t('fatShort')}: ${r.fat}${t('g')}`}
						</span>
					)}
					{r.carbs && (
						<span className='bg-white/95 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-200/50'>
							{`${t('carbsShort')}: ${r.carbs}${t('g')}`}
						</span>
					)}
				</div>

				{isOwner && (
				<div className='absolute top-3 right-3 flex gap-2 z-10'>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onEdit();
						}}
						title={t('edit')}
						className='p-2 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-md hover:bg-white transition-colors'
					>
						<Pencil className='w-4 h-4 text-gray-700' />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (window.confirm(t('deleteConfirm'))) onDelete();
						}}
						title={t('delete')}
						className='p-2 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-md hover:bg-rose-100 transition-colors'
					>
						<Trash2 className='w-4 h-4 text-rose-500' />
					</button>
				</div>
				)}

				{!isOwner && onCopy && (
				<div className='absolute top-3 right-3 z-10'>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onCopy();
						}}
						title={t('saveToMyBook')}
						className='p-2 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-md hover:bg-white transition-colors'
					>
						<BookmarkPlus className='w-4 h-4 text-gray-700' />
					</button>
				</div>
				)}

				<div className='absolute bottom-3 right-3 px-2.5 py-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 z-10'>
					{tCategory(recipe.recipe.category)}
				</div>
			</div>

			<div className='p-4 flex flex-col flex-1'>
				<h3
					className={`font-bold text-lg ${theme.textPrimary} mb-1 line-clamp-1`}
				>
					{translation.title}
				</h3>
				{/* Always two lines tall, so cards in a row keep their buttons on one level */}
				<p
					className={`text-base ${theme.textSecondary} line-clamp-2 min-h-[3rem] mb-3`}
				>
					{translation.description || '\u00A0'}
				</p>

				<div className='flex items-center justify-between mt-auto pt-2 border-t border-gray-50 dark:border-zinc-800/50'>
					<div
						className={`flex items-center gap-3 text-sm ${theme.textSecondary}`}
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
					className={`mt-4 w-full py-2.5 px-4 ${theme.btnPrimary} font-semibold text-base`}
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
	className?: string;
}

export function CategoryFilter({
	selectedCategory,
	onSelectCategory,
	className = 'w-full px-4 mb-4',
}: CategoryFilterProps) {
	const { t, tCategory } = useLanguage();
	const { theme } = useTheme();

	const categories: { id: string; label: ReactNode }[] = [
		{ id: 'all', label: t('all') },
		...RECIPE_CATEGORIES.map((id) => ({ id, label: tCategory(id) })),
	];

	return (
		<div className={className}>
			<div className='flex flex-wrap gap-2 justify-center'>
				{categories.map((cat) => (
					<button
						key={cat.id}
						onClick={() => onSelectCategory(cat.id)}
						className={`px-4 py-2.5 text-base font-medium whitespace-nowrap capitalize flex items-center justify-center ${
							selectedCategory === cat.id ? theme.chipActive : theme.chip
						}`}
					>
						{cat.label}
					</button>
				))}
			</div>
		</div>
	);
}
