-- Debug query to check bookings table structure and data
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if barber_profile_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check recent bookings and their barber references
SELECT 
  id,
  shop_id,
  barber_id,
  barber_profile_id,
  user_id,
  service,
  slot_time,
  status,
  created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check barbers table to see profile_id mappings
SELECT 
  id as barber_id,
  shop_id,
  profile_id as barber_profile_id,
  name,
  is_active
FROM barbers
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check shop_barbers table
SELECT 
  id,
  shop_id,
  barber_id as barber_profile_id,
  status,
  is_available
FROM shop_barbers
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if there are any bookings with barber_profile_id set
SELECT 
  COUNT(*) as total_bookings,
  COUNT(barber_profile_id) as bookings_with_profile_id,
  COUNT(*) - COUNT(barber_profile_id) as bookings_without_profile_id
FROM bookings;
