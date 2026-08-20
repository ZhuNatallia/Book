-- Fridge / pantry inventory

CREATE TABLE IF NOT EXISTS pantry_lists (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(12,3),
  unit TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS pantry_items_user_idx ON pantry_items (user_id);

ALTER TABLE pantry_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pantry_lists" ON pantry_lists;
CREATE POLICY "select_own_pantry_lists" ON pantry_lists FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_pantry_lists" ON pantry_lists;
CREATE POLICY "insert_own_pantry_lists" ON pantry_lists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_pantry_lists" ON pantry_lists;
CREATE POLICY "update_own_pantry_lists" ON pantry_lists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_pantry_lists" ON pantry_lists;
CREATE POLICY "delete_own_pantry_lists" ON pantry_lists FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_pantry_items" ON pantry_items;
CREATE POLICY "select_own_pantry_items" ON pantry_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_pantry_items" ON pantry_items;
CREATE POLICY "insert_own_pantry_items" ON pantry_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_pantry_items" ON pantry_items;
CREATE POLICY "update_own_pantry_items" ON pantry_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_pantry_items" ON pantry_items;
CREATE POLICY "delete_own_pantry_items" ON pantry_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pantry_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pantry_items TO authenticated;
