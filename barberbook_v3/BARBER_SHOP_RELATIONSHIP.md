# Barber-Shop Relationship System

## Overview

This document explains the correct barber-shop relationship model implemented in BarberBook.

## Problem Statement

**WRONG APPROACH (OLD):**
- Owner creates barber profiles directly with just a name
- Barber has no auth account
- Barber cannot login or manage their own queue
- Owner "owns" the barber identity

**CORRECT APPROACH (NEW):**
- Barber creates their own auth account
- Barber signs up with role="barber"
- Owner invites barber by email
- Barber accepts invite
- Relationship is established through `shop_barbers` table

---

## System Architecture

### Three Separate Concerns

1. **Auth Identity** (`auth.users`)
   - Managed by Supabase Auth
   - Email + password authentication
   - User creates their own account

2. **Profile** (`profiles` table)
   - App-level user data
   - Stores: id, name, email, phone, role
   - Roles: customer, barber, owner

3. **Shop Membership** (`shop_barbers` table)
   - Relationship between barber and shop
   - Stores: shop_id, barber_id, status, is_available
   - Status: pending, active, rejected, removed

---

## Database Schema

### shop_barbers Table

```sql
CREATE TABLE shop_barbers (
  id          UUID PRIMARY KEY,
  shop_id     UUID REFERENCES shops(id),
  barber_id   UUID REFERENCES profiles(id),  -- Links to auth user
  status      TEXT CHECK (status IN ('pending','active','rejected','removed')),
  invited_by  UUID REFERENCES profiles(id),
  invited_at  TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  is_available BOOLEAN DEFAULT true,
  services    JSONB,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  UNIQUE(shop_id, barber_id)
);
```

### Key Points

- `barber_id` references `profiles.id` (which references `auth.users.id`)
- `status` tracks the invitation lifecycle
- `invited_by` tracks who sent the invite (owner)
- One barber can be linked to multiple shops
- One shop can have multiple barbers

---

## User Flows

### Owner Flow

1. **Create Shop**
   - Owner signs up with role="owner"
   - Creates shop in "My Shop" section
   - Shop is linked to owner via `owner_id`

2. **Invite Barber**
   - Go to "Staff" section
   - Click "Invite Barber"
   - Enter barber's email address
   - System checks if email exists with role="barber"
   - Creates `shop_barbers` record with status="pending"

3. **Manage Barbers**
   - View pending invites
   - View active barbers
   - Toggle barber availability
   - Remove barbers from shop

### Barber Flow

1. **Create Account**
   - Barber signs up with role="barber"
   - Creates own auth account
   - Profile is created automatically

2. **Receive Invite**
   - Owner invites barber by email
   - Barber sees pending invite in profile section

3. **Accept/Reject Invite**
   - Barber views invite details
   - Accepts → status changes to "active"
   - Rejects → status changes to "rejected"

4. **Work at Shop**
   - Once active, barber can:
     - View their queue
     - Manage bookings
     - Update availability
     - See earnings

---

## API Methods

### shopBarbers API

```javascript
// Owner invites barber
shopBarbers.inviteBarber(shopId, barberEmail, ownerId)

// Get barbers for a shop
shopBarbers.getByShop(shopId)
shopBarbers.getActiveByShop(shopId)

// Get shops for a barber
shopBarbers.getByBarber(barberId)
shopBarbers.getPendingForBarber(barberId)

// Barber responds to invite
shopBarbers.acceptInvite(linkId)
shopBarbers.rejectInvite(linkId)

// Owner manages barbers
shopBarbers.setAvailability(linkId, isAvailable)
shopBarbers.removeBarber(linkId)
shopBarbers.deleteInvite(linkId)
```

---

## Security (RLS Policies)

### shop_barbers Policies

1. **Public Read (Active Only)**
   ```sql
   SELECT WHERE status = 'active'
   ```
   - Anyone can see active barber-shop links (for booking UI)

2. **Owner Read All**
   ```sql
   SELECT WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
   ```
   - Owners see all links for their shops

3. **Barber Read Own**
   ```sql
   SELECT WHERE barber_id = auth.uid()
   ```
   - Barbers see their own links

4. **Owner Invite**
   ```sql
   INSERT WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
     AND invited_by = auth.uid()
     AND status = 'pending'
   ```
   - Only shop owners can create invites

5. **Barber Respond**
   ```sql
   UPDATE WHERE barber_id = auth.uid() AND status = 'pending'
   ```
   - Barbers can only accept/reject their own pending invites

6. **Owner Update/Remove**
   ```sql
   UPDATE/DELETE WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
   ```
   - Owners can update/remove barbers from their shops

---

## Migration from Old System

### Step 1: Run Migration SQL

```bash
# Run schema_migration_barber_links.sql in Supabase SQL Editor
```

This will:
- Create `shop_barbers` table
- Migrate existing barber links (where `profile_id` exists)
- Add `barber_profile_id` to bookings
- Update RLS policies

### Step 2: Update Frontend

- Replace "Add Barber" with "Invite Barber"
- Show pending invites for owners
- Show pending invites for barbers
- Update barber queue to use new relationship

### Step 3: Deprecate Old Flow

- Remove `barbersApi.create()` calls from owner pages
- Keep old `barbers` table for backward compatibility with existing bookings
- New bookings should use `barber_profile_id` instead of `barber_id`

---

## Testing Checklist

### Owner Tests

- [ ] Owner can create shop
- [ ] Owner can invite barber by email
- [ ] Owner sees error if email doesn't exist
- [ ] Owner sees error if email is not a barber
- [ ] Owner sees pending invites
- [ ] Owner can cancel pending invite
- [ ] Owner sees active barbers after acceptance
- [ ] Owner can toggle barber availability
- [ ] Owner can remove barber from shop

### Barber Tests

- [ ] Barber can sign up with role="barber"
- [ ] Barber sees pending invites in profile
- [ ] Barber can accept invite
- [ ] Barber can reject invite
- [ ] Barber sees active shops after acceptance
- [ ] Barber can view queue after acceptance
- [ ] Barber cannot view queue before acceptance

### Security Tests

- [ ] Owner cannot create barber auth account
- [ ] Barber cannot create shop_barbers link directly
- [ ] Barber can only respond to their own invites
- [ ] Owner can only invite to their own shops
- [ ] Unauthorized users cannot bypass RLS

---

## Common Issues

### "No barber account found with this email"

**Cause:** The email doesn't exist or the user's role is not "barber"

**Solution:** Ask the barber to:
1. Sign up on BarberBook
2. Select role="Barber" during registration
3. Verify their email
4. Then owner can invite them

### "Barber not showing in queue"

**Cause:** Barber hasn't accepted the invite yet

**Solution:**
1. Check if invite is still pending
2. Ask barber to check their profile for pending invites
3. Barber must accept invite to appear in queue

### "Old barbers not migrated"

**Cause:** Old barber records don't have `profile_id`

**Solution:**
1. These barbers need to create their own accounts
2. Owner should invite them using new flow
3. Old bookings will still work (backward compatibility)

---

## Best Practices

1. **Always use email invites**
   - Never create barber accounts manually
   - Always verify barber has signed up first

2. **Clear communication**
   - Tell barbers to sign up before inviting
   - Explain the invite/accept flow

3. **Handle edge cases**
   - Show helpful error messages
   - Guide users through the correct flow

4. **Maintain backward compatibility**
   - Keep old `barbers` table for existing bookings
   - Gradually migrate to new system

---

## Future Enhancements

1. **Email Notifications**
   - Send email when barber is invited
   - Send email when invite is accepted/rejected

2. **Multiple Shops**
   - Allow barbers to work at multiple shops
   - Show shop selector in barber dashboard

3. **Invite Expiry**
   - Auto-expire invites after 7 days
   - Allow owner to resend expired invites

4. **Barber Profiles**
   - Add barber bio, specialties, ratings
   - Show barber profiles to customers

---

## Summary

The new barber-shop relationship system ensures:

✅ Barbers are real authenticated users
✅ Owners cannot create barber identities
✅ Proper separation of concerns
✅ Secure database-level enforcement
✅ Clear invite/accept workflow
✅ Backward compatibility with existing data

This is the correct, production-ready approach for managing barber-shop relationships.
