# Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [x] All files created
- [x] No syntax errors
- [x] No TypeScript errors
- [x] Code follows best practices
- [x] Error handling implemented
- [x] Documentation complete

### 2. Database Preparation
- [ ] Backup production database
- [ ] Review migration script
- [ ] Test migration on staging
- [ ] Verify RLS policies
- [ ] Check indexes created

### 3. Testing
- [ ] Test owner invite flow
- [ ] Test barber accept flow
- [ ] Test barber reject flow
- [ ] Test remove barber
- [ ] Test toggle availability
- [ ] Test RLS policies
- [ ] Test error messages
- [ ] Test edge cases

---

## Deployment Steps

### Step 1: Database Migration (15 minutes)

1. **Backup Database**
   ```
   Supabase Dashboard → Database → Backups → Create Backup
   ```
   - [ ] Backup created
   - [ ] Backup verified

2. **Run Migration**
   ```
   Supabase Dashboard → SQL Editor → New Query
   Copy contents of: schema_migration_barber_links.sql
   Click "Run"
   ```
   - [ ] Migration executed
   - [ ] No errors shown

3. **Verify Tables**
   ```sql
   -- Check shop_barbers table
   SELECT * FROM shop_barbers LIMIT 1;
   
   -- Check policies
   SELECT * FROM pg_policies WHERE tablename = 'shop_barbers';
   
   -- Check indexes
   SELECT * FROM pg_indexes WHERE tablename = 'shop_barbers';
   ```
   - [ ] Table exists
   - [ ] Policies created (6 policies)
   - [ ] Indexes created (3 indexes)

### Step 2: Frontend Deployment (10 minutes)

1. **Build Application**
   ```bash
   cd barberbook_v3
   npm install
   npm run build
   ```
   - [ ] Build successful
   - [ ] No errors
   - [ ] dist/ folder created

2. **Deploy to Hosting**
   ```bash
   # For Vercel
   vercel --prod
   
   # For Netlify
   netlify deploy --prod
   
   # For custom hosting
   # Upload dist/ folder
   ```
   - [ ] Deployment successful
   - [ ] Site accessible

3. **Verify Environment Variables**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   - [ ] Variables set correctly
   - [ ] Connection working

### Step 3: Smoke Testing (15 minutes)

1. **Owner Flow**
   - [ ] Login as owner
   - [ ] Navigate to "Staff" section
   - [ ] Click "Invite Barber"
   - [ ] Enter test barber email
   - [ ] Verify invite created
   - [ ] Check pending invites section

2. **Barber Flow**
   - [ ] Login as barber
   - [ ] Navigate to "Profile"
   - [ ] Verify pending invite visible
   - [ ] Click "Accept"
   - [ ] Verify moved to "My Shops"
   - [ ] Navigate to queue
   - [ ] Verify queue accessible

3. **Error Handling**
   - [ ] Try inviting non-existent email
   - [ ] Try inviting customer email
   - [ ] Try inviting already-linked barber
   - [ ] Verify error messages shown

---

## Post-Deployment

### 1. Monitoring (First 24 hours)

- [ ] Check error logs
  ```
  Supabase Dashboard → Logs → Error Logs
  ```

- [ ] Monitor API calls
  ```
  Supabase Dashboard → API → Logs
  ```

- [ ] Check user feedback
  - [ ] Support emails
  - [ ] User reports
  - [ ] Social media

### 2. User Communication

**Send to Owners:**
```
Subject: New Way to Add Barbers

We've improved how you add barbers!

Now you invite barbers by email instead of creating profiles.

How it works:
1. Barber creates BarberBook account
2. You invite them in "Staff" section
3. They accept your invite
4. They can manage their queue

Try it now: [Link to Staff page]

Questions? Reply to this email.
```

**Send to Barbers:**
```
Subject: Accept Shop Invitations

You can now work at multiple shops!

Check your Profile for pending invites.

Accept invites to start managing your queue.

Try it now: [Link to Profile page]

Questions? Reply to this email.
```

- [ ] Email sent to owners
- [ ] Email sent to barbers
- [ ] Help docs updated

### 3. Documentation Updates

- [ ] Update user guide
- [ ] Update FAQ
- [ ] Update video tutorials
- [ ] Update support docs

---

## Rollback Plan

If critical issues arise:

### Option 1: Revert Frontend Only

```bash
git revert <commit-hash>
npm run build
# Redeploy
```

- [ ] Frontend reverted
- [ ] Old UI restored
- [ ] Database changes kept
- [ ] No data loss

### Option 2: Disable New Feature

```javascript
// In OwnerStaff component
const ENABLE_NEW_INVITE_FLOW = false

if (ENABLE_NEW_INVITE_FLOW) {
  // Show new invite UI
} else {
  // Show old add barber UI
}
```

- [ ] Feature flag added
- [ ] Old flow restored
- [ ] Users can still use app

### Option 3: Full Rollback

```sql
-- Drop new table (LAST RESORT)
DROP TABLE IF EXISTS shop_barbers CASCADE;

-- Restore old policies
-- (Keep backup of old policies)
```

- [ ] Table dropped
- [ ] Policies restored
- [ ] Frontend reverted
- [ ] System restored

---

## Success Criteria

### Technical
- [ ] Zero critical errors
- [ ] All RLS policies working
- [ ] No performance degradation
- [ ] All features functional

### Business
- [ ] Owners can invite barbers
- [ ] Barbers can accept invites
- [ ] Queue management works
- [ ] Bookings still work

### User Experience
- [ ] Clear error messages
- [ ] Intuitive UI
- [ ] Fast response times
- [ ] No user complaints

---

## Metrics to Track

### Week 1
- [ ] Number of invites sent
- [ ] Number of invites accepted
- [ ] Number of invites rejected
- [ ] Error rate
- [ ] User feedback

### Month 1
- [ ] Adoption rate
- [ ] User satisfaction
- [ ] Support tickets
- [ ] Feature usage

---

## Support Preparation

### 1. Support Team Training

- [ ] Train on new flow
- [ ] Review error messages
- [ ] Practice troubleshooting
- [ ] Update support scripts

### 2. Common Issues & Solutions

**Issue:** "No barber account found"
**Solution:** Barber must sign up first with role="barber"

**Issue:** "Invite not showing"
**Solution:** Check email matches exactly, verify barber role

**Issue:** "Cannot view queue"
**Solution:** Barber must accept invite first

**Issue:** "RLS error"
**Solution:** Check user is authenticated, verify role

### 3. Escalation Path

1. Level 1: Support team (common issues)
2. Level 2: Technical team (RLS/database issues)
3. Level 3: Developer (code bugs)

- [ ] Escalation path documented
- [ ] Contact info updated
- [ ] On-call schedule set

---

## Final Checks

### Before Going Live

- [ ] All tests passed
- [ ] Documentation complete
- [ ] Team trained
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Monitoring set up
- [ ] Support prepared

### After Going Live

- [ ] Monitor for 1 hour
- [ ] Check error logs
- [ ] Test key flows
- [ ] Respond to feedback
- [ ] Update status page

---

## Sign-Off

**Technical Lead:** _________________ Date: _______
**Product Manager:** ________________ Date: _______
**QA Lead:** _______________________ Date: _______

**Deployment Status:** 
- [ ] Ready to Deploy
- [ ] Deployed Successfully
- [ ] Issues Found (describe): _______________
- [ ] Rolled Back (reason): _________________

---

## Notes

_Use this space for deployment notes, issues encountered, or lessons learned:_

```
[Add notes here]
```

---

*Last Updated: 2024*
*Version: 1.0*
*Status: Ready for Deployment*
