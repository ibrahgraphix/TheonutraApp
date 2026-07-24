-- =========================================================
-- Step 19 Migration: Notification System
-- =========================================================

-- 1. Create notification_type enum
CREATE TYPE notification_type AS ENUM (
  'commission_earned',
  'team_bonus_earned',
  'withdrawal_status',
  'kyc_status',
  'new_referral',
  'manual_bonus',
  'system'
);

-- 2. Drop notifications table if it exists (to handle schema changes)
DROP TABLE IF EXISTS notifications CASCADE;

-- 3. Create notifications table
CREATE TABLE notifications (
    id              uuid primary key default uuid_generate_v4(),
    distributor_id  uuid not null references profiles(id) on delete cascade,
    type            notification_type not null,
    title           text not null,
    body            text not null,
    data            jsonb, -- Additional data for deep-linking (e.g. {amount, source_id})
    is_read         boolean not null default false,
    created_at      timestamptz not null default now()
);

-- 3. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_distributor ON notifications(distributor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_distributor_read ON notifications(distributor_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Distributors can only see their own notifications
DROP POLICY IF EXISTS notifications_self_select ON notifications;
CREATE POLICY notifications_self_select ON notifications FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS notifications_self_update ON notifications;
CREATE POLICY notifications_self_update ON notifications FOR UPDATE USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS notifications_self_insert ON notifications;
CREATE POLICY notifications_self_insert ON notifications FOR INSERT WITH CHECK (auth.uid() = distributor_id);

-- Staff can view all notifications
DROP POLICY IF EXISTS notifications_staff_all ON notifications;
CREATE POLICY notifications_staff_all ON notifications FOR ALL USING (public.is_staff());

-- 6. Function to create a notification (called from application layer)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_distributor_id uuid,
  p_type notification_type,
  p_title text,
  p_body text,
  p_data jsonb default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    distributor_id,
    type,
    title,
    body,
    data,
    is_read
  )
  VALUES (
    p_distributor_id,
    p_type,
    p_title,
    p_body,
    p_data,
    false
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 7. Function to mark a notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_distributor_id uuid,
  p_notification_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id
    AND distributor_id = p_distributor_id;
END;
$$;

-- 8. Function to mark all notifications as read for a distributor
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_distributor_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE distributor_id = p_distributor_id
    AND is_read = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9. Function to get unread count for a distributor
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_distributor_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT COUNT(*)
FROM public.notifications
WHERE distributor_id = p_distributor_id
  AND is_read = false;
$$;
