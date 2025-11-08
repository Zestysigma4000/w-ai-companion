-- Add user_id columns to conversations and messages tables
ALTER TABLE public.conversations 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing data to set user_id to NULL (will be handled by auth)
-- Future inserts will require user_id

-- Drop existing permissive RLS policies
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON public.messages;

-- Create secure RLS policies for conversations
CREATE POLICY "Users can view their own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() = (
    SELECT user_id FROM public.conversations WHERE id = conversation_id
  )
);

CREATE POLICY "Users can create messages in their conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.conversations WHERE id = conversation_id
  )
);

CREATE POLICY "Users can update messages in their conversations"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() = (
    SELECT user_id FROM public.conversations WHERE id = conversation_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.conversations WHERE id = conversation_id
  )
);

CREATE POLICY "Users can delete messages in their conversations"
ON public.messages
FOR DELETE
TO authenticated
USING (
  auth.uid() = (
    SELECT user_id FROM public.conversations WHERE id = conversation_id
  )
);