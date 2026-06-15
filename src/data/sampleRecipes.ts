import { FullRecipe, GroceryStore, GroceryDiscount } from '../types';

export const sampleRecipes: FullRecipe[] = [
  {
    recipe: {
      id: 'sample-1',
      category: 'meat',
      status: 'cooked_liked',
      imageUrl: 'https://images.pexels.com/photos/236887/pexels-photo-236887.jpeg?auto=compress&cs=tinysrgb&w=800',
      sourceUrl: 'https://www.instagram.com/reel/example1',
      servings: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    translations: [
      { id: 't1-ru', recipeId: 'sample-1', language: 'ru', title: 'Бефстроганов классический', description: 'Нежная говядина в сливочном соусе с грибами. Идеально с картофельным пюре.' },
      { id: 't1-en', recipeId: 'sample-1', language: 'en', title: 'Classic Beef Stroganoff', description: 'Tender beef in creamy mushroom sauce. Perfect with mashed potatoes.' },
      { id: 't1-de', recipeId: 'sample-1', language: 'de', title: 'Klassisches Stroganoff', description: 'Zartes Rindfleisch in cremiger Pilzsauce. Perfekt mit Kartoffelbrei.' },
    ],
    ingredients: [
      {
        id: 'i1-1', recipeId: 'sample-1', quantity: 600, unit: 'g',
        translations: [
          { id: 'it1-ru', ingredientId: 'i1-1', language: 'ru', name: 'Говяжья вырезка' },
          { id: 'it1-en', ingredientId: 'i1-1', language: 'en', name: 'Beef tenderloin' },
          { id: 'it1-de', ingredientId: 'i1-1', language: 'de', name: 'Rinderfilet' },
        ],
      },
      {
        id: 'i1-2', recipeId: 'sample-1', quantity: 250, unit: 'g',
        translations: [
          { id: 'it2-ru', ingredientId: 'i1-2', language: 'ru', name: 'Шампиньоны' },
          { id: 'it2-en', ingredientId: 'i1-2', language: 'en', name: 'Button mushrooms' },
          { id: 'it2-de', ingredientId: 'i1-2', language: 'de', name: 'Champignons' },
        ],
      },
      {
        id: 'i1-3', recipeId: 'sample-1', quantity: 200, unit: 'ml',
        translations: [
          { id: 'it3-ru', ingredientId: 'i1-3', language: 'ru', name: 'Сливки 20%' },
          { id: 'it3-en', ingredientId: 'i1-3', language: 'en', name: 'Heavy cream 20%' },
          { id: 'it3-de', ingredientId: 'i1-3', language: 'de', name: 'Sahne 20%' },
        ],
      },
      {
        id: 'i1-4', recipeId: 'sample-1', quantity: 1, unit: 'pcs',
        translations: [
          { id: 'it4-ru', ingredientId: 'i1-4', language: 'ru', name: 'Луковица' },
          { id: 'it4-en', ingredientId: 'i1-4', language: 'en', name: 'Onion' },
          { id: 'it4-de', ingredientId: 'i1-4', language: 'de', name: 'Zwiebel' },
        ],
      },
      {
        id: 'i1-5', recipeId: 'sample-1', quantity: 2, unit: 'tbsp',
        translations: [
          { id: 'it5-ru', ingredientId: 'i1-5', language: 'ru', name: 'Растительное масло' },
          { id: 'it5-en', ingredientId: 'i1-5', language: 'en', name: 'Vegetable oil' },
          { id: 'it5-de', ingredientId: 'i1-5', language: 'de', name: 'Pflanzenöl' },
        ],
      },
      {
        id: 'i1-6', recipeId: 'sample-1', quantity: 1, unit: 'tbsp',
        translations: [
          { id: 'it6-ru', ingredientId: 'i1-6', language: 'ru', name: 'Томатная паста' },
          { id: 'it6-en', ingredientId: 'i1-6', language: 'en', name: 'Tomato paste' },
          { id: 'it6-de', ingredientId: 'i1-6', language: 'de', name: 'Tomatenmark' },
        ],
      },
    ],
    steps: [
      {
        id: 's1-1', recipeId: 'sample-1', stepOrder: 1,
        translations: [
          { id: 'st1-ru', stepId: 's1-1', language: 'ru', instruction: 'Нарежьте говядину тонкими полосками поперек волокон. Посолите и поперчите.' },
          { id: 'st1-en', stepId: 's1-1', language: 'en', instruction: 'Cut beef into thin strips across the grain. Season with salt and pepper.' },
          { id: 'st1-de', stepId: 's1-1', language: 'de', instruction: 'Schneiden Sie das Rindfleisch in dünne Streifen quer zur Faser. Mit Salz und Pfeffer würzen.' },
        ],
      },
      {
        id: 's1-2', recipeId: 'sample-1', stepOrder: 2, timerMinutes: 5,
        translations: [
          { id: 'st2-ru', stepId: 's1-2', language: 'ru', instruction: 'Обжарьте мясо на сильном огне до коричневой корочки. Уберите на тарелку.' },
          { id: 'st2-en', stepId: 's1-2', language: 'en', instruction: 'Sear meat on high heat until browned. Set aside.' },
          { id: 'st2-de', stepId: 's1-2', language: 'de', instruction: 'Braten Sie das Fleisch bei starker Hitze goldbraun an. Beiseite legen.' },
        ],
      },
      {
        id: 's1-3', recipeId: 'sample-1', stepOrder: 3, timerMinutes: 7,
        translations: [
          { id: 'st3-ru', stepId: 's1-3', language: 'ru', instruction: 'Обжарьте нарезанный лук и грибы до золотистого цвета.' },
          { id: 'st3-en', stepId: 's1-3', language: 'en', instruction: 'Sauté chopped onion and mushrooms until golden.' },
          { id: 'st3-de', stepId: 's1-3', language: 'de', instruction: 'Dünsten Sie die gehackte Zwiebel und Pilze goldbraun.' },
        ],
      },
      {
        id: 's1-4', recipeId: 'sample-1', stepOrder: 4,
        translations: [
          { id: 'st4-ru', stepId: 's1-4', language: 'ru', instruction: 'Добавьте томатную пасту, перемешайте. Верните мясо в сковороду.' },
          { id: 'st4-en', stepId: 's1-4', language: 'en', instruction: 'Add tomato paste, stir. Return meat to the pan.' },
          { id: 'st4-de', stepId: 's1-4', language: 'de', instruction: 'Tomatenmark hinzufügen, umrühren. Fleisch zurück in die Pfanne.' },
        ],
      },
      {
        id: 's1-5', recipeId: 'sample-1', stepOrder: 5, timerMinutes: 10,
        translations: [
          { id: 'st5-ru', stepId: 's1-5', language: 'ru', instruction: 'Влейте сливки, убавьте огонь и тушите под крышкой 10 минут до готовности.' },
          { id: 'st5-en', stepId: 's1-5', language: 'en', instruction: 'Pour in cream, reduce heat and simmer covered for 10 minutes until done.' },
          { id: 'st5-de', stepId: 's1-5', language: 'de', instruction: 'Sahne hinzufügen, Hitze reduzieren und zugedeckt 10 Minuten köcheln lassen.' },
        ],
      },
    ],
  },
  {
    recipe: {
      id: 'sample-2',
      category: 'pastry',
      status: 'want_to_cook',
      imageUrl: 'https://images.pexels.com/photos/205961/pexels-photo-205961.jpeg?auto=compress&cs=tinysrgb&w=800',
      sourceUrl: 'https://www.youtube.com/watch?v=example2',
      servings: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    translations: [
      { id: 't2-ru', recipeId: 'sample-2', language: 'ru', title: 'Яблочный штрудель', description: 'Традиционный австрийский десерт с хрустящим тестом и ароматной яблочной начинкой.' },
      { id: 't2-en', recipeId: 'sample-2', language: 'en', title: 'Apple Strudel', description: 'Traditional Austrian pastry with crispy layers and spiced apple filling.' },
      { id: 't2-de', recipeId: 'sample-2', language: 'de', title: 'Apfelstrudel', description: 'Traditionelles österreichisches Gebäck mit knusprigen Schichten und gewürzter Apfelfüllung.' },
    ],
    ingredients: [
      {
        id: 'i2-1', recipeId: 'sample-2', quantity: 4, unit: 'pcs',
        translations: [
          { id: 'i2t1-ru', ingredientId: 'i2-1', language: 'ru', name: 'Яблоки' },
          { id: 'i2t1-en', ingredientId: 'i2-1', language: 'en', name: 'Apples' },
          { id: 'i2t1-de', ingredientId: 'i2-1', language: 'de', name: 'Äpfel' },
        ],
      },
      {
        id: 'i2-2', recipeId: 'sample-2', quantity: 1, unit: 'cup',
        translations: [
          { id: 'i2t2-ru', ingredientId: 'i2-2', language: 'ru', name: 'Мука' },
          { id: 'i2t2-en', ingredientId: 'i2-2', language: 'en', name: 'Flour' },
          { id: 'i2t2-de', ingredientId: 'i2-2', language: 'de', name: 'Mehl' },
        ],
      },
      {
        id: 'i2-3', recipeId: 'sample-2', quantity: 100, unit: 'g',
        translations: [
          { id: 'i2t3-ru', ingredientId: 'i2-3', language: 'ru', name: 'Сахар' },
          { id: 'i2t3-en', ingredientId: 'i2-3', language: 'en', name: 'Sugar' },
          { id: 'i2t3-de', ingredientId: 'i2-3', language: 'de', name: 'Zucker' },
        ],
      },
      {
        id: 'i2-4', recipeId: 'sample-2', quantity: 50, unit: 'g',
        translations: [
          { id: 'i2t4-ru', ingredientId: 'i2-4', language: 'ru', name: 'Грецкие орехи' },
          { id: 'i2t4-en', ingredientId: 'i2-4', language: 'en', name: 'Walnuts' },
          { id: 'i2t4-de', ingredientId: 'i2-4', language: 'de', name: 'Walnüsse' },
        ],
      },
      {
        id: 'i2-5', recipeId: 'sample-2', quantity: 50, unit: 'g',
        translations: [
          { id: 'i2t5-ru', ingredientId: 'i2-5', language: 'ru', name: 'Изюм' },
          { id: 'i2t5-en', ingredientId: 'i2-5', language: 'en', name: 'Raisins' },
          { id: 'i2t5-de', ingredientId: 'i2-5', language: 'de', name: 'Rosinen' },
        ],
      },
      {
        id: 'i2-6', recipeId: 'sample-2', quantity: 1, unit: 'tsp',
        translations: [
          { id: 'i2t6-ru', ingredientId: 'i2-6', language: 'ru', name: 'Корица' },
          { id: 'i2t6-en', ingredientId: 'i2-6', language: 'en', name: 'Cinnamon' },
          { id: 'i2t6-de', ingredientId: 'i2-6', language: 'de', name: 'Zimt' },
        ],
      },
      {
        id: 'i2-7', recipeId: 'sample-2', quantity: 120, unit: 'g',
        translations: [
          { id: 'i2t7-ru', ingredientId: 'i2-7', language: 'ru', name: 'Сливочное масло' },
          { id: 'i2t7-en', ingredientId: 'i2-7', language: 'en', name: 'Butter' },
          { id: 'i2t7-de', ingredientId: 'i2-7', language: 'de', name: 'Butter' },
        ],
      },
    ],
    steps: [
      {
        id: 's2-1', recipeId: 'sample-2', stepOrder: 1, timerMinutes: 30,
        translations: [
          { id: 's2t1-ru', stepId: 's2-1', language: 'ru', instruction: 'Замесите тонкое тесто из муки, воды и щепотки соли. Оставьте отдохнуть на 30 минут.' },
          { id: 's2t1-en', stepId: 's2-1', language: 'en', instruction: 'Make thin dough from flour, water and pinch of salt. Let rest for 30 minutes.' },
          { id: 's2t1-de', stepId: 's2-1', language: 'de', instruction: 'Bereiten Sie dünnen Teig aus Mehl, Wasser und einer Prise Salz zu. 30 Minuten ruhen lassen.' },
        ],
      },
      {
        id: 's2-2', recipeId: 'sample-2', stepOrder: 2,
        translations: [
          { id: 's2t2-ru', stepId: 's2-2', language: 'ru', instruction: 'Нарежьте яблоки тонкими ломтиками, смешайте с сахаром, корицей, орехами и изюмом.' },
          { id: 's2t2-en', stepId: 's2-2', language: 'en', instruction: 'Slice apples thinly, mix with sugar, cinnamon, walnuts and raisins.' },
          { id: 's2t2-de', stepId: 's2-2', language: 'de', instruction: 'Äpfel in dünne Scheiben schneiden, mit Zucker, Zimt, Walnüssen und Rosinen mischen.' },
        ],
      },
      {
        id: 's2-3', recipeId: 'sample-2', stepOrder: 3,
        translations: [
          { id: 's2t3-ru', stepId: 's2-3', language: 'ru', instruction: 'Раскатайте тесто очень тонко. Смажьте растопленным маслом и разложите начинку.' },
          { id: 's2t3-en', stepId: 's2-3', language: 'en', instruction: 'Roll dough very thin. Brush with melted butter and spread filling.' },
          { id: 's2t3-de', stepId: 's2-3', language: 'de', instruction: 'Teig sehr dünn ausrollen. Mit geschmolzener Butter bestreichen und Füllung verteilen.' },
        ],
      },
      {
        id: 's2-4', recipeId: 'sample-2', stepOrder: 4,
        translations: [
          { id: 's2t4-ru', stepId: 's2-4', language: 'ru', instruction: 'Аккуратно сверните в рулет. Положите на противень швом вниз.' },
          { id: 's2t4-en', stepId: 's2-4', language: 'en', instruction: 'Carefully roll into a log. Place on baking sheet seam side down.' },
          { id: 's2t4-de', stepId: 's2-4', language: 'de', instruction: 'Vorsichtig zu einer Rolle aufrollen. Mit der Naht nach unten aufs Blech legen.' },
        ],
      },
      {
        id: 's2-5', recipeId: 'sample-2', stepOrder: 5, timerMinutes: 40,
        translations: [
          { id: 's2t5-ru', stepId: 's2-5', language: 'ru', instruction: 'Выпекайте при 180°C около 40 минут до золотистой корочки. Подавайте теплым.' },
          { id: 's2t5-en', stepId: 's2-5', language: 'en', instruction: 'Bake at 180°C for about 40 minutes until golden. Serve warm.' },
          { id: 's2t5-de', stepId: 's2-5', language: 'de', instruction: 'Bei 180°C etwa 40 Minuten backen bis goldbraun. Warm servieren.' },
        ],
      },
    ],
  },
  {
    recipe: {
      id: 'sample-3',
      category: 'healthy',
      status: 'cooked_liked',
      imageUrl: 'https://images.pexels.com/photos/1218755/pexels-photo-1218755.jpeg?auto=compress&cs=tinysrgb&w=800',
      sourceUrl: 'https://www.tiktok.com/@example/video/3',
      servings: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    translations: [
      { id: 't3-ru', recipeId: 'sample-3', language: 'ru', title: 'Греческий салат', description: 'Легкий и освежающий салат с овощами, фетой и маслинами.' },
      { id: 't3-en', recipeId: 'sample-3', language: 'en', title: 'Greek Salad', description: 'Light and refreshing salad with vegetables, feta and olives.' },
      { id: 't3-de', recipeId: 'sample-3', language: 'de', title: 'Griechischer Salat', description: 'Leichter und erfrischender Salat mit Gemüse, Feta und Oliven.' },
    ],
    ingredients: [
      {
        id: 'i3-1', recipeId: 'sample-3', quantity: 2, unit: 'pcs',
        translations: [
          { id: 'i3t1-ru', ingredientId: 'i3-1', language: 'ru', name: 'Томаты' },
          { id: 'i3t1-en', ingredientId: 'i3-1', language: 'en', name: 'Tomatoes' },
          { id: 'i3t1-de', ingredientId: 'i3-1', language: 'de', name: 'Tomaten' },
        ],
      },
      {
        id: 'i3-2', recipeId: 'sample-3', quantity: 1, unit: 'pcs',
        translations: [
          { id: 'i3t2-ru', ingredientId: 'i3-2', language: 'ru', name: 'Огурец' },
          { id: 'i3t2-en', ingredientId: 'i3-2', language: 'en', name: 'Cucumber' },
          { id: 'i3t2-de', ingredientId: 'i3-2', language: 'de', name: 'Gurke' },
        ],
      },
      {
        id: 'i3-3', recipeId: 'sample-3', quantity: 100, unit: 'g',
        translations: [
          { id: 'i3t3-ru', ingredientId: 'i3-3', language: 'ru', name: 'Сыр Фета' },
          { id: 'i3t3-en', ingredientId: 'i3-3', language: 'en', name: 'Feta Cheese' },
          { id: 'i3t3-de', ingredientId: 'i3-3', language: 'de', name: 'Feta-Käse' },
        ],
      },
      {
        id: 'i3-4', recipeId: 'sample-3', quantity: 0.5, unit: 'pcs',
        translations: [
          { id: 'i3t4-ru', ingredientId: 'i3-4', language: 'ru', name: 'Красный лук' },
          { id: 'i3t4-en', ingredientId: 'i3-4', language: 'en', name: 'Red onion' },
          { id: 'i3t4-de', ingredientId: 'i3-4', language: 'de', name: 'Rote Zwiebel' },
        ],
      },
      {
        id: 'i3-5', recipeId: 'sample-3', quantity: 50, unit: 'g',
        translations: [
          { id: 'i3t5-ru', ingredientId: 'i3-5', language: 'ru', name: 'Маслины без косточки' },
          { id: 'i3t5-en', ingredientId: 'i3-5', language: 'en', name: 'Pitted olives' },
          { id: 'i3t5-de', ingredientId: 'i3-5', language: 'de', name: 'Entkernte Oliven' },
        ],
      },
      {
        id: 'i3-6', recipeId: 'sample-3', quantity: 2, unit: 'tbsp',
        translations: [
          { id: 'i3t6-ru', ingredientId: 'i3-6', language: 'ru', name: 'Оливковое масло' },
          { id: 'i3t6-en', ingredientId: 'i3-6', language: 'en', name: 'Olive oil' },
          { id: 'i3t6-de', ingredientId: 'i3-6', language: 'de', name: 'Olivenöl' },
        ],
      },
      {
        id: 'i3-7', recipeId: 'sample-3', quantity: 1, unit: 'tbsp',
        translations: [
          { id: 'i3t7-ru', ingredientId: 'i3-7', language: 'ru', name: 'Красный винный уксус' },
          { id: 'i3t7-en', ingredientId: 'i3-7', language: 'en', name: 'Red wine vinegar' },
          { id: 'i3t7-de', ingredientId: 'i3-7', language: 'de', name: 'Rotweinessig' },
        ],
      },
    ],
    steps: [
      {
        id: 's3-1', recipeId: 'sample-3', stepOrder: 1,
        translations: [
          { id: 's3t1-ru', stepId: 's3-1', language: 'ru', instruction: 'Нарежьте томаты крупными дольками, огурец — полукольцами.' },
          { id: 's3t1-en', stepId: 's3-1', language: 'en', instruction: 'Cut tomatoes into large wedges, cucumber into half-moons.' },
          { id: 's3t1-de', stepId: 's3-1', language: 'de', instruction: 'Tomaten in große Spalten schneiden, Gurke in Halbmonde.' },
        ],
      },
      {
        id: 's3-2', recipeId: 'sample-3', stepOrder: 2,
        translations: [
          { id: 's3t2-ru', stepId: 's3-2', language: 'ru', instruction: 'Нарежьте красный лук тонкими полукольцами.' },
          { id: 's3t2-en', stepId: 's3-2', language: 'en', instruction: 'Slice red onion into thin half-moons.' },
          { id: 's3t2-de', stepId: 's3-2', language: 'de', instruction: 'Rote Zwiebel in dünne Halbmonde schneiden.' },
        ],
      },
      {
        id: 's3-3', recipeId: 'sample-3', stepOrder: 3,
        translations: [
          { id: 's3t3-ru', stepId: 's3-3', language: 'ru', instruction: 'Выложите овощи в миску. Сверху положите кубики феты и маслины.' },
          { id: 's3t3-en', stepId: 's3-3', language: 'en', instruction: 'Place vegetables in a bowl. Top with feta cubes and olives.' },
          { id: 's3t3-de', stepId: 's3-3', language: 'de', instruction: 'Gemüse in eine Schüssel geben. Mit Feta-Würfeln und Oliven toppen.' },
        ],
      },
      {
        id: 's3-4', recipeId: 'sample-3', stepOrder: 4,
        translations: [
          { id: 's3t4-ru', stepId: 's3-4', language: 'ru', instruction: 'Заправьте оливковым маслом и уксусом. Посолите по вкусу. Подавайте сразу.' },
          { id: 's3t4-en', stepId: 's3-4', language: 'en', instruction: 'Dress with olive oil and vinegar. Salt to taste. Serve immediately.' },
          { id: 's3t4-de', stepId: 's3-4', language: 'de', instruction: 'Mit Olivenöl und Essig anmachen. Nach Geschmack salzen. Sofort servieren.' },
        ],
      },
    ],
  },
];

export const groceryStores: GroceryStore[] = [
  { id: 'store-1', name: 'Пятёрочка' },
  { id: 'store-2', name: 'Magnit' },
  { id: 'store-3', name: 'Edeka' },
  { id: 'store-4', name: 'REWE' },
  { id: 'store-5', name: 'Tesco' },
];

export const groceryDiscounts: GroceryDiscount[] = [
  { id: 'd1', storeId: 'store-1', ingredientKeyword: 'говядина', discountPercentage: 20, originalPrice: 450, discountedPrice: 360, validUntil: '2026-06-15', language: 'ru' },
  { id: 'd2', storeId: 'store-2', ingredientKeyword: 'грибы', discountPercentage: 30, originalPrice: 180, discountedPrice: 126, validUntil: '2026-06-12', language: 'ru' },
  { id: 'd3', storeId: 'store-3', ingredientKeyword: 'apples', discountPercentage: 25, originalPrice: 2.50, discountedPrice: 1.88, validUntil: '2026-06-20', language: 'en' },
  { id: 'd4', storeId: 'store-4', ingredientKeyword: 'Äpfel', discountPercentage: 25, originalPrice: 2.50, discountedPrice: 1.88, validUntil: '2026-06-20', language: 'de' },
  { id: 'd5', storeId: 'store-1', ingredientKeyword: 'томаты', discountPercentage: 15, originalPrice: 200, discountedPrice: 170, validUntil: '2026-06-18', language: 'ru' },
  { id: 'd6', storeId: 'store-5', ingredientKeyword: 'tomatoes', discountPercentage: 15, originalPrice: 2.00, discountedPrice: 1.70, validUntil: '2026-06-18', language: 'en' },
];

export const measurementConversions: { name: { ru: string; en: string; de: string }; weight: number; category: string }[] = [
  { name: { ru: 'Мука', en: 'Flour', de: 'Mehl' }, weight: 160, category: 'baking' },
  { name: { ru: 'Сахар', en: 'Sugar', de: 'Zucker' }, weight: 200, category: 'baking' },
  { name: { ru: 'Рис', en: 'Rice', de: 'Reis' }, weight: 185, category: 'grains' },
  { name: { ru: 'Гречка', en: 'Buckwheat', de: 'Buchweizen' }, weight: 170, category: 'grains' },
  { name: { ru: 'Манная крупа', en: 'Semolina', de: 'Grieß' }, weight: 160, category: 'grains' },
  { name: { ru: 'Овсянка', en: 'Oats', de: 'Haferflocken' }, weight: 90, category: 'grains' },
  { name: { ru: 'Мёд', en: 'Honey', de: 'Honig' }, weight: 320, category: 'sweeteners' },
  { name: { ru: 'Молоко', en: 'Milk', de: 'Milch' }, weight: 240, category: 'liquids' },
  { name: { ru: 'Сливки', en: 'Cream', de: 'Sahne' }, weight: 240, category: 'liquids' },
  { name: { ru: 'Сметана', en: 'Sour cream', de: 'Saure Sahne' }, weight: 230, category: 'liquids' },
  { name: { ru: 'Масло сливочное', en: 'Butter', de: 'Butter' }, weight: 220, category: 'fats' },
  { name: { ru: 'Масло растительное', en: 'Vegetable oil', de: 'Pflanzenöl' }, weight: 220, category: 'fats' },
  { name: { ru: 'Орехи грецкие', en: 'Walnuts', de: 'Walnüsse' }, weight: 100, category: 'nuts' },
  { name: { ru: 'Миндаль', en: 'Almonds', de: 'Mandeln' }, weight: 130, category: 'nuts' },
  { name: { ru: 'Соль', en: 'Salt', de: 'Salz' }, weight: 320, category: 'spices' },
  { name: { ru: 'Какао-порошок', en: 'Cocoa powder', de: 'Kakaopulver' }, weight: 75, category: 'baking' },
  { name: { ru: 'Сода', en: 'Baking soda', de: 'Backpulver' }, weight: 15, category: 'baking' },
  { name: { ru: 'Дрожжи сухие', en: 'Dry yeast', de: 'Trockenhefe' }, weight: 25, category: 'baking' },
];

export const tablespoonConversions: { name: { ru: string; en: string; de: string }; weight: number; category: string }[] = [
  { name: { ru: 'Сахар', en: 'Sugar', de: 'Zucker' }, weight: 25, category: 'sweeteners' },
  { name: { ru: 'Соль', en: 'Salt', de: 'Salz' }, weight: 25, category: 'spices' },
  { name: { ru: 'Мука', en: 'Flour', de: 'Mehl' }, weight: 15, category: 'baking' },
  { name: { ru: 'Мёд', en: 'Honey', de: 'Honig' }, weight: 30, category: 'sweeteners' },
  { name: { ru: 'Масло растительное', en: 'Vegetable oil', de: 'Pflanzenöl' }, weight: 17, category: 'fats' },
  { name: { ru: 'Уксус', en: 'Vinegar', de: 'Essig' }, weight: 15, category: 'liquids' },
  { name: { ru: 'Сметана', en: 'Sour cream', de: 'Saure Sahne' }, weight: 25, category: 'liquids' },
  { name: { ru: 'Оливковое масло', en: 'Olive oil', de: 'Olivenöl' }, weight: 17, category: 'fats' },
];
