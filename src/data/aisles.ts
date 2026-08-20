import { stemIngredientName } from '../lib/ingredientMerge';

export const AISLE_IDS = [
  'dairy',
  'produce',
  'meat',
  'bakery',
  'frozen',
  'spices',
  'pantry',
  'other',
] as const;

export type AisleId = (typeof AISLE_IDS)[number];

const GROUPS: { id: Exclude<AisleId, 'other'>; words: string[] }[] = [
  {
    id: 'dairy',
    words: [
      'молоко', 'сливк', 'сметан', 'творог', 'йогурт', 'кефир', 'сыр', 'масло сливоч',
      'milk', 'cream', 'yogurt', 'yoghurt', 'cheese', 'butter', 'sour cream',
      'milch', 'sahne', 'joghurt', 'käse', 'butter',
    ],
  },
  {
    id: 'produce',
    words: [
      'помидор', 'томат', 'огурец', 'огурц', 'лук', 'чеснок', 'морков', 'картофел', 'капуст',
      'перец', 'салат', 'зелен', 'яблок', 'банан', 'лимон', 'апельсин', 'ягод', 'гриб',
      'tomato', 'cucumber', 'onion', 'garlic', 'carrot', 'potato', 'cabbage', 'pepper',
      'lettuce', 'apple', 'banana', 'lemon', 'orange', 'berry', 'mushroom', 'spinach',
      'zucchini', 'avocado', 'celery', 'beet', 'свекл', 'кабачок', 'баклажан',
    ],
  },
  {
    id: 'meat',
    words: [
      'курица', 'куриц', 'говядин', 'свинин', 'фарш', 'индейк', 'рыба', 'лосось', 'тунец',
      'кревет', 'мясо', 'бекон', 'колбас', 'ветчин',
      'chicken', 'beef', 'pork', 'mince', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp',
      'meat', 'bacon', 'sausage', 'ham', 'lamb',
    ],
  },
  {
    id: 'bakery',
    words: [
      'хлеб', 'батон', 'булк', 'лаваш', 'тесто', 'багет',
      'bread', 'bun', 'dough', 'baguette', 'tortilla', 'pita',
    ],
  },
  {
    id: 'frozen',
    words: [
      'заморож', 'мороженое', 'frozen', 'ice cream', 'tiefkühl',
    ],
  },
  {
    id: 'spices',
    words: [
      'соль', 'перец черн', 'паприк', 'куркум', 'кориц', 'ваниль', 'орегано', 'базилик',
      'укроп', 'петрушк', 'специ', 'приправ',
      'salt', 'pepper', 'paprika', 'turmeric', 'cinnamon', 'vanilla', 'oregano', 'basil',
      'dill', 'parsley', 'spice', 'seasoning', 'cumin', 'ginger', 'имбир',
    ],
  },
  {
    id: 'pantry',
    words: [
      'мука', 'сахар', 'рис', 'гречк', 'макарон', 'паста', 'масло растит', 'оливков',
      'уксус', 'соус', 'консерв', 'фасоль', 'нут', 'чечевиц', 'крупа', 'овсян',
      'flour', 'sugar', 'rice', 'pasta', 'oil', 'olive', 'vinegar', 'sauce', 'bean',
      'chickpea', 'lentil', 'oat', 'honey', 'мед', 'сода', 'дрожж', 'yeast',
    ],
  },
];

export function aisleForName(name: string): AisleId {
  const raw = name.toLowerCase();
  const stem = stemIngredientName(name);
  for (const group of GROUPS) {
    if (group.words.some((word) => raw.includes(word) || stem.includes(stemIngredientName(word)))) {
      return group.id;
    }
  }
  return 'other';
}

export const AISLE_I18N_KEYS: Record<AisleId, string> = {
  dairy: 'aisleDairy',
  produce: 'aisleProduce',
  meat: 'aisleMeat',
  bakery: 'aisleBakery',
  frozen: 'aisleFrozen',
  spices: 'aisleSpices',
  pantry: 'aislePantry',
  other: 'aisleOther',
};
