export interface NutritionPer100 {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface NutritionFood extends NutritionPer100 {
  // Keywords in every app language, separated by "|". A keyword with several words matches
  // when each word starts a word of the ingredient name, in any order ("масл сливочн" finds
  // both "масло сливочное" and "сливочное масло"). A trailing "=" demands the whole word,
  // for short words that would otherwise prefix-match unrelated products ("sal=" vs "salmon").
  keys: string;
  piece?: number;
  density?: number;
}

function food(
  keys: string,
  kcal: number,
  protein: number,
  fat: number,
  carbs: number,
  extra: { piece?: number; density?: number } = {},
): NutritionFood {
  return { keys, kcal, protein, fat, carbs, ...extra };
}

export const nutritionFoods: NutritionFood[] = [
  // Eggs and dairy
  food('яйцо|яйца|яиц|яйко|яйця|egg|eggs|ei=|eier|jajk|jaj=|uovo|uova|huevo|œuf|oeuf|жұмыртқа', 155, 12.7, 11.5, 0.7, { piece: 55 }),
  food('желток|желтк|жовток|жовтк|yolk|eigelb|żółtk|tuorl|yema|jaune', 322, 15.9, 26.5, 3.6, { piece: 17 }),
  food('яичн белок|белок яйц|белки яиц|белок=|белки=|белков=|білок|білки=|egg white|eiweiß|eiweiss|białko jaj|albume|clara de huevo|blanc d’œuf|blanc d\'oeuf', 52, 10.9, 0.2, 0.7, { piece: 33 }),
  food('молоко|молока|молоком|milk|milch|mleko|mleka|latte=|leche|lait|сүт', 52, 2.8, 2.5, 4.7, { density: 1.03 }),
  food('сгущ молок|сгущенк|сгущёнк|згущ молок|condensed milk|kondensmilch|mleko skondensowane|latte condensato|leche condensada|lait concentré', 320, 7.2, 8.5, 56, { density: 1.3 }),
  food('кокос молок|coconut milk|kokosmilch|mleko kokosowe|latte di cocco|leche de coco|lait de coco', 230, 2.3, 24, 6),
  food('кефир|кефір|kefir|kéfir|ряженк|ряжанк|айран', 41, 3, 1, 4),
  food('йогурт|yogurt|yoghurt|joghurt|jogurt|yaourt|yogur', 66, 5, 3.2, 3.5),
  food('сметан|sour cream|saure sahne|schmand|śmietana=|panna acida|nata agria|crème fraîche|creme fraiche|қаймақ', 206, 2.8, 20, 3.2),
  food('сливк|вершк|cream=|heavy cream|sahne|śmietana kremówka|kremówk|panna=|nata=|crème=|creme=|кілегей', 205, 2.8, 20, 3.7),
  food('творог|творож|сир кисломолочн|кисломолочн сир|cottage cheese|quark|twaróg|twarog|requesón|fromage blanc|сүзбе', 121, 17, 5, 1.8),
  food('рикотт|ricotta', 174, 11, 13, 3),
  food('маскарпоне|mascarpone', 412, 4.6, 42, 4),
  food('сливочн сыр|сыр сливочн|творожн сыр|сыр творожн|cream cheese|frischkäse|serek śmietankowy|formaggio spalmabile|queso crema|fromage frais|philadelphia|филадельфи', 342, 6, 34, 4),
  food('моцарелл|mozzarella', 280, 22, 17, 3),
  food('фета|фетакс|брынз|бринз|feta|bryndza|queso feta', 264, 14, 21, 4),
  food('пармезан|parmesan|parmigiano|grana padano', 392, 36, 26, 3),
  food('сыр|сыра|сыром|сыру|сир=|сиру|сиром|cheese|käse|ser=|sera=|serem|formaggio|queso|fromage|ірімшік|гауд|gouda|cheddar|чеддер|emmental|эмментал', 360, 25, 28, 0),
  food('масл сливочн|сливочн масл|вершков масл|масло вершкове|butter|masło|maslo|burro|mantequilla|beurre|сары май|ghee|топлен масл', 748, 0.5, 82.5, 0.8),
  food('маргарин|margarine|margaryn|margarina', 717, 0.2, 80, 0.7),
  food('майонез|mayonnaise|mayo=|majonez|maionese|mayonesa', 680, 1, 75, 2.6),

  // Oils
  food('масл растительн|растительн масл|масл подсолнечн|подсолнечн масл|масл оливков|оливков масл|рослинн олі|олія|олії|олію|oil=|olive oil|vegetable oil|sunflower oil|öl=|olivenöl|pflanzenöl|sonnenblumenöl|rapsöl|olej|oliwa|olio|aceite|huile|өсімдік май|зәйтүн май', 899, 0, 99.9, 0, { density: 0.92 }),
  food('кокос масл|масл кокос|coconut oil|kokosöl|olej kokosowy|olio di cocco|aceite de coco|huile de coco', 892, 0, 99, 0, { density: 0.92 }),

  // Meat and poultry
  food('филе курин|курин филе|филе куриц|грудк курин|курин грудк|грудк куриц|філе курк|курк філе|грудк курк|chicken breast|chicken fillet|hähnchenbrust|hühnerbrust|pierś kurczak|filet z kurczaka|petto pollo|pechuga|blanc poulet|filet de poulet|тауық төс', 113, 23.6, 1.9, 0.4),
  food('фарш курин|курин фарш|ground chicken|minced chicken|hähnchenhack|mielone z kurczaka', 143, 17.4, 8, 0),
  food('куриц|курин|курочк|курк|курят|бедр|окорочк|chicken|hähnchen|huhn|kurczak|kurczaka|pollo|poulet|тауық', 190, 19, 12, 0),
  food('индейк|индюш|індичк|індик|turkey|pute|truthahn|indyk|tacchino|pavo|dinde|күркетауық', 160, 21, 8, 0),
  food('ground beef|minced beef|rinderhack|mielona wołowina|carne picada de ternera|bœuf haché|boeuf haché', 250, 17, 20, 0),
  food('фарш|ground meat|minced meat|hackfleisch|hack=|mięso mielone|mielone|carne macinata|macinato|carne picada|viande hachée|тартылған ет', 263, 17, 22, 0),
  food('говядин|говяж|яловичин|телятин|beef|rind=|rindfleisch|kalbfleisch|wołowin|cielęcin|manzo|vitello|ternera|carne de res|bœuf|boeuf|veau|сиыр ет', 218, 18.6, 16, 0),
  food('свинин|свиной|свиная|свиные|свинн|pork|schwein|wieprz|maiale|cerdo|porc=|шошқа', 259, 16, 21.6, 0),
  food('баранин|ягнят|ягнятин|lamb|lamm|jagnięcin|baranin|agnello|cordero|agneau|қой ет', 294, 16.6, 25, 0),
  food('бекон|грудинк|bacon|speck|boczek|pancetta|tocino|lardon|лардон', 541, 37, 42, 1.4),
  food('ветчин|шинк|окорок|ham=|schinken|szynk|prosciutto|jamón|jamon|jambon', 145, 21, 6, 1.5),
  food('колбас|сосиск|сардельк|ковбас|sausage|wurst|würstchen|kiełbas|parówk|salsicc|salame|salami|салями|salchich|chorizo|чоризо|saucisse|saucisson|шұжық', 280, 12, 25, 1.5),

  // Fish and seafood
  food('лосос|сёмг|семг|форел|кеты|кета|горбуш|salmon|trout|lachs|forelle|łosoś|losos|pstrąg|salmone|trota|salmón|trucha|saumon|truite|албырт', 208, 20, 13, 0),
  food('тунец|тунц|тунця|tuna|thunfisch|tuńczyk|tonno|atún|thon', 116, 26, 1, 0),
  food('кревет|креветк|shrimp|prawn|garnel|krewet|gamber|gamba|langostino|crevette', 99, 24, 0.3, 0.2),
  food('рыб|риб|треск|минтай|хек|судак|тилапи|пангасиус|камбал|fish|fisch|ryba|ryby|pesce|pescado|poisson|cod=|kabeljau|dorsz|merluzzo|bacalao|cabillaud|merlu|балық', 82, 18, 0.7, 0),

  // Flour, grains, pasta, bread
  food('кукурузн мук|мук кукурузн|рисов мук|мук рисов|ржан мук|мук ржан|мука|муки|муку|мукой|борошн|flour|cornmeal|mehl|mąka|mąki|farina|harina|farine|ұн=|ұны|ұнын', 364, 10.3, 1, 76),
  food('крахмал|крохмал|кукуруз крахмал|starch|cornstarch|stärke|skrobi|amido|almidón|maicena|maizena|fécule', 381, 0.3, 0.1, 91),
  food('манк|манн круп|манна крупа|semolina|grieß|griess|kasza manna|semolino|sémola|semoule', 333, 10.3, 1, 70.6),
  food('отварн рис|варен рис|cooked rice|gekocht reis|ryż ugotowany|riso cotto|arroz cocido|riz cuit', 130, 2.7, 0.3, 28),
  food('рис=|риса|рисом|рису|rice|reis|ryż|ryzu|riso=|arroz|riz=|күріш', 360, 6.7, 0.7, 79),
  food('гречк|гречн|гречан|buckwheat|buchweizen|gryk|kasza gryczana|grano saraceno|alforfón|sarrasin|қарақұмық', 343, 12.6, 3.3, 62),
  food('овсян|овес|вівсян|oat|oats|hafer|owsian|avena|avoine|сұлы', 379, 13, 6.5, 67),
  food('пшен|пшон|millet|hirse|kasza jaglana|miglio|mijo|тары', 348, 11.5, 3.3, 69),
  food('перлов|перлов круп|ячнев|pearl barley|perlgraupen|pęczak|orzo perlato|cebada|orge', 320, 9.3, 1.1, 73.7),
  food('булгур|кускус|киноа|кіноа|bulgur|couscous|quinoa|kuskus|komosa|cuscús|boulgour', 360, 13, 2, 70),
  food('макарон|спагетти|спагеті|паста=|пасту|лапш|локшин|вермишел|рожки|перья|пенне|фузилли|тальятелле|pasta=|spaghetti|nudel|noodle|makaron|penne|fusilli|tagliatelle|fideo|pâtes|pates=', 371, 13, 1.5, 75),
  food('панировочн|сухар панир|панірувальн|breadcrumb|panko|paniermehl|semmelbrösel|bułka tarta|pangrattato|pan rallado|chapelure', 395, 13, 5, 72),
  food('хлеб|хлеба|хліб|батон|багет|bread|brot|toast|chleb|bułk|pane=|pan=|pain=|baguette|нан=', 265, 9, 3.2, 49, { piece: 30 }),
  food('лаваш|тортиль|tortilla|wrap=|lavash|piadina', 290, 8, 4, 54, { piece: 60 }),

  // Legumes
  food('чечевиц|сочевиц|lentil|linsen|soczewic|lenticch|lentej|lentille|жасымық', 352, 24.6, 1.1, 63),
  food('нут=|нута|нутом|chickpea|kichererbs|ciecierzyc|ceci=|garbanzo|pois chiche|ноқат', 364, 19, 6, 61),
  food('фасол|квасол|beans|bohnen|fasol|fagiol|alubia|judía|frijol|haricot|үрме бұршақ', 333, 23, 0.8, 60),
  food('горош|зелен горош|peas=|green peas|erbsen|groszek|piselli|guisantes|petits pois|бұршақ', 81, 5.4, 0.4, 14.5),
  food('тофу|tofu', 76, 8, 4.8, 1.9),

  // Vegetables
  food('кукуруз|кукурудз|corn=|sweetcorn|mais=|kukurydz|maíz|maïs|жүгері', 86, 3.2, 1.2, 19),
  food('картоф|картошк|картопл|potato|potatoes|kartoffel|ziemniak|ziemniaki|patat|pomme de terre|pommes de terre|картоп', 77, 2, 0.1, 17, { piece: 130 }),
  food('батат|sweet potato|süßkartoffel|batat=|patata dolce|boniato|batata|patate douce', 86, 1.6, 0.1, 20, { piece: 200 }),
  food('морков|моркв|carrot|karotte|möhre|mohrrübe|marchew|marchwi|carota|carote|zanahori|carotte|сәбіз', 41, 0.9, 0.2, 9.6, { piece: 80 }),
  food('лук=|лука|луком|луку|лук-порей|луковиц|цибул|onion|zwiebel|lauch|porree|cebul|cipoll|porro|cebolla|puerro|oignon|poireau|échalote|шалот|пияз', 40, 1.1, 0.1, 9.3, { piece: 90 }),
  food('чеснок|чеснок|чеснока|часник|garlic|knoblauch|czosnek|czosnku|aglio|ajo=|ajos=|ail=|сарымсақ', 149, 6.4, 0.5, 33, { piece: 5 }),
  food('томатн паст|паст томатн|tomato paste|tomato purée|tomatenmark|koncentrat pomidor|concentrato pomodoro|concentrato di pomodoro|tomate concentrado|concentré tomate|concentré de tomate|қызанақ паст', 82, 4.3, 0.5, 19),
  food('кетчуп|ketchup|томатн соус|соус томатн|tomato sauce|tomatensauce|sos pomidorowy|salsa di pomodoro|salsa de tomate|sauce tomate|passata|пассата', 100, 1.5, 0.2, 22),
  food('помидор|томат|tomato|tomatoes|tomate|pomidor|pomodor|jitomate|қызанақ|черри', 18, 0.9, 0.2, 3.9, { piece: 120 }),
  food('огур|огірк|огірок|cucumber|gurke|ogór|ogórek|cetriol|pepino|concombre|қияр', 15, 0.7, 0.1, 3.6, { piece: 120 }),
  food('болгар перец|перец болгар|сладк перец|перец сладк|болгарськ перець|солодк перець|bell pepper|sweet pepper|paprikaschote|papryka|peperon|pimiento|poivron|болгар бұрыш', 31, 1, 0.3, 6, { piece: 150 }),
  food('цветн капуст|капуст цветн|цвітн капуст|cauliflower|blumenkohl|kalafior|cavolfiore|coliflor|chou-fleur|chou fleur|түрлі түсті қырыққабат', 25, 1.9, 0.3, 5),
  food('брокколи|броколі|broccoli|brokkoli|brokuł|brócoli|brocoli', 34, 2.8, 0.4, 7),
  food('капуст|cabbage|kohl=|weißkohl|kapust|cavolo|cavoli|repollo|col=|chou=|қырыққабат', 25, 1.3, 0.1, 5.8),
  food('кабач|цукин|цукін|zucchini|courgette|cukini|cukinia|calabacín|calabacin', 17, 1.2, 0.3, 3.1, { piece: 250 }),
  food('баклажан|eggplant|aubergine|bakłażan|melanzan|berenjena|баклажан', 25, 1, 0.2, 6, { piece: 300 }),
  food('гриб|шампиньон|шампіньйон|печериц|вешенк|mushroom|champignon|pilz|pilze|pieczark|grzyb|fungh|champiñ|seta=|setas=|саңырауқұлақ', 22, 3.1, 0.3, 3.3),
  food('свекл|свёкл|буряк|beet|beetroot|rote bete|rote beete|burak|buraki|barbabietol|remolach|betterave|қызылша', 43, 1.6, 0.2, 10, { piece: 200 }),
  food('тыкв|гарбуз|pumpkin|squash|kürbis|dynia|dyni=|zucca|calabaza|potiron|citrouille|асқабақ', 26, 1, 0.1, 6.5),
  food('шпинат|spinach|spinat|szpinak|spinaci|espinaca|épinard|epinard', 23, 2.9, 0.4, 3.6),
  food('сельдер|селер|celery|sellerie|seler|sedano|apio|céleri|celeri|балдыркөк', 16, 0.7, 0.2, 3),
  food('редис|редьк|radish|radieschen|rzodkiew|ravanell|rábano|radis', 16, 0.7, 0.1, 3.4),
  food('салат|листья салат|lettuce|salat|sałat|lattuga|insalata|lechuga|laitue|руккол|rucola|arugula|roquette', 15, 1.4, 0.2, 2.9),
  food('укроп|кріп|петрушк|петрушк|кинз|кінз|зелен|базилик|базилік|мят|м\'ят|dill|parsley|cilantro|coriander|basil|mint=|dill=|petersilie|koriander|basilikum|minze|koperek|koper|pietruszk|kolendr|bazylia|mięt|prezzemol|basilico|menta|perejil|cilantro|albahaca|persil|aneth|basilic|coriandre|menthe|аскөк|ақжелкен|жалбыз', 40, 3, 0.5, 7),
  food('авокадо|avocado|awokado|aguacate|avocat', 160, 2, 14.7, 8.5, { piece: 150 }),
  food('оливк|маслин|olive|oliven|oliwk|oliv|aceituna|olives', 115, 0.8, 10.7, 6.3),

  // Fruit and berries
  food('лимон сок|сок лимон|лимонн сок|lemon juice|zitronensaft|sok z cytryny|succo di limone|zumo de limón|jugo de limón|jus de citron|лимон шырын', 22, 0.4, 0.2, 6.9),
  food('лимон|лайм|lemon|lime=|limes=|zitrone|limette|cytryn|limonk|limone|lime|limón|lima=|citron|лимон', 29, 1.1, 0.3, 9, { piece: 100 }),
  food('апельсин|мандарин|orange|apfelsine|mandarine|pomarańcz|mandaryn|arancia|mandarino|naranja|mandarina|clementine|клементин|апельсин', 47, 0.9, 0.1, 12, { piece: 150 }),
  food('яблок|яблук|apple|apfel|äpfel|jabłk|mela=|mele=|manzana|pomme=|pommes=|алма', 52, 0.3, 0.2, 14, { piece: 180 }),
  food('груш|pear|birne|grusz|pera=|pere=|poire|алмұрт', 57, 0.4, 0.1, 15, { piece: 170 }),
  food('банан|banana|banane|banan|plátano|platano', 89, 1.1, 0.3, 23, { piece: 120 }),
  food('ягод|клубник|земляник|малин|черник|голубик|смородин|вишн|черешн|клюкв|брусник|полуниц|ожин|berry|berries|strawberr|raspberr|blueberr|cherry|cherries|beeren|erdbeer|himbeer|heidelbeer|kirsch|johannisbeer|truskawk|malin|jagod|borówk|wiśni|czereśn|fragol|lampon|mirtill|ciliegi|frutti di bosco|fresa|frambues|arándan|cereza|fraise|framboise|myrtille|cerise|жидек|құлпынай|таңқурай|шие', 50, 0.8, 0.4, 11),
  food('изюм|родзинк|курага|чернослив|финик|сухофрукт|raisin|rosine|rodzynk|uvetta|pasas|dried apricot|prune|dates=|datteln|daktyl|datter|dátil|pruneau|меіз|өрік', 299, 3, 0.5, 79),

  // Nuts and seeds
  food('арахис паст|арахісов паст|peanut butter|erdnussbutter|masło orzechowe|burro di arachidi|crema de cacahuete|mantequilla de maní|beurre de cacahuète', 588, 25, 50, 20),
  food('кокос|coconut|kokos|cocco|coco=|noix de coco', 660, 6.9, 64, 24),
  food('орех|горіх|горіш|миндал|мигдал|фундук|кешью|кеш\'ю|фисташ|фісташ|арахис|арахіс|кедров|nut=|nuts=|walnut|almond|hazelnut|cashew|pistachio|peanut|pecan|nuss|nüss|mandel|erdnuss|haselnuss|orzech|orzeszk|migdał|nerkowc|pistacj|noci=|noce=|mandorl|nocciol|anacard|pistacch|arachid|nuez|nueces|almendr|avellan|anacardo|pistacho|cacahuete|maní|noix|amande|noisette|cajou|pistache|cacahuète|жаңғақ|бадам', 620, 18, 58, 13),
  food('семечк|семен|насінн|кунжут|льнян|лен=|чиа=|seed|seeds|sesame|flax|chia|samen|kerne|kürbiskern|sonnenblumenkern|pinienkern|sesam|leinsamen|pestki|nasion|sezam|siemię|semi=|sesamo|semill|sésamo|graine|sésame|күнжіт|зығыр|дән', 580, 20, 50, 15),

  // Sweet and baking
  food('сахар|цукор|цукр|sugar|zucker|cukier|cukru|zucchero|azúcar|azucar|sucre|қант', 398, 0, 0, 99.7),
  food('мёд|мед=|меда|медом|мёда|honey|honig|miód|miodu|miele|miel=|бал=|балы', 304, 0.3, 0, 82, { density: 1.4 }),
  food('сироп|сіроп|syrup|sirup|syrop|sciroppo|sirope|sirop|шәрбат', 280, 0, 0, 70, { density: 1.3 }),
  food('варень|джем|повидл|конфитюр|jam=|jams=|marmalade|marmelade|konfitüre|konfitur|dżem|powidł|marmellat|confettur|mermelad|confiture|тосап', 260, 0.4, 0, 68),
  food('шоколад|chocolate|schokolade|czekolad|cioccolat|chocolat|шоколад', 546, 5, 31, 61),
  food('какао|cocoa|kakao|cacao', 289, 24, 15, 10),
  food('разрыхл|розпушувач|baking powder|backpulver|proszek do pieczenia|lievito per dolci|levadura química|polvo para hornear|levure chimique|көтергіш', 53, 0, 0, 28),
  food('сода|baking soda|natron|soda oczyszczona|bicarbonat', 0, 0, 0, 0),
  food('дрожж|дріжд|yeast|hefe|drożdż|lievito|levadura|levure|ашытқы', 325, 40, 7, 41),
  food('желатин|gelatin|gelatine|żelatyn|gelatina|gélatine|желатин', 355, 87, 0, 0),
  food('ванил|vanill|vanilla|wanili|vaniglia|vainilla|vanille', 288, 0, 0, 72),

  // Spices, sauces and liquids
  food('соль|соли|солью|сіль|солі|salt|salz|sól|soli|sale=|sal=|sel=|тұз', 0, 0, 0, 0),
  food('черн перец|черн перц|перец черн|перц черн|молот перец|перец молот|чорн перець|перець чорн|black pepper|ground pepper|pfeffer|pieprz|pepe nero|pepe=|pimienta|poivre|қара бұрыш', 251, 10, 3.3, 64),
  food('кориц|кориця|cinnamon|zimt|cynamon|cannell|canela|cannelle|даршын', 247, 4, 1.2, 81),
  food('соев соус|соус соев|соєв соус|soy sauce|sojasoße|sojasauce|sos sojowy|salsa di soia|salsa de soja|sauce soja', 53, 8, 0, 5, { density: 1.2 }),
  food('горчиц|гірчиц|mustard|senf|musztard|senape|mostaza|moutarde|қыша', 162, 9.9, 12.7, 5.3),
  food('уксус|оцет|vinegar|essig|ocet|aceto|vinagre|vinaigre|сірке', 18, 0, 0, 0.9),
  food('вин=|вино|вина|вином|wine|wein|wino|vino|vin=|шарап', 85, 0.1, 0, 2.6),
  food('бульон|бульйон|broth|stock=|brühe|fond=|bulion|brodo|caldo|bouillon|сорпа', 10, 1, 0.5, 0.5),
  food('сок=|сока|соку|сік|соку|juice|saft|sok=|succo|zumo|jugo|jus=|шырын', 45, 0.5, 0.1, 10.5),
  food('вода|воды|воду|водой|вод=|water|wasser|woda|wody|wodę|acqua|agua|eau=|су=|суы', 0, 0, 0, 0),
];
