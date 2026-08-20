import { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { ShoppingItem } from '../types';
import {
	Trash2,
	Copy,
	Plus,
	Mic,
	MessageCircle,
	Send,
	Share2,
	Check,
} from 'lucide-react';
import { AISLE_IDS, AISLE_I18N_KEYS, aisleForName } from '../data/aisles';

const SPEECH_LOCALES: Record<string, string> = {
	ru: 'ru-RU',
	en: 'en-US',
	de: 'de-DE',
	uk: 'uk-UA',
	pl: 'pl-PL',
	it: 'it-IT',
	es: 'es-ES',
	fr: 'fr-FR',
};

const UNIT_KEYS = ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp', 'cup'];

interface ShoppingListViewProps {
	items: ShoppingItem[];
	onToggle: (id: string) => void;
	onRemove: (id: string) => void;
	onClear: () => void;
	onAdd: (name: string) => void;
}

function parseVoiceText(text: string): string[] {
	const hasExplicitSeparator =
		/[;,]|\s+и\s+|\s+and\s+|\+|\s+плюс\s+|\s+plus\s+/.test(text);

	if (hasExplicitSeparator) {
		return text
			.split(/[;,]|\s+и\s+|\s+and\s+|\+|\s+плюс\s+|\s+plus\s+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	return [text.trim()].filter(Boolean);
}

export function ShoppingListView({
	items,
	onToggle,
	onRemove,
	onClear,
	onAdd,
}: ShoppingListViewProps) {
	const { language, t } = useLanguage();
	const { theme } = useTheme();
	const [newItem, setNewItem] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [copied, setCopied] = useState(false);

	const grouped = useMemo(() => {
		const buckets = new Map<string, ShoppingItem[]>();
		for (const id of AISLE_IDS) buckets.set(id, []);
		for (const item of items) {
			const aisle = aisleForName(item.ingredientName);
			buckets.get(aisle)?.push(item);
		}
		return AISLE_IDS.map((id) => ({ id, items: buckets.get(id) ?? [] })).filter(
			(group) => group.items.length > 0,
		);
	}, [items]);

	const handleVoiceInput = () => {
		const SpeechRecognition =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;

		if (!SpeechRecognition) {
			alert(t('voiceUnsupported'));
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.lang = SPEECH_LOCALES[language] ?? 'en-US';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onstart = () => setIsRecording(true);
		recognition.onend = () => setIsRecording(false);

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript.trim();
			parseVoiceText(transcript).forEach((product) => onAdd(product));
		};

		recognition.onerror = (event: any) => {
			setIsRecording(false);
			console.error('Speech recognition error:', event.error);
		};

		recognition.start();
	};

	const formatUnit = (unit?: string) => {
		if (!unit) return '';
		const u = unit.toLowerCase().trim();
		return UNIT_KEYS.includes(u) ? t(u) : unit;
	};

	const itemLabel = (item: ShoppingItem) => {
		const qty =
			item.quantity != null && item.quantity !== 0
				? ` — ${item.quantity}${item.unit ? ` ${formatUnit(item.unit)}` : ''}`
				: '';
		return `${item.ingredientName}${qty}`;
	};

	const generateExportText = () => {
		const header = `🛒 ${t('shoppingList')}:`;
		const lines = grouped.flatMap((group) => [
			`${t(AISLE_I18N_KEYS[group.id])}:`,
			...group.items.map((item, i) => `${i + 1}. ${itemLabel(item)}`),
			'',
		]);
		return `${header}\n\n${lines.join('\n')}`.trim();
	};

	let runningIndex = 0;

	return (
		<div className='max-w-md mx-auto p-4 space-y-4'>
			<div className={`${theme.card} p-4`}>
				<div className='flex items-center gap-2'>
					<input
						value={newItem}
						onChange={(e) => setNewItem(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && newItem.trim()) {
								onAdd(newItem.trim());
								setNewItem('');
							}
						}}
						className={`flex-1 p-2.5 text-base ${theme.input}`}
						placeholder={t('addItemPlaceholder')}
					/>
					<button
						onClick={handleVoiceInput}
						className={`p-2 rounded-full transition-colors ${
							isRecording
								? 'bg-red-500 text-white animate-pulse'
								: 'bg-gray-200 hover:bg-gray-300'
						}`}
						title={t('voiceInput')}
					>
						<Mic className='w-5 h-5' />
					</button>
					<button
						onClick={() => {
							if (newItem.trim()) {
								onAdd(newItem.trim());
								setNewItem('');
							}
						}}
						className={`p-2 ${theme.iconBtn}`}
					>
						<Plus className='w-5 h-5' />
					</button>
				</div>
			</div>

			{items.length > 0 && (
				<div className='space-y-2'>
					<button
						onClick={() => {
							navigator.clipboard.writeText(generateExportText());
							setCopied(true);
							setTimeout(() => setCopied(false), 2000);
						}}
						className='w-full py-2 bg-gray-100 rounded-lg flex items-center justify-center gap-2 text-sm hover:bg-gray-200 transition-colors'
					>
						<Copy className='w-4 h-4' />
						{copied ? t('copied') : t('copyList')}
					</button>

					<div className='grid grid-cols-4 gap-2'>
						<button
							onClick={() =>
								window.open(
									`https://t.me/share/url?url=${encodeURIComponent(generateExportText())}`,
								)
							}
							className='p-2 flex justify-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
							title='Telegram'
						>
							<Send size={18} />
						</button>
						<button
							onClick={() =>
								window.open(
									`https://api.whatsapp.com/send?text=${encodeURIComponent(generateExportText())}`,
								)
							}
							className='p-2 flex justify-center bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors'
							title='WhatsApp'
						>
							<MessageCircle size={18} />
						</button>
						<button
							onClick={() =>
								window.open(
									`viber://forward?text=${encodeURIComponent(generateExportText())}`,
								)
							}
							className='p-2 flex justify-center bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors'
							title='Viber'
						>
							<Share2 size={18} />
						</button>
						<button
							onClick={async () => {
								if (navigator.share) {
									await navigator.share({
										title: t('shareListTitle'),
										text: generateExportText(),
									});
								}
							}}
							className='p-2 flex justify-center bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors'
							title='Facebook'
						>
							<MessageCircle size={18} />
						</button>
					</div>
				</div>
			)}

			{grouped.map((group) => (
				<div key={group.id} className="space-y-2">
					<p className={`text-sm font-semibold px-1 ${theme.textSecondary}`}>
						{t(AISLE_I18N_KEYS[group.id])}
					</p>
					<ol className='space-y-2'>
						{group.items.map((item) => {
							runningIndex += 1;
							const index = runningIndex;
							return (
								<li
									key={item.id}
									className={`flex items-center justify-between px-4 py-3 ${theme.card} transition-all ${
										item.checked ? 'bg-green-50 border-green-200' : ''
									}`}
								>
									<div className='flex items-center gap-3 flex-1 min-w-0'>
										<button
											onClick={() => onToggle(item.id)}
											className={`w-8 h-8 shrink-0 rounded-md border-2 flex items-center justify-center font-bold text-sm transition-all ${
												item.checked
													? 'bg-green-500 border-green-500 text-white'
													: 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-500'
											}`}
										>
											{item.checked ? <Check className='w-4 h-4' /> : index}
										</button>
										<span
											className={`truncate text-base ${theme.textPrimary} ${item.checked ? 'line-through text-gray-400' : ''}`}
										>
											{itemLabel(item)}
										</span>
									</div>
									<div className='flex items-center gap-1 shrink-0 ml-2'>
										<button
											onClick={() => onRemove(item.id)}
											className='p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors'
										>
											<Trash2 className='w-4 h-4' />
										</button>
									</div>
								</li>
							);
						})}
					</ol>
				</div>
			))}

			{items.length === 0 && (
				<div className={`text-center py-12 ${theme.textSecondary}`}>
					<p className='text-4xl mb-3'>🛒</p>
					<p>{t('listEmptyAddItems')}</p>
				</div>
			)}

			{items.length > 0 && (
				<button
					onClick={onClear}
					className='w-full py-2 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 transition-colors'
				>
					{t('clearAll')}
				</button>
			)}
		</div>
	);
}
