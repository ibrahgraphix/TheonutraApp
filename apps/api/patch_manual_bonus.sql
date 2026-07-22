-- =========================================================
-- Step 16 Migration: Manual Bonuses
-- =========================================================

-- 1. Extend wallet_transactions source_type check constraint
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_source_type_check 
    CHECK (source_type in ('commission', 'team_bonus', 'withdrawal', 'manual_adjustment', 'manual_bonus'));

-- 2. Create manual_bonuses table
CREATE TABLE IF NOT EXISTS manual_bonuses (
    id              uuid primary key default uuid_generate_v4(),
    distributor_id  uuid not null references profiles(id) on delete cascade,
    bonus_category  text not null check (bonus_category in ('leadership', 'rank_achievement', 'monthly_performance', 'other')),
    amount          numeric(12,2) not null check (amount > 0),
    note            text,
    awarded_by      uuid not null references profiles(id) on delete cascade,
    awarded_at      timestamptz not null default now()
);

-- 3. Create indices
CREATE INDEX IF NOT EXISTS idx_manual_bonuses_distributor ON manual_bonuses(distributor_id);
CREATE INDEX IF NOT EXISTS idx_manual_bonuses_category ON manual_bonuses(bonus_category);
CREATE INDEX IF NOT EXISTS idx_manual_bonuses_awarded_at ON manual_bonuses(awarded_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE manual_bonuses ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS manual_bonuses_self_select ON manual_bonuses;
CREATE POLICY manual_bonuses_self_select ON manual_bonuses 
    FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS manual_bonuses_staff_all ON manual_bonuses;
CREATE POLICY manual_bonuses_staff_all ON manual_bonuses 
    FOR ALL USING (public.is_staff());

-- 6. Trigger Function to auto-credit wallet balance on manual_bonuses inserts
CREATE OR REPLACE FUNCTION public.handle_manual_bonus_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_balance numeric(12,2);
BEGIN
  -- Ensure wallet row exists for the beneficiary
  INSERT INTO public.wallets (distributor_id, balance, updated_at)
  VALUES (NEW.distributor_id, 0.00, now())
  ON CONFLICT (distributor_id) DO NOTHING;

  -- Atomically add manual bonus amount to the wallet balance
  UPDATE public.wallets
  SET balance = balance + NEW.amount,
      updated_at = now()
  WHERE distributor_id = NEW.distributor_id
  RETURNING balance INTO v_balance;

  -- Log transaction in the wallet_transactions ledger
  INSERT INTO public.wallet_transactions (
    distributor_id,
    type,
    source_type,
    source_id,
    amount,
    balance_after,
    created_at
  )
  VALUES (
    NEW.distributor_id,
    'credit',
    'manual_bonus',
    NEW.id,
    NEW.amount,
    v_balance,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_manual_bonuses_on_insert ON public.manual_bonuses;
CREATE TRIGGER trg_manual_bonuses_on_insert
AFTER INSERT ON public.manual_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.handle_manual_bonus_insert();
