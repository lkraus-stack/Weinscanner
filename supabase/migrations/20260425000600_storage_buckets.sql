INSERT INTO storage.buckets (id, name, public)
VALUES
  ('wine-labels', 'wine-labels', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own labels'
  ) THEN
    CREATE POLICY "Users can upload own labels" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'wine-labels'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read own labels'
  ) THEN
    CREATE POLICY "Users can read own labels" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'wine-labels'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public avatars are readable'
  ) THEN
    CREATE POLICY "Public avatars are readable" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'avatars');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own avatar'
  ) THEN
    CREATE POLICY "Users can upload own avatar" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;
