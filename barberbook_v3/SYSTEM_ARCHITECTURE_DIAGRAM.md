# System Architecture Diagram

## Barber-Shop Relationship Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION LAYER                         │
│                      (Supabase Auth)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ auth.users.id
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PROFILES TABLE                             │
│  ┌──────────┬────────┬───────┬───────┬──────────────────┐      │
│  │ id (PK)  │  name  │ email │ phone │ role             │      │
│  ├──────────┼────────┼───────┼───────┼──────────────────┤      │
│  │ uuid-1   │ Owner  │ ...   │ ...   │ owner            │      │
│  │ uuid-2   │ Barber │ ...   │ ...   │ barber           │      │
│  │ uuid-3   │ Cust   │ ...   │ ...   │ customer         │      │
│  └──────────┴────────┴───────┴───────┴──────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
         │                           │
         │ owner_id                  │ barber_id
         ▼                           ▼
┌──────────────────┐        ┌──────────────────────────────┐
│   SHOPS TABLE    │        │   SHOP_BARBERS TABLE         │
│  ┌────────────┐  │        │  ┌────────────────────────┐  │
│  │ id (PK)    │  │◄───────┼──│ shop_id (FK)           │  │
│  │ owner_id   │  │        │  │ barber_id (FK)         │  │
│  │ name       │  │        │  │ status (pending/active)│  │
│  │ address    │  │        │  │ invited_by             │  │
│  │ phone      │  │        │  │ is_available           │  │
│  └────────────┘  │        │  └────────────────────────┘  │
└──────────────────┘        └──────────────────────────────┘
         │                           │
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │  BOOKINGS TABLE  │
            │  ┌────────────┐  │
            │  │ id (PK)    │  │
            │  │ shop_id    │  │
            │  │ barber_id  │  │ (old - deprecated)
            │  │ barber_    │  │ (new - use this)
            │  │  profile_id│  │
            │  │ user_id    │  │
            │  │ token_no   │  │
            │  │ status     │  │
            │  └────────────┘  │
            └──────────────────┘
```

---

## User Flow Diagram

### Owner Flow

```
┌─────────────┐
│   OWNER     │
│  Signs Up   │
│ role=owner  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Creates     │
│   SHOP      │
│ owner_id=   │
│  uuid-1     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Invites BARBER          │
│ by email                │
│                         │
│ shopBarbers.invite(     │
│   shopId,               │
│   "barber@example.com", │
│   ownerId               │
│ )                       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Creates PENDING link    │
│ in shop_barbers         │
│                         │
│ status = 'pending'      │
│ invited_by = owner_id   │
└─────────────────────────┘
```

### Barber Flow

```
┌─────────────┐
│   BARBER    │
│  Signs Up   │
│ role=barber │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Receives INVITE         │
│ (sees in profile)       │
│                         │
│ shopBarbers.            │
│  getPendingForBarber()  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ ACCEPTS or REJECTS      │
│                         │
│ shopBarbers.            │
│  acceptInvite(linkId)   │
│                         │
│ OR                      │
│                         │
│ shopBarbers.            │
│  rejectInvite(linkId)   │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Link status changes     │
│                         │
│ status = 'active'       │
│ responded_at = now()    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Barber can now:         │
│ - View queue            │
│ - Manage bookings       │
│ - Update availability   │
│ - See earnings          │
└─────────────────────────┘
```

---

## Data Flow Diagram

### Invite Creation

```
Owner UI
   │
   │ Click "Invite Barber"
   │ Enter email
   ▼
shopBarbersApi.inviteBarber()
   │
   │ 1. Validate email exists
   │ 2. Check role = 'barber'
   │ 3. Check no existing link
   ▼
INSERT INTO shop_barbers
   │
   │ shop_id = owner's shop
   │ barber_id = barber's profile.id
   │ status = 'pending'
   │ invited_by = owner's profile.id
   ▼
RLS Policy Check
   │
   │ ✓ Owner owns the shop?
   │ ✓ Invited_by = auth.uid()?
   │ ✓ Status = 'pending'?
   ▼
Success → Pending invite created
```

### Invite Acceptance

```
Barber UI
   │
   │ View pending invites
   │ Click "Accept"
   ▼
shopBarbersApi.acceptInvite()
   │
   │ linkId = invite.id
   ▼
UPDATE shop_barbers
   │
   │ status = 'active'
   │ responded_at = now()
   │ WHERE id = linkId
   ▼
RLS Policy Check
   │
   │ ✓ Barber_id = auth.uid()?
   │ ✓ Current status = 'pending'?
   │ ✓ New status IN ('active','rejected')?
   ▼
Success → Barber linked to shop
```

---

## Security Model

### RLS Policies Visualization

```
┌─────────────────────────────────────────────────────────┐
│                  shop_barbers TABLE                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  PUBLIC READ (status = 'active')               │    │
│  │  Anyone can see active barber-shop links       │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  OWNER READ (shop.owner_id = auth.uid())       │    │
│  │  Owners see all links for their shops          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  BARBER READ (barber_id = auth.uid())          │    │
│  │  Barbers see their own links                   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  OWNER INSERT (shop.owner_id = auth.uid())     │    │
│  │  Owners can create pending invites             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  BARBER UPDATE (barber_id = auth.uid())        │    │
│  │  Barbers can accept/reject their invites       │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  OWNER UPDATE (shop.owner_id = auth.uid())     │    │
│  │  Owners can update/remove barbers              │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## State Machine

### Invite Lifecycle

```
                    ┌─────────────┐
                    │   PENDING   │
                    │  (invited)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
    Barber    │                         │  Barber
    accepts   │                         │  rejects
              ▼                         ▼
       ┌──────────┐              ┌──────────┐
       │  ACTIVE  │              │ REJECTED │
       │ (linked) │              │ (denied) │
       └────┬─────┘              └──────────┘
            │
            │ Owner
            │ removes
            ▼
       ┌──────────┐
       │ REMOVED  │
       │(unlinked)│
       └──────────┘
```

---

## Component Hierarchy

```
App
├── AuthPages
│   ├── LoginPage
│   └── RegisterPage (role selection)
│
├── CustomerPages
│   ├── CustomerHome
│   ├── CustomerBook
│   └── CustomerProfile
│
├── BarberPages
│   ├── BarberQueue
│   ├── BarberSchedule
│   ├── BarberEarnings
│   └── BarberProfile
│       ├── PendingInvites ← NEW
│       │   ├── InviteCard
│       │   ├── AcceptButton
│       │   └── RejectButton
│       └── MyShops ← NEW
│
└── OwnerPages
    ├── OwnerDashboard
    ├── OwnerBookings
    ├── OwnerStaff ← MODIFIED
    │   ├── InviteBarberModal ← NEW (replaces AddBarberModal)
    │   ├── PendingInvites ← NEW
    │   └── ActiveBarbers ← MODIFIED
    ├── OwnerShop
    └── OwnerProfile
```

---

## API Layer

```
┌─────────────────────────────────────────────────────────┐
│                    supabase.js                           │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  auth                                          │    │
│  │  - signUpWithEmail()                           │    │
│  │  - signInWithEmail()                           │    │
│  │  - signInWithPhone()                           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  profiles                                      │    │
│  │  - get()                                       │    │
│  │  - upsert()                                    │    │
│  │  - update()                                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  shops                                         │    │
│  │  - getAll()                                    │    │
│  │  - getByOwner()                                │    │
│  │  - create()                                    │    │
│  │  - update()                                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  shopBarbers ← NEW                             │    │
│  │  - inviteBarber()                              │    │
│  │  - getByShop()                                 │    │
│  │  - getActiveByShop()                           │    │
│  │  - getByBarber()                               │    │
│  │  - getPendingForBarber()                       │    │
│  │  - acceptInvite()                              │    │
│  │  - rejectInvite()                              │    │
│  │  - setAvailability()                           │    │
│  │  - removeBarber()                              │    │
│  │  - deleteInvite()                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  bookings                                      │    │
│  │  - create()                                    │    │
│  │  - getBarberQueue()                            │    │
│  │  - getShopQueue()                              │    │
│  │  - updateStatus()                              │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Comparison: Old vs New

### OLD SYSTEM (WRONG)

```
Owner
  │
  │ Creates barber with name only
  ▼
barbers table
  │
  │ name: "Ravi Kumar"
  │ profile_id: NULL ← No auth account!
  │ shop_id: owner's shop
  ▼
❌ Barber cannot login
❌ Barber cannot manage queue
❌ Owner "owns" barber identity
❌ Insecure
```

### NEW SYSTEM (CORRECT)

```
Barber                    Owner
  │                         │
  │ Signs up               │ Creates shop
  │ role=barber            │
  ▼                         ▼
profiles                  shops
  │                         │
  │                         │ Invites barber
  │                         │ by email
  │                         ▼
  │                    shop_barbers
  │                    status=pending
  │                         │
  │ Accepts invite          │
  │                         │
  └────────┬────────────────┘
           │
           ▼
      shop_barbers
      status=active
           │
           ▼
✅ Barber can login
✅ Barber can manage queue
✅ Proper separation
✅ Secure
```

---

## Summary

This architecture ensures:

✅ **Separation of Concerns**
- Auth (Supabase) → Profile (App) → Membership (Relationship)

✅ **Security**
- RLS policies enforce access control
- Database-level security

✅ **Scalability**
- Barbers can work at multiple shops
- Shops can have multiple barbers

✅ **User Experience**
- Clear invite/accept flow
- Proper error messages
- Intuitive UI

✅ **Maintainability**
- Clean code structure
- Well-documented
- Easy to extend

---

*This diagram represents the final, correct architecture for the BarberBook application.*
