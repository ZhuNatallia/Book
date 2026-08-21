-- Recipe photos and avatars in Storage. DB keeps a short public URL.
-- Apply in Supabase SQL Editor (013/014 already applied).
-- Paths: recipe-photos/{user_id}/{recipe_id}.jpg
--         avatars/{user_id}/avatar.jpg

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'recipe-photos',
    'recipe-photos',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  ),
  (
    'avatars',
    'avatars',
    true,
    1048576,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "recipe_photos_public_read" ON storage.objects;
CREATE POLICY "recipe_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-photos');

DROP POLICY IF EXISTS "recipe_photos_insert_own" ON storage.objects;
CREATE POLICY "recipe_photos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recipe-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "recipe_photos_update_own" ON storage.objects;
CREATE POLICY "recipe_photos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'recipe-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recipe-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "recipe_photos_delete_own" ON storage.objects;
CREATE POLICY "recipe_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'recipe-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
