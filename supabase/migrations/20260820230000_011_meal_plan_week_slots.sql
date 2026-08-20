-- Calendar week + meal slots on the meal plan

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS week_start DATE;

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS meal_slot TEXT
    CHECK (meal_slot IS NULL OR meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack'));
