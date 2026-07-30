-- =========================================================
-- Step 15 Migration: Wallet + Withdrawals
-- =========================================================

-- Create wallet_settings table
CREATE TABLE IF NOT EXISTS wallet_settings (
    id                     int primary key default 1 check (id = 1),
    min_withdrawal         numeric(12,2) not null default 20000.00,
    withdrawal_fee_pct     numeric(5,2) not null default 2.00
);

INSERT INTO wallet_settings (id, min_withdrawal, withdrawal_fee_pct)
VALUES (1, 20000.00, 2.00)
ON CONFLICT (id) DO NOTHING;

-- 1. Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    distributor_id  uuid primary key references profiles(id) on delete cascade,
    balance         numeric(12,2) not null default 0.00 check (balance >= 0),
    updated_at      timestamptz not null default now()
);

-- 2. Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              uuid primary key default uuid_generate_v4(),
    distributor_id  uuid not null references profiles(id) on delete cascade,
    type            text not null check (type in ('credit', 'debit')),
    source_type     text not null check (source_type in ('commission', 'team_bonus', 'withdrawal', 'manual_adjustment')),
    source_id       uuid,
    amount          numeric(12,2) not null check (amount > 0),
    balance_after   numeric(12,2) not null check (balance_after >= 0),
    created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_distributor ON wallet_transactions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at);

-- 3. Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id              uuid primary key default uuid_generate_v4(),
    distributor_id  uuid not null references profiles(id) on delete cascade,
    amount          numeric(12,2) not null check (amount > 0),
    method          text not null check (method in ('bank', 'mobile_money')),
    payout_details  text not null, -- JSON or text representation
    status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
    requested_at    timestamptz not null default now(),
    reviewed_by     uuid references profiles(id) on delete set null,
    reviewed_at     timestamptz,
    notes           text
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_distributor ON withdrawal_requests(distributor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- wallets policies
DROP POLICY IF EXISTS wallets_self_select ON wallets;
CREATE POLICY wallets_self_select ON wallets FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS wallets_staff_all ON wallets;
CREATE POLICY wallets_staff_all ON wallets FOR ALL USING (public.is_staff());

-- wallet_transactions policies
DROP POLICY IF EXISTS wallet_transactions_self_select ON wallet_transactions;
CREATE POLICY wallet_transactions_self_select ON wallet_transactions FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS wallet_transactions_staff_all ON wallet_transactions;
CREATE POLICY wallet_transactions_staff_all ON wallet_transactions FOR ALL USING (public.is_staff());

-- withdrawal_requests policies
DROP POLICY IF EXISTS withdrawal_requests_self_select ON withdrawal_requests;
CREATE POLICY withdrawal_requests_self_select ON withdrawal_requests FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS withdrawal_requests_self_insert ON withdrawal_requests;
CREATE POLICY withdrawal_requests_self_insert ON withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = distributor_id);

DROP POLICY IF EXISTS withdrawal_requests_staff_all ON withdrawal_requests;
CREATE POLICY withdrawal_requests_staff_all ON withdrawal_requests FOR ALL USING (public.is_staff());

-- 6. Trigger Function to auto-credit wallet balance on commission inserts
CREATE OR REPLACE FUNCTION public.handle_commission_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_balance numeric(12,2);
  v_source_type text;
BEGIN
  -- Determine source_type based on commissions fields
  -- team_bonus has commissions.bonus_type = 'team_bonus'
  IF NEW.bonus_type = 'team_bonus' THEN
    v_source_type := 'team_bonus';
  ELSE
    v_source_type := 'commission';
  END IF;

  -- Ensure wallet row exists for the beneficiary
  INSERT INTO public.wallets (distributor_id, balance, updated_at)
  VALUES (NEW.beneficiary_id, 0.00, now())
  ON CONFLICT (distributor_id) DO NOTHING;

  -- Atomically add commission amount to the wallet balance
  UPDATE public.wallets
  SET balance = balance + NEW.amount,
      updated_at = now()
  WHERE distributor_id = NEW.beneficiary_id
  RETURNING balance INTO v_balance;

  -- Log transaction in the ledger
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
    NEW.beneficiary_id,
    'credit',
    v_source_type,
    NEW.id,
    NEW.amount,
    v_balance,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_commissions_on_insert ON public.commissions;
CREATE TRIGGER trg_commissions_on_insert
AFTER INSERT ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_commission_insert();

-- 7. Atomic Withdrawal Request RPC
-- Subtracts the amount from available balance immediately to reserve it
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_distributor_id uuid,
  p_amount numeric,
  p_method text,
  p_payout_details text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_balance numeric;
  v_request_id uuid;
BEGIN
  -- Ensure wallet row exists
  INSERT INTO public.wallets (distributor_id, balance)
  VALUES (p_distributor_id, 0.00)
  ON CONFLICT (distributor_id) DO NOTHING;

  -- Deduct amount atomically
  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE distributor_id = p_distributor_id AND balance >= p_amount
  RETURNING balance INTO v_wallet_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance for withdrawal';
  END IF;

  -- Insert withdrawal request
  INSERT INTO public.withdrawal_requests (
    distributor_id,
    amount,
    method,
    payout_details,
    status,
    requested_at
  )
  VALUES (
    p_distributor_id,
    p_amount,
    p_method,
    p_payout_details,
    'pending',
    now()
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 8. Atomic Withdrawal Approval RPC
-- Validates request, updates status, and logs a debit ledger transaction
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_request_id uuid,
  p_reviewed_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_distributor_id uuid;
  v_amount numeric;
  v_status text;
  v_balance numeric;
BEGIN
  SELECT distributor_id, amount, status
  INTO v_distributor_id, v_amount, v_status
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal request is not pending';
  END IF;

  -- Update request status
  UPDATE public.withdrawal_requests
  SET status = 'approved',
      reviewed_by = p_reviewed_by,
      reviewed_at = now()
  WHERE id = p_request_id;

  -- Get current balance (already debited during request)
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE distributor_id = v_distributor_id;

  -- Write ledger debit record
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
    v_distributor_id,
    'debit',
    'withdrawal',
    p_request_id,
    v_amount,
    v_balance,
    now()
  );
END;
$$;

-- 9. Atomic Withdrawal Rejection RPC
-- Returns the reserved amount back to the balance
CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_request_id uuid,
  p_reviewed_by uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_distributor_id uuid;
  v_amount numeric;
  v_status text;
BEGIN
  SELECT distributor_id, amount, status
  INTO v_distributor_id, v_amount, v_status
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal request is not pending';
  END IF;

  -- Update request status
  UPDATE public.withdrawal_requests
  SET status = 'rejected',
      reviewed_by = p_reviewed_by,
      reviewed_at = now(),
      notes = p_notes
  WHERE id = p_request_id;

  -- Refund the reserved amount
  UPDATE public.wallets
  SET balance = balance + v_amount,
      updated_at = now()
  WHERE distributor_id = v_distributor_id;
END;
$$;
