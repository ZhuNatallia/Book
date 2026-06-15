export interface Recipe {
  id: string;
  category: string;
  status: 'want_to_cook' | 'cooked_liked';
  imageUrl?: string;
  sourceUrl?: string;
  servings: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeTranslation {
  id: string;
  recipeId: string;
  language: 'ru' | 'en' | 'de';
  title: string;
  description?: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  quantity: number;
  unit: string;
  originalText?: string;
  name?: string;
}

export interface IngredientTranslation {
  id: string;
  ingredientId: string;
  language: 'ru' | 'en' | 'de';
  name: string;
}

export interface RecipeStep {
  id: string;
  recipeId: string;
  stepOrder: number;
  timerMinutes?: number;
  instruction?: string;
}

export interface StepTranslation {
  id: string;
  stepId: string;
  language: 'ru' | 'en' | 'de';
  instruction: string;
}

export interface ShoppingItem {
  id: string;
  ingredientName: string;
  quantity?: number;
  unit?: string;
  recipeId?: string;
  checked: boolean;
}

export interface GroceryStore {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface GroceryDiscount {
  id: string;
  storeId: string;
  store?: GroceryStore;
  ingredientKeyword: string;
  discountPercentage: number;
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
  language: string;
}

export interface FullRecipe {
  recipe: Recipe;
  translations: RecipeTranslation[];
  ingredients: (RecipeIngredient & { translations: IngredientTranslation[] })[];
  steps: (RecipeStep & { translations: StepTranslation[] })[];
}

export type ViewMode = 'recipes' | 'shopping' | 'utilities' | 'add';

export type Language = 'ru' | 'en' | 'de';

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
