-- Allow the same recipe more than once in a meal plan (different days or copies).
ALTER TABLE meal_plan_entries
  DROP CONSTRAINT IF EXISTS meal_plan_entries_user_id_recipe_id_key;
