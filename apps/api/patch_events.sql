-- =========================================================
-- Step 21 Migration: Events (patch to existing table)
-- =========================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_image_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active boolean not null default true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'events' AND constraint_name = 'events_event_type_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_event_type_check
      CHECK (event_type in ('general', 'health_education', 'training', 'product_launch'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_authenticated_select ON events;
DROP POLICY IF EXISTS events_staff_all ON events;

CREATE POLICY events_authenticated_select ON events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY events_staff_all ON events FOR ALL USING (public.is_staff());

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();