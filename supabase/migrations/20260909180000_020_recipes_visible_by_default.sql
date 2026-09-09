-- New and existing recipes are visible to friends unless the owner hides them.

ALTER TABLE recipes
  ALTER COLUMN visible_to_friends SET DEFAULT true;

UPDATE recipes
  SET visible_to_friends = true
  WHERE visible_to_friends IS DISTINCT FROM true;
