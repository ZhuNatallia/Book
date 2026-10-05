-- Shared cache of per-100g nutrition looked up by the nutrition edge function, so every
-- product hits USDA / the LLM once for all users. Only the service role reads and writes it.

CREATE TABLE IF NOT EXISTS nutrition_cache (
  name_key text PRIMARY KEY,
  kcal numeric,
  protein numeric,
  fat numeric,
  carbs numeric,
  unit_grams jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_cache ENABLE ROW LEVEL SECURITY;
