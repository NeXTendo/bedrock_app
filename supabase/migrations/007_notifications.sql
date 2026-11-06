-- Create user_push_tokens table to map users to their devices
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT PRIMARY KEY,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, push_token)
);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
ON public.user_push_tokens
FOR ALL
USING (auth.uid() = user_id);

-- Create report_follows table
CREATE TABLE IF NOT EXISTS public.report_follows (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, report_id)
);

-- Enable RLS
ALTER TABLE public.report_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can follow/unfollow reports"
ON public.report_follows
FOR ALL
USING (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- 'system', 'report_update', 'follow_alert'
    data JSONB DEFAULT '{}'::jsonb, -- Store report_id, etc.
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Simple index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_report_follows_report_id ON public.report_follows(report_id);
