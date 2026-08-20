-- Personal cookbook: notes, last cooked, shelves, meal plan

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_cooked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS meal_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  day_count INT NOT NULL DEFAULT 7 CHECK (day_count BETWEEN 1 AND 7),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  day_index INT CHECK (day_index IS NULL OR (day_index >= 0 AND day_index <= 6)),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS meal_plan_entries_user_idx ON meal_plan_entries (user_id);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meal_plans" ON meal_plans;
CREATE POLICY "select_own_meal_plans" ON meal_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_meal_plans" ON meal_plans;
CREATE POLICY "insert_own_meal_plans" ON meal_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_meal_plans" ON meal_plans;
CREATE POLICY "update_own_meal_plans" ON meal_plans FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_meal_plans" ON meal_plans;
CREATE POLICY "delete_own_meal_plans" ON meal_plans FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_meal_plan_entries" ON meal_plan_entries;
CREATE POLICY "select_own_meal_plan_entries" ON meal_plan_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "insert_own_meal_plan_entries" ON meal_plan_entries;
CREATE POLICY "insert_own_meal_plan_entries" ON meal_plan_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_meal_plan_entries" ON meal_plan_entries;
CREATE POLICY "update_own_meal_plan_entries" ON meal_plan_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_meal_plan_entries" ON meal_plan_entries;
CREATE POLICY "delete_own_meal_plan_entries" ON meal_plan_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE meal_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE meal_plan_entries TO authenticated;
