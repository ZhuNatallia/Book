export type Language = 'ru' | 'en' | 'de' | 'uk' | 'pl' | 'it' | 'es' | 'fr' | 'kk';

export interface Recipe {
  id: string;
  userId?: string;
  category: string;
  status: 'want_to_cook' | 'cooked_liked';
  imageUrl?: string;
  sourceUrl?: string;
  servings: number;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  visibleToFriends: boolean;
  notes?: string;
  lastCookedAt?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FriendProfile {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface RecipeTranslation {
  id: string;
  recipeId: string;
  language: Language;
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
  language: Language;
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
  language: Language;
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

export interface MealPlanEntry {
  id: string;
  recipeId: string;
  dayIndex: number | null;
  sortOrder: number;
}

export interface MealPlan {
  dayCount: number;
  entries: MealPlanEntry[];
}

export type ViewMode = 'recipes' | 'shopping' | 'menu' | 'utilities' | 'add';

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
