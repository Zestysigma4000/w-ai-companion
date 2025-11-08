-- Fix nullable user_id columns for data integrity
-- This prevents orphaned records and ensures RLS policies work correctly

-- Make user_id NOT NULL on conversations table
ALTER TABLE public.conversations 
ALTER COLUMN user_id SET NOT NULL;

-- Make user_id NOT NULL on messages table
ALTER TABLE public.messages 
ALTER COLUMN user_id SET NOT NULL;