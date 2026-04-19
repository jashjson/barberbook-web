-- ============================================================
-- BARBERBOOK — Complete Supabase Schema v2
-- Run this entire file in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── ENABLE EXTENSIONS ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
-- Stores all user info. id mirrors auth.users.id.
-- Email is the primary auth identifier; phone is stored for
-- display and alternative login lookup.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,           -- must match auth.users email
  phone       TEXT UNIQUE,           -- used for phone-login lookup
  role        TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','barber','owner')),
  initials    TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups for login-by-phone resolution
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- ── SHOPS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  plan        TEXT NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free','standard','premium')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);

-- ── BARBERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barbers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  profile_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  services     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barbers_shop    ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_profile ON barbers(profile_id);

-- ── BOOKINGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id   UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_no    INTEGER,
  service     TEXT NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,
  slot_time   TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting','in_chair','done','cancelled','no_show')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_shop_date   ON bookings(shop_id, slot_time);
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date ON bookings(barber_id, slot_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user        ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status      ON bookings(status);

-- ── AUTO UPDATED_AT TRIGGER ───────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated  BEFORE UPDATE ON profiles  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  CREATE TRIGGER trg_shops_updated     BEFORE UPDATE ON shops     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  CREATE TRIGGER trg_barbers_updated   BEFORE UPDATE ON barbers   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  CREATE TRIGGER trg_bookings_updated  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TOKEN AUTO-ASSIGN TRIGGER ────────────────────────────────
-- Assigns the next sequential token per barber per calendar day (IST)
-- Cancelled bookings do NOT affect token numbers (gaps are intentional)
CREATE OR REPLACE FUNCTION assign_token_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_token  INTEGER;
  booking_date DATE;
BEGIN
  booking_date := DATE(NEW.slot_time AT TIME ZONE 'Asia/Kolkata');

  SELECT COALESCE(MAX(token_no), 0) + 1
    INTO next_token
    FROM bookings
   WHERE barber_id = NEW.barber_id
     AND DATE(slot_time AT TIME ZONE 'Asia/Kolkata') = booking_date
     AND status != 'cancelled';

  NEW.token_no := next_token;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_assign_token
    BEFORE INSERT ON bookings
    FOR EACH ROW EXECUTE FUNCTION assign_token_number();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── ENABLE REALTIME ───────────────────────────────────────────
-- Run these only once; ignore errors if already added
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE barbers;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies before recreating (safe to re-run)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('profiles','shops','barbers','bookings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- PROFILES
CREATE POLICY "profiles_own_select"  ON profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert"  ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_own_update"  ON profiles FOR UPDATE  USING (auth.uid() = id);
-- Barbers/owners need to read customer names for their bookings
CREATE POLICY "profiles_booking_read" ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings b
    JOIN barbers bar ON bar.id = b.barber_id
    JOIN shops   s   ON s.id  = b.shop_id
    WHERE b.user_id = profiles.id
      AND (bar.profile_id = auth.uid() OR s.owner_id = auth.uid())
  )
);

-- SHOPS (public read, owner write)
CREATE POLICY "shops_public_read"  ON shops FOR SELECT USING (is_active = true);
CREATE POLICY "shops_owner_insert" ON shops FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "shops_owner_update" ON shops FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "shops_owner_delete" ON shops FOR DELETE USING (auth.uid() = owner_id);

-- BARBERS (public read, owner/self write)
CREATE POLICY "barbers_public_read"  ON barbers FOR SELECT USING (true);
CREATE POLICY "barbers_owner_insert" ON barbers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND owner_id = auth.uid())
);
CREATE POLICY "barbers_owner_or_self_update" ON barbers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND owner_id = auth.uid())
  OR profile_id = auth.uid()
);

-- BOOKINGS (customer sees own, barber sees their queue, owner sees whole shop)
CREATE POLICY "bookings_customer_select"  ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_barber_select"    ON bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM barbers WHERE id = barber_id AND profile_id = auth.uid())
);
CREATE POLICY "bookings_owner_select"     ON bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND owner_id = auth.uid())
);
CREATE POLICY "bookings_customer_insert"  ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_customer_cancel"  ON bookings FOR UPDATE USING (
  auth.uid() = user_id AND status IN ('waiting', 'in_chair')
);
CREATE POLICY "bookings_barber_update"    ON bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM barbers WHERE id = barber_id AND profile_id = auth.uid())
);
CREATE POLICY "bookings_owner_update"     ON bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND owner_id = auth.uid())
);

-- ── SUPABASE AUTH SETTINGS ────────────────────────────────────
-- In Supabase Dashboard → Authentication → Settings:
--
-- 1. Enable Email provider (already on by default)
-- 2. Set "Confirm email" = ON  (users must verify via OTP)
-- 3. Set "Email OTP expiry" = 900 (15 minutes is sufficient)
-- 4. Disable Phone provider (we handle phone in profiles table only)
-- 5. Optional: set Site URL to your domain (https://barberbook.in)
-- 6. Optional: customise the OTP email template in
--    Authentication → Email Templates → "Confirm signup"
--    Subject: "Your BarberBook verification code"
--    Body: include {{ .Token }} — this is the 6-digit code
--
-- ── AFTER SETUP ──────────────────────────────────────────────
-- Test flow:
-- 1. Register with email + phone via /register
-- 2. Check email for 6-digit OTP
-- 3. Enter OTP on /register step 3
-- 4. Login via /login using email OR phone number
