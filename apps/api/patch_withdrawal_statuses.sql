-- =========================================================
-- Patch: Add failed and cancelled statuses to withdrawal_requests
-- =========================================================

-- Drop the existing check constraint on status
ALTER TABLE withdrawal_requests 
DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;

-- Re-add the check constraint with additional statuses
ALTER TABLE withdrawal_requests 
ADD CONSTRAINT withdrawal_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'failed', 'cancelled'));

-- Verify the constraint was added successfully
-- (This will show no output if successful, or an error if it failed)
