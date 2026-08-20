import { Language } from '../types';

export type MeasureName = Record<Language, string>;

const ALL_LANGS: Language[] = ['ru', 'en', 'de', 'uk', 'pl', 'it', 'es', 'fr', 'kk'];

function n(
  ru: string,
  en: string,
  de: string,
  uk: string,
  pl: string,
  it: string,
  es: string,
  fr: string,
  kk: string,
): MeasureName {
  return { ru, en, de, uk, pl, it, es, fr, kk };
}

export function nameInAllLangs(value: string): MeasureName {
  return n(value, value, value, value, value, value, value, value, value);
}

export function completeMeasureName(partial: Partial<MeasureName> | undefined): MeasureName {
  const fallback =
    partial?.ru || partial?.en || Object.values(partial || {}).find(Boolean) || '';
  const result = {} as MeasureName;
  for (const lang of ALL_LANGS) {
    result[lang] = partial?.[lang] || fallback;
  }
  return result;
}

export const measurementConversions: { name: MeasureName; weight: number; category: string }[] = [
  { name: n('Мука', 'Flour', 'Mehl', 'Борошно', 'Mąka', 'Farina', 'Harina', 'Farine', 'Ұн'), weight: 160, category: 'baking' },
  { name: n('Мука ржаная', 'Rye flour', 'Roggenmehl', 'Житнє борошно', 'Mąka żytnia', 'Farina di segale', 'Harina de centeno', 'Farine de seigle', 'Қара бидай ұны'), weight: 140, category: 'baking' },
  { name: n('Мука кукурузная', 'Corn flour', 'Maismehl', 'Кукурудзяне борошно', 'Mąka kukurydziana', 'Farina di mais', 'Harina de maíz', 'Farine de maïs', 'Жүгері ұны'), weight: 145, category: 'baking' },
  { name: n('Мука гречневая', 'Buckwheat flour', 'Buchweizenmehl', 'Гречане борошно', 'Mąka gryczana', 'Farina di grano saraceno', 'Harina de alforfón', 'Farine de sarrasin', 'Қарақұмық ұны'), weight: 130, category: 'baking' },
  { name: n('Мука цельнозерновая', 'Whole wheat flour', 'Vollkornmehl', 'Цільнозернове борошно', 'Mąka pełnoziarnista', 'Farina integrale', 'Harina integral', 'Farine complète', 'Толық дәнді ұн'), weight: 150, category: 'baking' },
  { name: n('Крахмал картофельный', 'Potato starch', 'Kartoffelstärke', 'Картопляний крохмаль', 'Skrobia ziemniaczana', 'Amido di patate', 'Almidón de patata', 'Fécule de pomme de terre', 'Картоп крахмалы'), weight: 130, category: 'baking' },
  { name: n('Крахмал кукурузный', 'Cornstarch', 'Maisstärke', 'Кукурудзяний крохмаль', 'Skrobia kukurydziana', 'Amido di mais', 'Maicena', 'Fécule de maïs', 'Жүгері крахмалы'), weight: 120, category: 'baking' },
  { name: n('Сахар', 'Sugar', 'Zucker', 'Цукор', 'Cukier', 'Zucchero', 'Azúcar', 'Sucre', 'Қант'), weight: 200, category: 'baking' },
  { name: n('Сахар коричневый', 'Brown sugar', 'Brauner Zucker', 'Коричневий цукор', 'Cukier brązowy', 'Zucchero di canna', 'Azúcar moreno', 'Sucre roux', 'Қоңыр қант'), weight: 180, category: 'baking' },
  { name: n('Сахарная пудра', 'Powdered sugar', 'Puderzucker', 'Цукрова пудра', 'Cukier puder', 'Zucchero a velo', 'Azúcar glas', 'Sucre glace', 'Қант ұнтағы'), weight: 160, category: 'baking' },
  { name: n('Разрыхлитель', 'Baking powder', 'Backpulver', 'Розпушувач', 'Proszek do pieczenia', 'Lievito per dolci', 'Levadura química', 'Levure chimique', 'Көтергіш'), weight: 180, category: 'baking' },
  { name: n('Сода', 'Baking soda', 'Natron', 'Сода', 'Soda oczyszczona', 'Bicarbonato', 'Bicarbonato', 'Bicarbonate', 'Сода'), weight: 15, category: 'baking' },
  { name: n('Дрожжи сухие', 'Dry yeast', 'Trockenhefe', 'Сухі дріжджі', 'Drożdże suszone', 'Lievito secco', 'Levadura seca', 'Levure sèche', 'Құрғақ ашытқы'), weight: 25, category: 'baking' },
  { name: n('Какао-порошок', 'Cocoa powder', 'Kakaopulver', 'Какао-порошок', 'Kakao w proszku', 'Cacao in polvere', 'Cacao en polvo', 'Cacao en poudre', 'Какао ұнтағы'), weight: 75, category: 'baking' },
  { name: n('Сухари панировочные', 'Breadcrumbs', 'Paniermehl', 'Панірувальні сухарі', 'Bułka tarta', 'Pangrattato', 'Pan rallado', 'Chapelure', 'Нанықтық үгінді'), weight: 125, category: 'baking' },
  { name: n('Кокосовая стружка', 'Desiccated coconut', 'Kokosraspeln', 'Кокосова стружка', 'Wiórki kokosowe', 'Cocco rapé', 'Coco rallado', 'Noix de coco râpée', 'Кокос жоңқасы'), weight: 70, category: 'baking' },
  { name: n('Мак', 'Poppy seeds', 'Mohn', 'Мак', 'Mak', 'Semi di papavero', 'Semillas de amapola', 'Graines de pavot', 'Көкнәр'), weight: 140, category: 'baking' },
  { name: n('Рис', 'Rice', 'Reis', 'Рис', 'Ryż', 'Riso', 'Arroz', 'Riz', 'Күріш'), weight: 185, category: 'grains' },
  { name: n('Гречка', 'Buckwheat', 'Buchweizen', 'Гречка', 'Gryka', 'Grano saraceno', 'Alforfón', 'Sarrasin', 'Қарақұмық'), weight: 170, category: 'grains' },
  { name: n('Манная крупа', 'Semolina', 'Grieß', 'Манна крупа', 'Kasza manna', 'Semolino', 'Sémola', 'Semoule', 'Мәнті жарма'), weight: 160, category: 'grains' },
  { name: n('Овсянка', 'Oats', 'Haferflocken', 'Вівсянка', 'Płatki owsiane', 'Avena', 'Avena', 'Flocons d’avoine', 'Сұлы'), weight: 90, category: 'grains' },
  { name: n('Перловая крупа', 'Pearl barley', 'Perlgraupen', 'Перлова крупа', 'Kasza pęczak', 'Orzo perlato', 'Cebada perlada', 'Orge perlé', 'Арпа жарма'), weight: 180, category: 'grains' },
  { name: n('Пшено', 'Millet', 'Hirse', 'Пшоно', 'Kasza jaglana', 'Miglio', 'Mijo', 'Millet', 'Тары'), weight: 180, category: 'grains' },
  { name: n('Ячневая крупа', 'Barley groats', 'Gerstengrütze', 'Ячна крупа', 'Kasza jęczmienna', 'Orzo spezzato', 'Cebada machacada', 'Orge concassé', 'Арпа үгіті'), weight: 145, category: 'grains' },
  { name: n('Кукурузная крупа', 'Corn grits', 'Maisgrieß', 'Кукурудзяна крупа', 'Kasza kukurydziana', 'Polenta', 'Sémola de maíz', 'Semoule de maïs', 'Жүгері жарма'), weight: 140, category: 'grains' },
  { name: n('Кускус', 'Couscous', 'Couscous', 'Кускус', 'Kuskus', 'Couscous', 'Cuscús', 'Couscous', 'Кускус'), weight: 180, category: 'grains' },
  { name: n('Булгур', 'Bulgur', 'Bulgur', 'Булгур', 'Bulgur', 'Bulgur', 'Bulgur', 'Boulgour', 'Бұлғұр'), weight: 140, category: 'grains' },
  { name: n('Киноа', 'Quinoa', 'Quinoa', 'Кіноа', 'Komosa ryżowa', 'Quinoa', 'Quinoa', 'Quinoa', 'Киноа'), weight: 170, category: 'grains' },
  { name: n('Чечевица', 'Lentils', 'Linsen', 'Сочевиця', 'Soczewica', 'Lenticchie', 'Lentejas', 'Lentilles', 'Жасымық'), weight: 190, category: 'grains' },
  { name: n('Горох сухой', 'Dried peas', 'Trockene Erbsen', 'Горох сухий', 'Groch suszony', 'Piselli secchi', 'Guisantes secos', 'Pois secs', 'Құрғақ бұршақ'), weight: 185, category: 'grains' },
  { name: n('Фасоль сухая', 'Dried beans', 'Trockene Bohnen', 'Квасоля суха', 'Fasola suszona', 'Fagioli secchi', 'Alubias secas', 'Haricots secs', 'Құрғақ үрме бұршақ'), weight: 175, category: 'grains' },
  { name: n('Нут', 'Chickpeas', 'Kichererbsen', 'Нут', 'Ciecierzyca', 'Ceci', 'Garbanzos', 'Pois chiches', 'Ноқат'), weight: 180, category: 'grains' },
  { name: n('Мёд', 'Honey', 'Honig', 'Мед', 'Miód', 'Miele', 'Miel', 'Miel', 'Бал'), weight: 320, category: 'sweeteners' },
  { name: n('Варенье', 'Jam', 'Marmelade', 'Варення', 'Konfitura', 'Marmellata', 'Mermelada', 'Confiture', 'Тосап'), weight: 270, category: 'sweeteners' },
  { name: n('Джем', 'Fruit jam', 'Konfitüre', 'Джем', 'Dżem', 'Confettura', 'Mermelada de fruta', 'Confiture de fruits', 'Джем'), weight: 270, category: 'sweeteners' },
  { name: n('Повидло', 'Fruit butter', 'Fruchtmus', 'Повидло', 'Powidła', 'Composta', 'Dulce de fruta', 'Compote épaisse', 'Повидло'), weight: 280, category: 'sweeteners' },
  { name: n('Сироп', 'Syrup', 'Sirup', 'Сироп', 'Syrop', 'Sciroppo', 'Sirope', 'Sirop', 'Сироп'), weight: 280, category: 'sweeteners' },
  { name: n('Молоко', 'Milk', 'Milch', 'Молоко', 'Mleko', 'Latte', 'Leche', 'Lait', 'Сүт'), weight: 240, category: 'liquids' },
  { name: n('Вода', 'Water', 'Wasser', 'Вода', 'Woda', 'Acqua', 'Agua', 'Eau', 'Су'), weight: 200, category: 'liquids' },
  { name: n('Сливки', 'Cream', 'Sahne', 'Вершки', 'Śmietana kremówka', 'Panna', 'Nata', 'Crème', 'Кілегей'), weight: 240, category: 'liquids' },
  { name: n('Сметана', 'Sour cream', 'Saure Sahne', 'Сметана', 'Śmietana', 'Panna acida', 'Nata agria', 'Crème fraîche', 'Қаймақ'), weight: 230, category: 'liquids' },
  { name: n('Кефир', 'Kefir', 'Kefir', 'Кефір', 'Kefir', 'Kefir', 'Kéfir', 'Kéfir', 'Кефир'), weight: 200, category: 'liquids' },
  { name: n('Йогурт', 'Yogurt', 'Joghurt', 'Йогурт', 'Jogurt', 'Yogurt', 'Yogur', 'Yaourt', 'Йогурт'), weight: 200, category: 'liquids' },
  { name: n('Ряженка', 'Ryazhenka', 'Rjaschenka', 'Ряжанка', 'Riażenka', 'Rjaženka', 'Ryazhenka', 'Riajenka', 'Ряженка'), weight: 200, category: 'liquids' },
  { name: n('Сгущённое молоко', 'Condensed milk', 'Kondensmilch', 'Згущене молоко', 'Mleko skondensowane', 'Latte condensato', 'Leche condensada', 'Lait concentré', 'Қоюланған сүт'), weight: 300, category: 'liquids' },
  { name: n('Творог', 'Cottage cheese', 'Quark', 'Сир кисломолочний', 'Twaróg', 'Ricotta', 'Requesón', 'Fromage blanc', 'Сүзбе'), weight: 200, category: 'liquids' },
  { name: n('Уксус', 'Vinegar', 'Essig', 'Оцет', 'Ocet', 'Aceto', 'Vinagre', 'Vinaigre', 'Сірке'), weight: 200, category: 'liquids' },
  { name: n('Сок', 'Juice', 'Saft', 'Сік', 'Sok', 'Succo', 'Zumo', 'Jus', 'Шырын'), weight: 200, category: 'liquids' },
  { name: n('Бульон', 'Broth', 'Brühe', 'Бульйон', 'Bulion', 'Brodo', 'Caldo', 'Bouillon', 'Сорпа'), weight: 200, category: 'liquids' },
  { name: n('Томатная паста', 'Tomato paste', 'Tomatenmark', 'Томатна паста', 'Koncentrat pomidorowy', 'Concentrato di pomodoro', 'Tomate concentrado', 'Double concentré de tomate', 'Қызанақ пастасы'), weight: 220, category: 'liquids' },
  { name: n('Томатный соус', 'Tomato sauce', 'Tomatensauce', 'Томатний соус', 'Sos pomidorowy', 'Salsa di pomodoro', 'Salsa de tomate', 'Sauce tomate', 'Қызанақ соусы'), weight: 200, category: 'liquids' },
  { name: n('Масло сливочное', 'Butter', 'Butter', 'Вершкове масло', 'Masło', 'Burro', 'Mantequilla', 'Beurre', 'Сары май'), weight: 220, category: 'fats' },
  { name: n('Масло растительное', 'Vegetable oil', 'Pflanzenöl', 'Рослинна олія', 'Olej roślinny', 'Olio di semi', 'Aceite vegetal', 'Huile végétale', 'Өсімдік майы'), weight: 220, category: 'fats' },
  { name: n('Оливковое масло', 'Olive oil', 'Olivenöl', 'Оливкова олія', 'Oliwa', 'Olio d’oliva', 'Aceite de oliva', 'Huile d’olive', 'Зәйтүн майы'), weight: 200, category: 'fats' },
  { name: n('Масло кокосовое', 'Coconut oil', 'Kokosöl', 'Кокосова олія', 'Olej kokosowy', 'Olio di cocco', 'Aceite de coco', 'Huile de coco', 'Кокос майы'), weight: 180, category: 'fats' },
  { name: n('Маргарин', 'Margarine', 'Margarine', 'Маргарин', 'Margaryna', 'Margarina', 'Margarina', 'Margarine', 'Маргарин'), weight: 200, category: 'fats' },
  { name: n('Майонез', 'Mayonnaise', 'Mayonnaise', 'Майонез', 'Majonez', 'Maionese', 'Mayonesa', 'Mayonnaise', 'Майонез'), weight: 250, category: 'fats' },
  { name: n('Орехи грецкие', 'Walnuts', 'Walnüsse', 'Волоські горіхи', 'Orzechy włoskie', 'Noci', 'Nueces', 'Noix', 'Жаңғақ'), weight: 100, category: 'nuts' },
  { name: n('Миндаль', 'Almonds', 'Mandeln', 'Мигдаль', 'Migdały', 'Mandorle', 'Almendras', 'Amandes', 'Бадам'), weight: 130, category: 'nuts' },
  { name: n('Фундук', 'Hazelnuts', 'Haselnüsse', 'Фундук', 'Orzechy laskowe', 'Nocciole', 'Avellanas', 'Noisettes', 'Орман жаңғағы'), weight: 140, category: 'nuts' },
  { name: n('Арахис', 'Peanuts', 'Erdnüsse', 'Арахіс', 'Orzeszki ziemne', 'Arachidi', 'Cacahuetes', 'Cacahuètes', 'Жержаңғақ'), weight: 140, category: 'nuts' },
  { name: n('Кешью', 'Cashews', 'Cashewkerne', 'Кешью', 'Nerkowce', 'Anacardi', 'Anacardos', 'Noix de cajou', 'Кешью'), weight: 130, category: 'nuts' },
  { name: n('Фисташки', 'Pistachios', 'Pistazien', 'Фісташки', 'Pistacje', 'Pistacchi', 'Pistachos', 'Pistaches', 'Пісте'), weight: 120, category: 'nuts' },
  { name: n('Семечки подсолнечника', 'Sunflower seeds', 'Sonnenblumenkerne', 'Насіння соняшника', 'Pestki słonecznika', 'Semi di girasole', 'Pipas de girasol', 'Graines de tournesol', 'Күнбағыс дәні'), weight: 150, category: 'nuts' },
  { name: n('Семечки тыквенные', 'Pumpkin seeds', 'Kürbiskerne', 'Насіння гарбуза', 'Pestki dyni', 'Semi di zucca', 'Pipas de calabaza', 'Graines de courge', 'Асқабақ дәні'), weight: 125, category: 'nuts' },
  { name: n('Кунжут', 'Sesame seeds', 'Sesam', 'Кунжут', 'Sezam', 'Sesamo', 'Sésamo', 'Sésame', 'Күнжіт'), weight: 150, category: 'nuts' },
  { name: n('Лён', 'Flax seeds', 'Leinsamen', 'Льон', 'Siemię lniane', 'Semi di lino', 'Semillas de lino', 'Graines de lin', 'Зығыр'), weight: 140, category: 'nuts' },
  { name: n('Изюм', 'Raisins', 'Rosinen', 'Ізюм', 'Rodzynki', 'Uvetta', 'Pasas', 'Raisins secs', 'Меіз'), weight: 155, category: 'nuts' },
  { name: n('Курага', 'Dried apricots', 'Getrocknete Aprikosen', 'Курага', 'Morele suszone', 'Albicocche secche', 'Albaricoques secos', 'Abricots secs', 'Өрік'), weight: 130, category: 'nuts' },
  { name: n('Чернослив', 'Prunes', 'Pflaumen', 'Чорнослив', 'Śliwki suszone', 'Prugne secche', 'Ciruelas pasas', 'Pruneaux', 'Қара өрік'), weight: 150, category: 'nuts' },
  { name: n('Соль', 'Salt', 'Salz', 'Сіль', 'Sól', 'Sale', 'Sal', 'Sel', 'Тұз'), weight: 320, category: 'spices' },
  { name: n('Перец чёрный молотый', 'Ground black pepper', 'Schwarzer Pfeffer', 'Чорний мелений перець', 'Pieprz czarny mielony', 'Pepe nero macinato', 'Pimienta negra molida', 'Poivre noir moulu', 'Ұнтақталған қара бұрыш'), weight: 90, category: 'spices' },
  { name: n('Корица молотая', 'Ground cinnamon', 'Zimt', 'Мелена кориця', 'Cynamon mielony', 'Cannella in polvere', 'Canela molida', 'Cannelle moulue', 'Ұнтақталған даршын'), weight: 100, category: 'spices' },
  { name: n('Паприка', 'Paprika', 'Paprika', 'Паприка', 'Papryka', 'Paprika', 'Pimentón', 'Paprika', 'Паприка'), weight: 110, category: 'spices' },
  { name: n('Сыр тёртый', 'Grated cheese', 'Geriebener Käse', 'Тертий сир', 'Ser tarty', 'Formaggio grattugiato', 'Queso rallado', 'Fromage râpé', 'Үгітілген ірімшік'), weight: 80, category: 'other' },
  { name: n('Клубника', 'Strawberries', 'Erdbeeren', 'Полуниця', 'Truskawki', 'Fragole', 'Fresas', 'Fraises', 'Құлпынай'), weight: 150, category: 'other' },
  { name: n('Черника', 'Blueberries', 'Heidelbeeren', 'Чорниця', 'Borówki', 'Mirtilli', 'Arándanos', 'Myrtilles', 'Қаражидек'), weight: 140, category: 'other' },
  { name: n('Малина', 'Raspberries', 'Himbeeren', 'Малина', 'Maliny', 'Lamponi', 'Frambuesas', 'Framboises', 'Таңқурай'), weight: 120, category: 'other' },
  { name: n('Смородина', 'Currants', 'Johannisbeeren', 'Смородина', 'Porzeczki', 'Ribes', 'Grosellas', 'Groseilles', 'Қарақат'), weight: 140, category: 'other' },
  { name: n('Вишня без косточек', 'Pitted cherries', 'Entsteinte Kirschen', 'Вишня без кісточок', 'Wiśnie bez pestek', 'Ciliegie denocciolate', 'Cerezas sin hueso', 'Cerises dénoyautées', 'Сүйексіз шие'), weight: 155, category: 'other' },
  { name: n('Яблоки тёртые', 'Grated apples', 'Geriebene Äpfel', 'Терті яблука', 'Tarte jabłka', 'Mele grattugiate', 'Manzana rallada', 'Pommes râpées', 'Үгітілген алма'), weight: 160, category: 'other' },
  { name: n('Морковь тёртая', 'Grated carrots', 'Geriebene Karotten', 'Терта морква', 'Tarta marchew', 'Carote grattugiate', 'Zanahoria rallada', 'Carottes râpées', 'Үгітілген сәбіз'), weight: 150, category: 'other' },
  { name: n('Лук нарезанный', 'Chopped onion', 'Gehackte Zwiebeln', 'Нарізана цибуля', 'Pokrojona cebula', 'Cipolla tritata', 'Cebolla picada', 'Oignon haché', 'Тұралған пияз'), weight: 120, category: 'other' },
  { name: n('Капуста шинкованная', 'Shredded cabbage', 'Geschnittener Kohl', 'Шинкована капуста', 'Szatkowana kapusta', 'Cavolo tritato', 'Col picada', 'Chou émincé', 'Тұралған қырыққабат'), weight: 120, category: 'other' },
  { name: n('Горошек зелёный', 'Green peas', 'Erbsen', 'Зелений горошок', 'Groszek', 'Piselli', 'Guisantes', 'Petits pois', 'Жасыл бұршақ'), weight: 170, category: 'other' },
  { name: n('Кукуруза консервированная', 'Canned corn', 'Mais aus der Dose', 'Кукурудза консервована', 'Kukurydza konserwowa', 'Mais in scatola', 'Maíz en lata', 'Maïs en conserve', 'Консервіленген жүгері'), weight: 165, category: 'other' },
];

export const tablespoonConversions: { nameRu: string; weight: number }[] = [
  { nameRu: 'Сахар', weight: 25 },
  { nameRu: 'Сахар коричневый', weight: 20 },
  { nameRu: 'Сахарная пудра', weight: 12 },
  { nameRu: 'Соль', weight: 25 },
  { nameRu: 'Мука', weight: 15 },
  { nameRu: 'Крахмал картофельный', weight: 10 },
  { nameRu: 'Крахмал кукурузный', weight: 10 },
  { nameRu: 'Какао-порошок', weight: 8 },
  { nameRu: 'Разрыхлитель', weight: 10 },
  { nameRu: 'Сода', weight: 15 },
  { nameRu: 'Дрожжи сухие', weight: 8 },
  { nameRu: 'Мёд', weight: 30 },
  { nameRu: 'Варенье', weight: 20 },
  { nameRu: 'Сироп', weight: 20 },
  { nameRu: 'Масло растительное', weight: 17 },
  { nameRu: 'Оливковое масло', weight: 17 },
  { nameRu: 'Масло сливочное', weight: 15 },
  { nameRu: 'Майонез', weight: 15 },
  { nameRu: 'Уксус', weight: 15 },
  { nameRu: 'Вода', weight: 15 },
  { nameRu: 'Молоко', weight: 15 },
  { nameRu: 'Сметана', weight: 25 },
  { nameRu: 'Томатная паста', weight: 25 },
  { nameRu: 'Сгущённое молоко', weight: 20 },
  { nameRu: 'Перец чёрный молотый', weight: 6 },
  { nameRu: 'Корица молотая', weight: 8 },
  { nameRu: 'Паприка', weight: 8 },
];
