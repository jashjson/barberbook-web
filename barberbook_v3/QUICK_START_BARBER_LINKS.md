# Quick Start: Barber-Shop Links

## TL;DR

**OLD (WRONG):** Owner creates barber profile → Barber has no account
**NEW (CORRECT):** Barber signs up → Owner invites → Barber accepts → Linked!

---

## Setup (One Time)

### 1. Run Migration

```sql
-- In Supabase SQL Editor
-- Run: schema_migration_barber_links.sql
```

### 2. Verify Tables

```sql
-- Check shop_barbers table exists
SELECT * FROM shop_barbers LIMIT 1;
```

---

## Owner Flow (3 Steps)

### Step 1: Create Shop

```javascript
// Already implemented in OwnerShop component
await shopsApi.create({
  owner_id: profile.id,
  name: "Raja's Barber Shop",
  address: "Anna Nagar, Chennai",
  phone: "+91 98765 43210"
})
```

### Step 2: Invite Barber

```javascript
// In OwnerStaff component
await shopBarbersApi.inviteBarber(
  shopId,
  "barber@example.com",  // Barber's email
  ownerId
)
```

**Result:** Creates pending invite

### Step 3: Manage Barbers

```javascript
// Toggle availability
await shopBarbersApi.setAvailability(linkId, true)

// Remove barber
await shopBarbersApi.removeBarber(linkId)

// Cancel pending invite
await shopBarbersApi.deleteInvite(linkId)
```

---

## Barber Flow (2 Steps)

### Step 1: Sign Up

```javascript
// Already implemented in RegisterPage
await signUp({
  email: "barber@example.com",
  password: "password123",
  name: "Ravi Kumar",
  phone: "+91 98765 43210",
  role: "barber"  // Important!
})
```

### Step 2: Accept Invite

```javascript
// In BarberProfile component
// Get pending invites
const { data } = await shopBarbersApi.getPendingForBarber(barberId)

// Accept invite
await shopBarbersApi.acceptInvite(linkId)

// Or reject
await shopBarbersApi.rejectInvite(linkId)
```

---

## API Quick Reference

```javascript
// Import
import { shopBarbers as shopBarbersApi } from '../lib/supabase'

// Owner methods
shopBarbersApi.inviteBarber(shopId, email, ownerId)
shopBarbersApi.getByShop(shopId)
shopBarbersApi.getActiveByShop(shopId)
shopBarbersApi.setAvailability(linkId, bool)
shopBarbersApi.removeBarber(linkId)
shopBarbersApi.deleteInvite(linkId)

// Barber methods
shopBarbersApi.getByBarber(barberId)
shopBarbersApi.getPendingForBarber(barberId)
shopBarbersApi.acceptInvite(linkId)
shopBarbersApi.rejectInvite(linkId)
```

---

## Common Errors

### "No barber account found with this email"

**Fix:** Barber must sign up first with role="barber"

### "Barber not in queue"

**Fix:** Barber must accept invite first

### "Cannot create barber"

**Fix:** Use invite flow, don't create directly

---

## Database Queries

### Check Pending Invites

```sql
SELECT 
  sb.*,
  p.name as barber_name,
  p.email as barber_email,
  s.name as shop_name
FROM shop_barbers sb
JOIN profiles p ON p.id = sb.barber_id
JOIN shops s ON s.id = sb.shop_id
WHERE sb.status = 'pending';
```

### Check Active Links

```sql
SELECT 
  sb.*,
  p.name as barber_name,
  s.name as shop_name
FROM shop_barbers sb
JOIN profiles p ON p.id = sb.barber_id
JOIN shops s ON s.id = sb.shop_id
WHERE sb.status = 'active';
```

### Find Barber's Shops

```sql
SELECT 
  s.*,
  sb.status,
  sb.is_available
FROM shop_barbers sb
JOIN shops s ON s.id = sb.shop_id
WHERE sb.barber_id = '<barber-uuid>'
  AND sb.status = 'active';
```

---

## Testing Checklist

- [ ] Owner can invite barber by email
- [ ] Error shown if email doesn't exist
- [ ] Error shown if email is not a barber
- [ ] Pending invite appears for owner
- [ ] Pending invite appears for barber
- [ ] Barber can accept invite
- [ ] Barber can reject invite
- [ ] Active barber appears in owner's list
- [ ] Owner can toggle barber availability
- [ ] Owner can remove barber
- [ ] Barber can view queue after acceptance
- [ ] RLS prevents unauthorized access

---

## Troubleshooting

### Issue: Invite not showing for barber

**Check:**
1. Barber is logged in
2. Email matches exactly
3. Barber role is "barber"
4. Invite status is "pending"

**Query:**
```sql
SELECT * FROM shop_barbers 
WHERE barber_id = '<barber-uuid>';
```

### Issue: Owner cannot invite

**Check:**
1. Owner is logged in
2. Shop exists and belongs to owner
3. Barber email exists in profiles
4. No existing link (check UNIQUE constraint)

**Query:**
```sql
SELECT * FROM profiles 
WHERE email = 'barber@example.com' 
  AND role = 'barber';
```

### Issue: RLS blocking operations

**Check:**
1. User is authenticated
2. User has correct role
3. Policies are enabled
4. User owns the resource

**Query:**
```sql
-- Check policies
SELECT * FROM pg_policies 
WHERE tablename = 'shop_barbers';
```

---

## Migration Checklist

- [ ] Backup database
- [ ] Run migration SQL
- [ ] Verify shop_barbers table created
- [ ] Verify RLS policies created
- [ ] Test owner invite flow
- [ ] Test barber accept flow
- [ ] Deploy frontend changes
- [ ] Monitor for errors
- [ ] Update documentation
- [ ] Train users on new flow

---

## Support

**Documentation:**
- `BARBER_SHOP_RELATIONSHIP.md` - Complete guide
- `BARBER_RELATIONSHIP_CHANGES.md` - Change summary
- `schema_migration_barber_links.sql` - Migration script

**Need Help?**
- Check Supabase logs
- Review RLS policies
- Test with SQL queries
- Check browser console

---

## Summary

✅ Barbers create own accounts
✅ Owners invite by email
✅ Barbers accept invites
✅ Secure and correct
✅ Production-ready

**Remember:** Never create barber auth accounts directly. Always use the invite flow!
