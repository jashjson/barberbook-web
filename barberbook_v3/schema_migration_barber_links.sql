-- ============================================================
-- BARBER-SHOP RELATIONSHIP MIGRATION
-- This migration fixes the barber/owner relationship logic
-- ============================================================

-- ── STEP 1: CREATE SHOP_BARBERS RELATIONSHIP TABLE ──────────
-- This table represents the many-to-many relationship between
-- barbers (authenticated users with role='barber') and shops
CREATE TABLE IF NOT EXISTS shop_barbers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','rejected','removed')),
  invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  is_available BOOLEAN NOT NULL DEFAULT true,
  services    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure a barber can only be linked once per shop
  UNIQUE(shop_id, barber_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_barbers_shop ON shop_barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_barbers_barber ON shop_barbers(barber_id);
CREATE INDEX IF NOT EXISTS idx_shop_barbers_status ON shop_barbers(status);

-- Add updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER trg_shop_barbers_updated
    BEFORE UPDATE ON shop_barbers
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STEP 2: MIGRATE EXISTING BARBERS DATA ───────────────────
-- Convert existing barbers table records to shop_barbers links
-- Only migrate barbers that have a profile_id (linked to auth user)
INSERT INTO shop_barbers (shop_id, barber_id, status, is_available, services, created_at)
SELECT 
  b.shop_id,
  b.profile_id,
  'active' as status,
  b.is_available,
  b.services,
  b.created_at
FROM barbers b
WHERE b.profile_id IS NOT NULL
  AND b.is_active = true
ON CONFLICT (shop_id, barber_id) DO NOTHING;

-- ── STEP 3: UPDATE BOOKINGS TO REFERENCE PROFILES ───────────
-- Add new column to bookings that references the barber's profile
-- This allows us to phase out the old barbers table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Populate barber_profile_id from existing barber_id
UPDATE bookings b
SET barber_profile_id = bar.profile_id
FROM barbers bar
WHERE b.barber_id = bar.id
  AND bar.profile_id IS NOT NULL
  AND b.barber_profile_id IS NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_bookings_barber_profile ON bookings(barber_profile_id);

-- ── STEP 4: UPDATE RLS POLICIES ─────────────────────────────

-- Drop old barber policies
DROP POLICY IF EXISTS "barbers_public_read" ON barbers;
DROP POLICY IF EXISTS "barbers_owner_insert" ON barbers;
DROP POLICY IF EXISTS "barbers_owner_or_self_update" ON barbers;

-- Enable RLS on shop_barbers
ALTER TABLE shop_barbers ENABLE ROW LEVEL SECURITY;

-- SHOP_BARBERS POLICIES

-- Anyone can see active barber-shop links (for booking UI)
CREATE POLICY "shop_barbers_public_read" ON shop_barbers
  FOR SELECT
  USING (status = 'active');

-- Shop owners can see all links for their shop
CREATE POLICY "shop_barbers_owner_read" ON shop_barbers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_barbers.shop_id
        AND shops.owner_id = auth.uid()
    )
  );

-- Barbers can see their own links
CREATE POLICY "shop_barbers_barber_read" ON shop_barbers
  FOR SELECT
  USING (barber_id = auth.uid());

-- Shop owners can invite barbers (create pending links)
CREATE POLICY "shop_barbers_owner_invite" ON shop_barbers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_barbers.shop_id
        AND shops.owner_id = auth.uid()
    )
    AND invited_by = auth.uid()
    AND status = 'pending'
  );

-- Shop owners can update/remove barbers from their shop
CREATE POLICY "shop_barbers_owner_update" ON shop_barbers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_barbers.shop_id
        AND shops.owner_id = auth.uid()
    )
  );

-- Barbers can accept/reject invites (update their own pending links)
CREATE POLICY "shop_barbers_barber_respond" ON shop_barbers
  FOR UPDATE
  USING (
    barber_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    barber_id = auth.uid()
    AND status IN ('active', 'rejected')
  );

-- Shop owners can delete links
CREATE POLICY "shop_barbers_owner_delete" ON shop_barbers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_barbers.shop_id
        AND shops.owner_id = auth.uid()
    )
  );

-- ── STEP 5: UPDATE BOOKING POLICIES ─────────────────────────
-- Update booking policies to work with new barber_profile_id

DROP POLICY IF EXISTS "bookings_barber_select" ON bookings;
DROP POLICY IF EXISTS "bookings_barber_update" ON bookings;

-- Barbers can see bookings where they are the assigned barber
CREATE POLICY "bookings_barber_select" ON bookings
  FOR SELECT
  USING (
    barber_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM barbers
      WHERE barbers.id = bookings.barber_id
        AND barbers.profile_id = auth.uid()
    )
  );

-- Barbers can update their own bookings
CREATE POLICY "bookings_barber_update" ON bookings
  FOR UPDATE
  USING (
    barber_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM barbers
      WHERE barbers.id = bookings.barber_id
        AND barbers.profile_id = auth.uid()
    )
  );

-- ── STEP 6: CREATE HELPER VIEWS ─────────────────────────────
-- View to easily get active barbers for a shop
CREATE OR REPLACE VIEW shop_active_barbers AS
SELECT 
  sb.shop_id,
  sb.id as link_id,
  sb.is_available,
  sb.services,
  p.id as barber_id,
  p.name as barber_name,
  p.email as barber_email,
  p.phone as barber_phone,
  p.avatar_url as barber_avatar
FROM shop_barbers sb
JOIN profiles p ON p.id = sb.barber_id
WHERE sb.status = 'active'
  AND p.role = 'barber';

-- ── NOTES ────────────────────────────────────────────────────
-- After running this migration:
-- 
-- 1. The old 'barbers' table still exists for backward compatibility
--    with existing bookings, but new barbers should NOT be added to it
-- 
-- 2. New bookings should use barber_profile_id instead of barber_id
-- 
-- 3. Frontend should be updated to:
--    - Remove "Add Barber" that creates auth accounts
--    - Add "Invite Barber" that creates pending shop_barbers links
--    - Show pending invites for owners
--    - Show pending invites for barbers to accept/reject
-- 
-- 4. The barbers table can be deprecated once all bookings
--    are migrated to use barber_profile_id

