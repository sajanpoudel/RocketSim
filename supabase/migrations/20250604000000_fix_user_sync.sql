-- Fix user synchronization between auth.users and public.users
-- Migration: 20250604000000_fix_user_sync.sql

-- First, populate existing auth users into public.users table
INSERT INTO public.users (id, email, created_at, updated_at)
SELECT 
    au.id, 
    au.email,
    au.created_at,
    au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
AND au.email IS NOT NULL;

-- Create function to sync user from auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NEW.created_at, NEW.updated_at)
    ON CONFLICT (id) DO UPDATE SET
        email = NEW.email,
        updated_at = NEW.updated_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix user_sessions table to reference auth.users instead of public.users
-- This is safer and more consistent
ALTER TABLE public.user_sessions 
DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;

ALTER TABLE public.user_sessions 
ADD CONSTRAINT user_sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix rockets table to reference auth.users instead of public.users
ALTER TABLE public.rockets 
DROP CONSTRAINT IF EXISTS rockets_user_id_fkey;

ALTER TABLE public.rockets 
ADD CONSTRAINT rockets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix other tables that might have the same issue
ALTER TABLE public.simulations 
DROP CONSTRAINT IF EXISTS simulations_user_id_fkey;

ALTER TABLE public.simulations 
ADD CONSTRAINT simulations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;

ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.analysis_results 
DROP CONSTRAINT IF EXISTS analysis_results_user_id_fkey;

ALTER TABLE public.analysis_results 
ADD CONSTRAINT analysis_results_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update views to use auth.users instead of public.users
DROP VIEW IF EXISTS public.user_activity_summary;
CREATE VIEW public.user_activity_summary AS
SELECT 
    au.id as user_id,
    au.email,
    COUNT(DISTINCT r.id) as rockets_created,
    COUNT(DISTINCT s.id) as simulations_run,
    COUNT(DISTINCT cm.id) as messages_sent,
    MAX(us.last_activity) as last_activity
FROM auth.users au
LEFT JOIN rockets r ON au.id = r.user_id
LEFT JOIN simulations s ON au.id = s.user_id
LEFT JOIN chat_messages cm ON au.id = cm.user_id
LEFT JOIN user_sessions us ON au.id = us.user_id
GROUP BY au.id, au.email;

-- Ensure RLS policies reference auth.uid() correctly
-- (These should already be correct but let's verify)

-- Drop and recreate RLS policies for user_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;  
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Add notification for successful migration
DO $$ 
BEGIN 
    RAISE NOTICE 'User synchronization migration completed successfully!';
    RAISE NOTICE 'All foreign keys now reference auth.users consistently.';
    RAISE NOTICE 'Auto-sync trigger created for new users.';
END $$; 