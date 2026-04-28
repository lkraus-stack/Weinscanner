CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_name text;
BEGIN
  profile_name := NULLIF(
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'email',
      NEW.email,
      'Wine Scanner Nutzer'
    ),
    ''
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, profile_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  auth_user auth.users;
  profile_name text;
  profile_row public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO profile_row
  FROM public.profiles
  WHERE id = auth.uid();

  IF FOUND THEN
    RETURN profile_row;
  END IF;

  SELECT *
  INTO auth_user
  FROM auth.users
  WHERE id = auth.uid();

  profile_name := NULLIF(
    COALESCE(
      auth_user.raw_user_meta_data->>'full_name',
      auth_user.raw_user_meta_data->>'name',
      auth_user.raw_user_meta_data->>'email',
      auth_user.email,
      'Wine Scanner Nutzer'
    ),
    ''
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (auth.uid(), profile_name)
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name)
  RETURNING *
  INTO profile_row;

  RETURN profile_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
