-- Shopping list (synced like meal plans)

CREATE TABLE IF NOT EXISTS shopping_lists (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL(12,3),
  unit TEXT,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shopping_items_user_idx ON shopping_items (user_id);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_shopping_lists" ON shopping_lists;
CREATE POLICY "select_own_shopping_lists" ON shopping_lists FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_shopping_lists" ON shopping_lists;
CREATE POLICY "insert_own_shopping_lists" ON shopping_lists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_shopping_lists" ON shopping_lists;
CREATE POLICY "update_own_shopping_lists" ON shopping_lists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_shopping_lists" ON shopping_lists;
CREATE POLICY "delete_own_shopping_lists" ON shopping_lists FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_shopping_items" ON shopping_items;
CREATE POLICY "select_own_shopping_items" ON shopping_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_shopping_items" ON shopping_items;
CREATE POLICY "insert_own_shopping_items" ON shopping_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_shopping_items" ON shopping_items;
CREATE POLICY "update_own_shopping_items" ON shopping_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_shopping_items" ON shopping_items;
CREATE POLICY "delete_own_shopping_items" ON shopping_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shopping_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shopping_items TO authenticated;
