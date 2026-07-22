-- Make level column nullable in commissions table
-- Retail profit commissions are direct to seller, not level-based upline bonuses
ALTER TABLE commissions ALTER COLUMN level DROP NOT NULL;
