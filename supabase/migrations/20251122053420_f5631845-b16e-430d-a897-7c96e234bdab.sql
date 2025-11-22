-- Create activity_logs table for real-time console logging
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error'))
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view all logs
CREATE POLICY "Owners can view all logs"
  ON public.activity_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role));

-- System can insert logs
CREATE POLICY "System can insert logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Add index for performance
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_event_type ON public.activity_logs(event_type);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;