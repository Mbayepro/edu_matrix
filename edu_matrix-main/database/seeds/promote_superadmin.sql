-- Promote a specific user to superadmin by email
-- This must be run in Supabase SQL Editor

DO $$
DECLARE
  target_email TEXT := 'mbayeadama669@gmail.com';
  target_user_id UUID;
BEGIN
  -- 1. Find user ID from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', target_email;
  ELSE
    -- 2. Update role in public.profiles
    UPDATE public.profiles
    SET role = 'superadmin'
    WHERE user_id = target_user_id;
    
    RAISE NOTICE 'User % promoted to superadmin', target_email;
  END IF;
END $$;
