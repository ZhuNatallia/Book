-- Per-entry servings on the meal plan

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS servings INT;
