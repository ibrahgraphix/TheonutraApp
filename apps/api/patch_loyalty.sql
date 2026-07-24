-- =========================================================
-- Step 22 Migration: Loyalty Points + Audit Log (patched)
-- =========================================================

-- profiles.loyalty_balance (unchanged, already correct)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'loyalty_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN loyalty_balance numeric(12,2) not null default 0.00;
    ALTER TABLE profiles ADD CONSTRAINT check_loyalty_balance_nonnegative CHECK (loyalty_balance >= 0);
  END IF;
END $$;

-- Patch loyalty_transactions to add what's missing, keep existing columns as-is
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS type text not null default 'earn';
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS balance_after numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'loyalty_transactions' AND constraint_name = 'loyalty_transactions_type_check'
  ) THEN
    ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_type_check
      CHECK (type in ('earn', 'redeem', 'adjustment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_profile ON loyalty_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON loyalty_transactions(created_at);

-- audit_log (new table, unaffected by prior errors)
CREATE TABLE IF NOT EXISTS audit_log (
    id              uuid primary key default uuid_generate_v4(),
    actor_id        uuid references profiles(id) on delete set null,
    action          text not null,
    entity_type     text not null,
    entity_id       uuid,
    changes         jsonb,
    created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_transactions_self_select ON loyalty_transactions;
CREATE POLICY loyalty_transactions_self_select ON loyalty_transactions
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS loyalty_transactions_staff_all ON loyalty_transactions;
CREATE POLICY loyalty_transactions_staff_all ON loyalty_transactions
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS audit_log_staff_select ON audit_log;
CREATE POLICY audit_log_staff_select ON audit_log
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS audit_log_staff_insert ON audit_log;
CREATE POLICY audit_log_staff_insert ON audit_log
  FOR INSERT WITH CHECK (public.is_staff());

-- RPC updated to use profile_id (matches existing column)
CREATE OR REPLACE FUNCTION public.credit_loyalty_points(
  p_distributor_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_points numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
BEGIN
  UPDATE public.profiles
  SET loyalty_balance = COALESCE(loyalty_balance, 0) + p_points
  WHERE id = p_distributor_id
  RETURNING loyalty_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distributor not found';
  END IF;

  INSERT INTO public.loyalty_transactions (
    profile_id,
    type,
    source_type,
    related_order_id,
    points,
    balance_after,
    created_at
  )
  VALUES (
    p_distributor_id,
    'earn',
    p_source_type,
    p_source_id,
    p_points,
    v_balance,
    now()
  );
END;
$$;