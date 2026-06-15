CREATE TABLE custom_conversions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  name_de text NOT NULL,
  cup_weight numeric NOT NULL,
  tbsp_weight numeric NOT NULL,
  tsp_weight numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_custom_conversions" ON custom_conversions
  FOR SELECT TO anon USING (true);

CREATE POLICY "public_insert_custom_conversions" ON custom_conversions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "public_delete_custom_conversions" ON custom_conversions
  FOR DELETE TO anon USING (true);
