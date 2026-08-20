-- The interface now offers Ukrainian, Polish, Italian, Spanish and French, and the recipe
-- importer translates into whichever of them is selected. The original CHECK constraints
-- only allowed ru/en/de, so any save in a new language would be rejected.

ALTER TABLE recipe_translations DROP CONSTRAINT IF EXISTS recipe_translations_language_check;
ALTER TABLE recipe_translations
  ADD CONSTRAINT recipe_translations_language_check
  CHECK (language IN ('ru', 'en', 'de', 'uk', 'pl', 'it', 'es', 'fr'));

ALTER TABLE ingredient_translations DROP CONSTRAINT IF EXISTS ingredient_translations_language_check;
ALTER TABLE ingredient_translations
  ADD CONSTRAINT ingredient_translations_language_check
  CHECK (language IN ('ru', 'en', 'de', 'uk', 'pl', 'it', 'es', 'fr'));

ALTER TABLE step_translations DROP CONSTRAINT IF EXISTS step_translations_language_check;
ALTER TABLE step_translations
  ADD CONSTRAINT step_translations_language_check
  CHECK (language IN ('ru', 'en', 'de', 'uk', 'pl', 'it', 'es', 'fr'));
