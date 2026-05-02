-- ============================================================
-- COMPLETE DIAGNOSTIC SCRIPT FOR BARBER QUEUE ISSUE
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: CHECK DATABASE SCHEMA ────────────────────────────
SELECT '=== STEP 1: Checking bookings table structure ===' as step;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ── STEP 2: CHECK IF BARBER_PROFILE_ID COLUMN EXISTS ─────────
SELECT '=== STEP 2: Checking if barber_profile_id column exists ===' as step;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
        AND column_name = 'barber_profile_id'
    ) THEN 'YES - barber_profile_id column exists'
    ELSE 'NO - barber_profile_id column DOES NOT exist (using old schema)'
  END as column_status;

-- ── STEP 3: CHECK PROFILES AND ROLES ──────────────────────────
SELECT '=== STEP 3: Checking user profiles and roles ===' as step;

SELECT 
  id,
  name,
  email,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- ── STEP 4: CHECK BARBERS TABLE ───────────────────────────────
SELECT '=== STEP 4: Checking barbers table ===' as step;

SELECT 
  b.id as barber_record_id,
  b.shop_id,
  b.profile_id as barber_profile_id,
  b.name as barber_name,
  b.is_available,
  b.is_active,
  s.name as shop_name,
  p.name as profile_name,
  p.email as profile_email
FROM barbers b
LEFT JOIN shops s ON s.id = b.shop_id
LEFT JOIN profiles p ON p.id = b.profile_id
WHERE b.is_active = true
ORDER BY b.created_at DESC;

-- ── STEP 5: CHECK SHOP_BARBERS TABLE (NEW SCHEMA) ────────────
SELECT '=== STEP 5: Checking shop_barbers table (if exists) ===' as step;

SELECT 
  sb.id,
  sb.shop_id,
  sb.barber_id as barber_profile_id,
  sb.status,
  sb.is_available,
  s.name as shop_name,
  p.name as barber_name,
  p.email as barber_email
FROM shop_barbers sb
LEFT JOIN shops s ON s.id = sb.shop_id
LEFT JOIN profiles p ON p.id = sb.barber_id
WHERE sb.status = 'active'
ORDER BY sb.created_at DESC;

-- ── STEP 6: CHECK TODAY'S BOOKINGS ────────────────────────────
SELECT '=== STEP 6: Checking todays bookings ===' as step;

SELECT 
  b.id,
  b.shop_id,
  b.barber_id,
  b.user_id,
  b.service,
  b.price,
  b.slot_time,
  b.status,
  b.token_no,
  b.created_at,
  p.name as customer_name,
  p.email as customer_email,
  bar.name as barber_name,
  bar.profile_id as barber_profile_id_from_barbers_table,
  s.name as shop_name
FROM bookings b
LEFT JOIN profiles p ON p.id = b.user_id
LEFT JOIN barbers bar ON bar.id = b.barber_id
LEFT JOIN shops s ON s.id = b.shop_id
WHERE DATE(b.slot_time AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
  AND b.status != 'cancelled'
ORDER BY b.created_at DESC;

-- ── STEP 7: CHECK BARBER_PROFILE_ID IN BOOKINGS (IF EXISTS) ──
SELECT '=== STEP 7: Checking if bookings have barber_profile_id set ===' as step;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'barber_profile_id'
  ) THEN
    RAISE NOTICE 'barber_profile_id column exists, checking data...';
    
    -- This will only run if the column exists
    PERFORM 
      COUNT(*) as total_bookings,
      COUNT(barber_profile_id) as bookings_with_profile_id,
      COUNT(*) - COUNT(barber_profile_id) as bookings_without_profile_id
    FROM bookings;
  ELSE
    RAISE NOTICE 'barber_profile_id column does NOT exist - using old schema';
  END IF;
END $$;

-- ── STEP 8: CHECK RLS POLICIES ────────────────────────────────
SELECT '=== STEP 8: Checking RLS policies on bookings table ===' as step;

SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'bookings'
  AND schemaname = 'public'
ORDER BY policyname;

-- ── STEP 9: SUMMARY AND RECOMMENDATIONS ───────────────────────
SELECT '=== STEP 9: Summary ===' as step;

SELECT 
  (SELECT COUNT(*) FROM profiles WHERE role = 'customer') as total_customers,
  (SELECT COUNT(*) FROM profiles WHERE role = 'barber') as total_barbers,
  (SELECT COUNT(*) FROM profiles WHERE role = 'owner') as total_owners,
  (SELECT COUNT(*) FROM shops WHERE is_active = true) as active_shops,
  (SELECT COUNT(*) FROM barbers WHERE is_active = true) as active_barber_records,
  (SELECT COUNT(*) FROM bookings WHERE DATE(slot_time AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE AND status != 'cancelled') as todays_bookings;

-- ── INSTRUCTIONS ──────────────────────────────────────────────
SELECT '
=== WHAT TO LOOK FOR ===

1. STEP 2: Does barber_profile_id column exist?
   - If NO: The app will use fallback mode (old schema) - this is OK
   - If YES: Check STEP 7 to see if bookings have this field populated

2. STEP 4: Are there barber records?
   - Each barber should have a profile_id that matches their user account
   - Check that is_active = true

3. STEP 6: Are there bookings for today?
   - Check that barber_id matches a barber record from STEP 4
   - Check that the barber record has the correct profile_id

4. STEP 8: Check RLS policies
   - There should be a policy called "bookings_barber_select"
   - It should allow barbers to see their own bookings

=== COMMON ISSUES ===

Issue 1: No barber records in STEP 4
Fix: Owner needs to add/invite the barber to their shop

Issue 2: Bookings exist but barber_id doesnt match any barber record
Fix: Data inconsistency - may need to recreate bookings

Issue 3: RLS policy is blocking access
Fix: Update the bookings_barber_select policy (see QUICK_FIX.md)

Issue 4: barber_profile_id column exists but is NULL in bookings
Fix: Run schema_migration_barber_links.sql to populate the column

' as instructions;
