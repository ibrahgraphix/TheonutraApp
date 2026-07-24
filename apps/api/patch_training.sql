-- =========================================================
-- Step 20 Migration: Training Academy (PDF-only)
-- =========================================================

-- 1. Create training_categories table
CREATE TABLE IF NOT EXISTS training_categories (
    id              uuid primary key default uuid_generate_v4(),
    name            text not null unique,
    description     text,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_training_categories_sort ON training_categories(sort_order);

-- 2. Create training_materials table
CREATE TABLE IF NOT EXISTS training_materials (
    id              uuid primary key default uuid_generate_v4(),
    category_id     uuid not null references training_categories(id) on delete cascade,
    title           text not null,
    description     text,
    pdf_url         text not null,
    uploaded_by     uuid not null references profiles(id) on delete set null,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_training_materials_category ON training_materials(category_id);
CREATE INDEX IF NOT EXISTS idx_training_materials_active ON training_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_training_materials_created ON training_materials(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for training_categories
-- Everyone can view categories
DROP POLICY IF EXISTS training_categories_public_select ON training_categories;
CREATE POLICY training_categories_public_select ON training_categories FOR SELECT USING (true);

-- Only staff can insert/update/delete categories
DROP POLICY IF EXISTS training_categories_staff_all ON training_categories;
CREATE POLICY training_categories_staff_all ON training_categories FOR ALL USING (public.is_staff());

-- 5. RLS Policies for training_materials
-- Everyone can view active materials
DROP POLICY IF EXISTS training_materials_public_select ON training_materials;
CREATE POLICY training_materials_public_select ON training_materials FOR SELECT USING (is_active = true);

-- Staff can view all materials (including inactive)
DROP POLICY IF EXISTS training_materials_staff_select ON training_materials;
CREATE POLICY training_materials_staff_select ON training_materials FOR SELECT USING (public.is_staff());

-- Only staff can insert/update/delete materials
DROP POLICY IF EXISTS training_materials_staff_all ON training_materials;
CREATE POLICY training_materials_staff_all ON training_materials FOR ALL USING (public.is_staff());

-- 6. Auto-update updated_at trigger for training_categories
CREATE OR REPLACE FUNCTION set_training_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_categories_updated_at ON training_categories;
CREATE TRIGGER trg_training_categories_updated_at
BEFORE UPDATE ON training_categories
FOR EACH ROW
EXECUTE FUNCTION set_training_categories_updated_at();

-- 7. Auto-update updated_at trigger for training_materials
CREATE OR REPLACE FUNCTION set_training_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_materials_updated_at ON training_materials;
CREATE TRIGGER trg_training_materials_updated_at
BEFORE UPDATE ON training_materials
FOR EACH ROW
EXECUTE FUNCTION set_training_materials_updated_at();
