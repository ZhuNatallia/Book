import { useState } from 'react';
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
} from 'lucide-react';

interface ShoppingListViewProps {
	items: ShoppingItem[];
	onToggle: (id: string) => void;
	onRemove: (id: string) => void;
	onClear: () => void;
	onAdd: (name: string) => void;
}

// Парсит строку из голосового ввода в список отдельных продуктов.
// Если есть явные разделители (запятая, "и", "+", etc.) — бьёт по ним.
// Если разделителей нет — каждое слово считается отдельным продуктом.
function parseVoiceText(text: string): string[] {
	const hasExplicitSeparator =
		/[;,]|\s+и\s+|\s+and\s+|\+|\s+плюс\s+|\s+plus\s+/.test(text);

	if (hasExplicitSeparator) {
		return text
			.split(/[;,]|\s+и\s+|\s+and\s+|\+|\s+плюс\s+|\s+plus\s+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	// Нет разделителей — каждое слово = отдельный продукт
	return text
		.split(/\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export function ShoppingListView({
	items,
	onToggle,
	onRemove,
	onClear,
	onAdd,
}: ShoppingListViewProps) {
	const { language } = useLanguage();
	const { theme } = useTheme();
	const [newItem, setNewItem] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleVoiceInput = () => {
		const SpeechRecognition =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;

		if (!SpeechRecognition) {
			alert(
				language === 'ru'
					? 'Голосовой ввод не поддерживается вашим браузером'
					: 'Voice input not supported in your browser',
			);
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;

		recognition.onstart = () => setIsRecording(true);
		recognition.onend = () => setIsRecording(false);

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript.trim();
			const parsed = parseVoiceText(transcript);
			// Каждый продукт добавляется отдельным вызовом — App создаёт уникальный ID
			parsed.forEach((product) => onAdd(product));
		};

		recognition.onerror = (event: any) => {
			setIsRecording(false);
			console.error('Speech recognition error:', event.error);
		};

		recognition.start();
	};

	const generateExportText = () => {
		const header =
			language === 'ru' ? '🛒 Список покупок:' : '🛒 Shopping List:';
		const lines = items.map((item, i) => `${i + 1}. ${item.name}`);
		return `${header}\n\n${lines.join('\n')}`;
	};

	return (
		<div className='max-w-md mx-auto p-4 space-y-4'>
			{/* Поле ввода */}
			<div className={`${theme.bgCard} p-4 rounded-xl border ${theme.border}`}>
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
						className={`flex-1 p-2 rounded-lg border ${theme.inputBg} ${theme.textPrimary}`}
						placeholder={
							language === 'ru' ? 'Добавить продукт...' : 'Add item...'
						}
					/>
					<button
						onClick={handleVoiceInput}
						className={`p-2 rounded-full transition-colors ${
							isRecording
								? 'bg-red-500 text-white animate-pulse'
								: 'bg-gray-200 hover:bg-gray-300'
						}`}
						title={language === 'ru' ? 'Голосовой ввод' : 'Voice input'}
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
						className={`p-2 rounded-lg ${theme.accentGradient}`}
					>
						<Plus className='w-5 h-5' />
					</button>
				</div>
			</div>

			{/* Кнопки шаринга */}
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
						{copied
							? language === 'ru'
								? 'Скопировано!'
								: 'Copied!'
							: language === 'ru'
								? 'Копировать список'
								: 'Copy list'}
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
							onClick={() => window.open('https://www.facebook.com/')}
							className='p-2 flex justify-center bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors'
							title='Facebook'
						>
							<MessageCircle size={18} />
						</button>
					</div>
				</div>
			)}

			{/* Нумерованный список */}
			<ol className='space-y-2'>
				{items.map((item, index) => (
					<li
						key={item.id}
						className={`flex items-center justify-between px-4 py-3 ${theme.bgCard} border ${theme.border} rounded-xl shadow-sm transition-all ${
							item.checked ? 'bg-green-50 border-green-200' : ''
						}`}
					>
						<div className='flex items-center gap-3 flex-1 min-w-0'>
							<span
								className={`text-sm font-bold w-6 shrink-0 ${item.checked ? 'text-green-500' : 'text-gray-400'}`}
							>
								{index + 1}.
							</span>
							<span
								className={`truncate ${theme.textPrimary} ${item.checked ? 'line-through text-gray-400' : ''}`}
							>
								{item.name}
							</span>
						</div>
						<div className='flex items-center gap-1 shrink-0 ml-2'>
							<button
								onClick={() => onToggle(item.id)}
								className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
									item.checked
										? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
										: 'bg-green-100 text-green-700 hover:bg-green-200'
								}`}
							>
								{item.checked
									? language === 'ru'
										? 'Готово'
										: 'Done'
									: language === 'ru'
										? 'Готово?'
										: 'Done?'}
							</button>
							<button
								onClick={() => onRemove(item.id)}
								className='p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors'
							>
								<Trash2 className='w-4 h-4' />
							</button>
						</div>
					</li>
				))}
			</ol>

			{items.length === 0 && (
				<div className={`text-center py-12 ${theme.textSecondary}`}>
					<p className='text-4xl mb-3'>🛒</p>
					<p>
						{language === 'ru'
							? 'Список пуст. Добавьте продукты!'
							: 'List is empty. Add some items!'}
					</p>
				</div>
			)}

			{items.length > 0 && (
				<button
					onClick={onClear}
					className='w-full py-2 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 transition-colors'
				>
					{language === 'ru' ? 'Очистить всё' : 'Clear all'}
				</button>
			)}
		</div>
	);
}
