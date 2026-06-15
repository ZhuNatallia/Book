-- Recipes table with multilingual support
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'want_to_cook',
  image_url TEXT,
  source_url TEXT,
  servings INT NOT NULL DEFAULT 4,
  calories_per_serving INT,
  protein_per_serving DECIMAL(10,2),
  carbs_per_serving DECIMAL(10,2),
  fat_per_serving DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipe translations (title, description)
CREATE TABLE recipe_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  title TEXT NOT NULL,
  description TEXT,
  UNIQUE(recipe_id, language)
);

-- Recipe ingredients with translations
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  original_text TEXT,
  calories INT DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  carbs DECIMAL(10,2) DEFAULT 0,
  fat DECIMAL(10,2) DEFAULT 0
);

-- Ingredient translations
CREATE TABLE ingredient_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES recipe_ingredients(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  name TEXT NOT NULL,
  UNIQUE(ingredient_id, language)
);

-- Recipe steps with translations
CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  timer_minutes INT
);

-- Step translations
CREATE TABLE step_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES recipe_steps(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en', 'de')),
  instruction TEXT NOT NULL,
  UNIQUE(step_id, language)
);

-- Shopping list items
CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grocery stores and discounts (for sales tracker)
CREATE TABLE grocery_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT
);

CREATE TABLE grocery_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES grocery_stores(id) ON DELETE CASCADE,
  ingredient_keyword TEXT NOT NULL,
  discount_percentage INT,
  original_price DECIMAL(10,2),
  discounted_price DECIMAL(10,2),
  valid_until DATE,
  language TEXT NOT NULL DEFAULT 'ru'
);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipes
CREATE POLICY "select_own_recipes" ON recipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_recipes" ON recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_recipes" ON recipes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_recipes" ON recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for recipe_translations
CREATE POLICY "select_own_recipe_translations" ON recipe_translations FOR SELECT TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_recipe_translations" ON recipe_translations FOR INSERT TO authenticated 
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "update_own_recipe_translations" ON recipe_translations FOR UPDATE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_recipe_translations" ON recipe_translations FOR DELETE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- RLS Policies for recipe_ingredients
CREATE POLICY "select_own_recipe_ingredients" ON recipe_ingredients FOR SELECT TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_recipe_ingredients" ON recipe_ingredients FOR INSERT TO authenticated 
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "update_own_recipe_ingredients" ON recipe_ingredients FOR UPDATE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_recipe_ingredients" ON recipe_ingredients FOR DELETE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- RLS Policies for ingredient_translations
CREATE POLICY "select_own_ingredient_translations" ON ingredient_translations FOR SELECT TO authenticated 
  USING (ingredient_id IN (SELECT id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "insert_own_ingredient_translations" ON ingredient_translations FOR INSERT TO authenticated 
  WITH CHECK (ingredient_id IN (SELECT id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "update_own_ingredient_translations" ON ingredient_translations FOR UPDATE TO authenticated 
  USING (ingredient_id IN (SELECT id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())))
  WITH CHECK (ingredient_id IN (SELECT id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "delete_own_ingredient_translations" ON ingredient_translations FOR DELETE TO authenticated 
  USING (ingredient_id IN (SELECT id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));

-- RLS Policies for recipe_steps
CREATE POLICY "select_own_recipe_steps" ON recipe_steps FOR SELECT TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_recipe_steps" ON recipe_steps FOR INSERT TO authenticated 
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "update_own_recipe_steps" ON recipe_steps FOR UPDATE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_recipe_steps" ON recipe_steps FOR DELETE TO authenticated 
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- RLS Policies for step_translations
CREATE POLICY "select_own_step_translations" ON step_translations FOR SELECT TO authenticated 
  USING (step_id IN (SELECT id FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "insert_own_step_translations" ON step_translations FOR INSERT TO authenticated 
  WITH CHECK (step_id IN (SELECT id FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "update_own_step_translations" ON step_translations FOR UPDATE TO authenticated 
  USING (step_id IN (SELECT id FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())))
  WITH CHECK (step_id IN (SELECT id FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));
CREATE POLICY "delete_own_step_translations" ON step_translations FOR DELETE TO authenticated 
  USING (step_id IN (SELECT id FROM recipe_steps WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())));

-- RLS Policies for shopping_items
CREATE POLICY "select_own_shopping_items" ON shopping_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_shopping_items" ON shopping_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_shopping_items" ON shopping_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_shopping_items" ON shopping_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read for grocery stores and discounts
CREATE POLICY "read_grocery_stores" ON grocery_stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_grocery_discounts" ON grocery_discounts FOR SELECT TO authenticated USING (true);