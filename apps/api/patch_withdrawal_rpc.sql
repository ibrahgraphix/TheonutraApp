-- =========================================================
-- Patch: Add RPC functions for failed and cancelled withdrawals
-- =========================================================

-- RPC: fail_withdrawal (status → failed, refund reserved amount)
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_request_id  uuid,
  p_reviewed_by uuid,
  p_notes       text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_distributor_id uuid;
  v_amount         numeric;
  v_status         text;
BEGIN
  SELECT distributor_id, amount, status
  INTO   v_distributor_id, v_amount, v_status
  FROM   public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal request is not pending'; END IF;

  UPDATE public.withdrawal_requests
  SET status = 'failed', reviewed_by = p_reviewed_by, reviewed_at = now(), notes = p_notes
  WHERE id = p_request_id;

  -- Refund the amount back to wallet
  UPDATE public.wallets
  SET balance = balance + v_amount, updated_at = now()
  WHERE distributor_id = v_distributor_id;
END;
$$;

-- RPC: cancel_withdrawal (status → cancelled, refund reserved amount)
CREATE OR REPLACE FUNCTION public.cancel_withdrawal(
  p_request_id  uuid,
  p_reviewed_by uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_distributor_id uuid;
  v_amount         numeric;
  v_status         text;
BEGIN
  SELECT distributor_id, amount, status
  INTO   v_distributor_id, v_amount, v_status
  FROM   public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal request is not pending'; END IF;

  UPDATE public.withdrawal_requests
  SET status = 'cancelled', reviewed_by = p_reviewed_by, reviewed_at = now()
  WHERE id = p_request_id;

  -- Refund the amount back to wallet
  UPDATE public.wallets
  SET balance = balance + v_amount, updated_at = now()
  WHERE distributor_id = v_distributor_id;
END;
$$;
